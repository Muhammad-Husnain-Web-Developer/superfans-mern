import fs from 'node:fs/promises';

/**
 * How long a video runs, read straight out of the file.
 *
 * The VPS has no ffmpeg or ffprobe (checked 2026-08-22), so the usual `ffprobe -show_format`
 * is not available and installing it needs root. MP4 and MOV — which is everything a phone
 * or a browser produces here — carry the answer in their own header: the `moov` box holds an
 * `mvhd` box with a timescale and a duration, and dividing one by the other gives seconds.
 * That is a few hundred bytes to read, not a transcode.
 *
 * Returns null when the container is something else (WebM, Ogg) or the header is malformed.
 * A null means "unknown", never "fine" — the caller decides what to do with an unknown.
 */
export async function probeVideoDurationSeconds(filePath: string): Promise<number | null> {
  let fh: fs.FileHandle | undefined;
  try {
    fh = await fs.open(filePath, 'r');
    const { size: fileSize } = await fh.stat();
    const moov = await findBox(fh, 0, fileSize, 'moov');
    if (!moov) return null;
    const mvhd = await findBox(fh, moov.contentStart, moov.end, 'mvhd');
    if (!mvhd) return null;

    /* mvhd payload: 1 byte version, 3 bytes flags, then the times. Version 0 uses 32-bit
       creation/modification/duration, version 1 uses 64-bit for all but the timescale. */
    const head = Buffer.alloc(4);
    await fh.read(head, 0, 4, mvhd.contentStart);
    const version = head[0];
    const body = Buffer.alloc(version === 1 ? 28 : 16);
    await fh.read(body, 0, body.length, mvhd.contentStart + 4);

    const timescale = version === 1 ? body.readUInt32BE(16) : body.readUInt32BE(8);
    let duration = version === 1 ? Number(body.readBigUInt64BE(20)) : body.readUInt32BE(12);
    if (!timescale) return null;
    /* 0xFFFFFFFF is the "unknown duration" marker fragmented files write */
    if (version === 0 && duration === 0xffffffff) duration = 0;

    /* A fragmented file (one with moof boxes, which is what MediaRecorder and some phones
       produce) leaves mvhd's duration at zero and puts the real total in mehd, inside mvex. */
    if (!duration) duration = (await readFragmentDuration(fh, moov)) ?? 0;
    if (!Number.isFinite(duration)) return null;

    const seconds = duration / timescale;
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  } finally {
    await fh?.close();
  }
}

/** moov > mvex > mehd carries the total length of a fragmented file, in the movie timescale. */
async function readFragmentDuration(fh: fs.FileHandle, moov: Box): Promise<number | null> {
  const mvex = await findBox(fh, moov.contentStart, moov.end, 'mvex');
  if (!mvex) return null;
  const mehd = await findBox(fh, mvex.contentStart, mvex.end, 'mehd');
  if (!mehd) return null;
  const buf = Buffer.alloc(12);
  const { bytesRead } = await fh.read(buf, 0, 12, mehd.contentStart);
  if (bytesRead < 8) return null;
  return buf[0] === 1 ? Number(buf.readBigUInt64BE(4)) : buf.readUInt32BE(4);
}

interface Box {
  contentStart: number;
  end: number;
}

/** Walk the boxes between `start` and `end` and return the first one of `type`. */
async function findBox(
  fh: fs.FileHandle,
  start: number,
  end: number,
  type: string,
): Promise<Box | null> {
  let offset = start;
  const header = Buffer.alloc(16);
  /* a sane ceiling: a real file has a handful of top-level boxes, not thousands */
  for (let guard = 0; guard < 1024 && offset + 8 <= end; guard += 1) {
    const { bytesRead } = await fh.read(header, 0, 16, offset);
    if (bytesRead < 8) return null;

    let size = header.readUInt32BE(0);
    const name = header.toString('latin1', 4, 8);
    let headerSize = 8;
    if (size === 1) {
      if (bytesRead < 16) return null;
      size = Number(header.readBigUInt64BE(8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset; // box runs to the end of the file
    }
    if (size < headerSize) return null; // malformed: would not advance

    if (name === type) return { contentStart: offset + headerSize, end: offset + size };
    offset += size;
  }
  return null;
}
