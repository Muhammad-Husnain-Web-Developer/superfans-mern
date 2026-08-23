import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { StoryElement } from '../../api/stories';
import { assetImage, videoMime } from '../../utils/format';
import { isFieldColour, storyTextStyle } from './textStyle';
import '../../styles/story-editor.css';

/** The mockup writes "Max.11" above the search box. */
const MAX_TAGS = 11;
/** "Text of maximum 65 characters..." */
const MAX_TEXT = 65;
/** The three chip colours offered for a link, sampled from Pas 3. */
const LINK_COLOURS = ['#00a8f3', '#0ed145', '#ffffff'];
/** The six text colours, in the mockup's own order: white, black, red, pink, yellow, purple. */
const TEXT_COLOURS = ['#ffffff', '#000000', '#ec1c24', '#ffaec8', '#fff200', '#5e3af1'];
const FONTS: { key: StoryElement['font']; label: string }[] = [
  { key: 'gamer', label: 'Gamer' },
  /* the client replaced the mockup's "Spacial" with Anton, the Google face */
  { key: 'anton', label: 'Anton' },
  { key: 'classic', label: 'Classic' },
  { key: 'base', label: 'Base' },
];

type Pop = 'tag' | 'link' | 'text' | null;

interface TagHit {
  name: string;
  verified?: boolean;
  profilePicture?: string | null;
}

/**
 * Pas 3 and Pas 4: the chosen file on a 9:16 canvas, the three tools down its right, and
 * whatever the author drops on top — a tagged handle, a link chip, a line of text — each
 * draggable and rotatable by the handles that appear above it.
 *
 * Positions are kept as a fraction of the canvas rather than pixels, so a story composed on
 * a phone shows the same arrangement in a viewer of any size.
 */
export function StoryEditor({
  file,
  elements,
  onChange,
  onPublish,
  busy,
}: {
  file: File;
  elements: StoryElement[];
  onChange: (next: StoryElement[]) => void;
  onPublish: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation('stories');
  const [preview, setPreview] = useState('');
  const [pop, setPop] = useState<Pop>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  /* tag popup */
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<TagHit[]>([]);
  /* link popup */
  const [url, setUrl] = useState('https://www.');
  const [title, setTitle] = useState('');
  const [linkColour, setLinkColour] = useState(LINK_COLOURS[0]);
  /* text popup */
  const [text, setText] = useState('');
  const [font, setFont] = useState<StoryElement['font']>('gamer');
  const [colour, setColour] = useState(TEXT_COLOURS[0]);

  const isVideo = file.type.startsWith('video/');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .get<{ data: TagHit[] }>(`/users/search/influencers?query=${encodeURIComponent(q)}`)
        .then((r) => setHits(r.data.data.slice(0, 8)))
        .catch(() => setHits([]));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const add = useCallback(
    (element: StoryElement) => {
      onChange([...elements, element]);
      setPop(null);
    },
    [elements, onChange],
  );

  const update = useCallback(
    (index: number, patch: Partial<StoryElement>) => {
      onChange(elements.map((el, i) => (i === index ? { ...el, ...patch } : el)));
    },
    [elements, onChange],
  );

  /* Drag moves the element; the rotate handle turns it about its own centre. Both run off
     pointer events so a finger and a mouse take the same path. */
  function startDrag(e: React.PointerEvent, index: number) {
    e.stopPropagation();
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box) return;
    setSelected(index);
    const move = (ev: PointerEvent) => {
      const x = Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width));
      const y = Math.min(1, Math.max(0, (ev.clientY - box.top) / box.height));
      update(index, { x, y });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function startRotate(e: React.PointerEvent, index: number) {
    e.stopPropagation();
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box) return;
    const el = elements[index];
    const cx = box.left + el.x * box.width;
    const cy = box.top + el.y * box.height;
    const move = (ev: PointerEvent) => {
      const deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
      update(index, { rotation: Math.round(deg) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /* perceived brightness of the chosen colour, so a pale one can be shown on a dark field */
  const light = (() => {
    const n = parseInt(colour.slice(1), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6;
  })();

  const tagCount = elements.filter((el) => el.kind === 'tag').length;

  return (
    <>
      <div className="story-editor">
        <div className="story-canvas" ref={canvasRef} onPointerDown={() => setSelected(null)}>
          {preview &&
            (isVideo ? (
              <video src={preview} muted autoPlay loop playsInline>
                <source src={preview} type={videoMime(file.name)} />
              </video>
            ) : (
              <img src={preview} alt="" />
            ))}

          {elements.map((el, i) => (
            <div
              key={i}
              className="story-item"
              style={{
                left: `${el.x * 100}%`,
                top: `${el.y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
              }}
              onPointerDown={(e) => startDrag(e, i)}
            >
              {selected === i && (
                <div className="story-item-handles">
                  <button
                    type="button"
                    className="story-handle rotate"
                    title={t('rotate')}
                    onPointerDown={(e) => startRotate(e, i)}
                  >
                    🔄
                  </button>
                  {el.kind === 'text' && (
                    <button
                      type="button"
                      className="story-handle"
                      title={t('edit_text')}
                      onClick={(e) => {
                        e.stopPropagation();
                        setText(el.text ?? '');
                        setFont(el.font ?? 'gamer');
                        setColour(el.color ?? TEXT_COLOURS[0]);
                        onChange(elements.filter((_, j) => j !== i));
                        setPop('text');
                      }}
                    >
                      ▭
                    </button>
                  )}
                  {/* the bin belongs to every element, not only the text one — a tagged
                      handle and a link chip have to come off the canvas too */}
                  <button
                    type="button"
                    className="story-handle"
                    title={t('remove')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(elements.filter((_, j) => j !== i));
                      setSelected(null);
                    }}
                  >
                    <i class="fa fa-trash"></i>
                  </button>
                </div>
              )}

              {el.kind === 'tag' && (
                <span className="story-chip">
                  <span className="dot" />@{el.username}
                </span>
              )}

              {el.kind === 'link' && (
                <span className="story-chip" style={{ background: el.color }}>
                  🔗 {el.title || el.url}
                </span>
              )}
              {el.kind === 'text' && (
                <div className={`story-text-box font-${el.font ?? 'gamer'}`} style={storyTextStyle(el.color)}>
                  {el.text}
                </div>
              )}
            </div>
          ))}

          {/* ---- Tag User (Pas 3, "Search Influencer") ---- */}
          {pop === 'tag' && (
            <div className="story-pop search" onPointerDown={(e) => e.stopPropagation()}>
              <span className="story-max">{t('max', { count: MAX_TAGS })}</span>
              <input
                className="story-field"
                placeholder={`🔎 ${t('search_user')}`}
                value={query}
                autoFocus
                onChange={(e) => setQuery(e.target.value)}
              />
              {hits.length > 0 && (
                <ul className="story-suggestions">
                  {hits.map((h) => (
                    <li
                      key={h.name}
                      onClick={() => {
                        if (tagCount >= MAX_TAGS) return;
                        setQuery('');
                        add({ kind: 'tag', username: h.name, x: 0.5, y: 0.25, rotation: 0, scale: 1 });
                      }}
                    >
                      {h.profilePicture ? (
                        <img className="avatar" src={assetImage(h.profilePicture)} alt="" />
                      ) : (
                        <span className="avatar" />
                      )}
                      <span className="handle">@{h.name}</span>
                      {h.verified && (
                        <img className="tick" src={assetImage('verified.png')} alt="Verified" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ---- Add Link ---- */}
          {pop === 'link' && (
            <div className="story-pop" onPointerDown={(e) => e.stopPropagation()}>
              <input
                className="story-field"
                value={url}
                autoFocus
                onChange={(e) => setUrl(e.target.value)}
              />
              <input
                className="story-field"
                placeholder={`🔗 ${t('url_title')}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="story-pop-row">
                <div className="story-swatches">
                  {LINK_COLOURS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`story-swatch${linkColour === hex ? ' on' : ''}`}
                      style={{ background: hex }}
                      onClick={() => setLinkColour(hex)}
                      aria-label={hex}
                    />
                  ))}
                </div>
                <span className="story-pop-spacer" />
                <button
                  type="button"
                  className="story-accept"
                  disabled={!url.trim()}
                  onClick={() => {
                    add({
                      kind: 'link',
                      url: url.trim(),
                      title: title.trim(),
                      color: linkColour,
                      x: 0.5,
                      y: 0.7,
                      rotation: 0,
                      scale: 1,
                    });
                    setUrl('https://www.');
                    setTitle('');
                  }}
                >
                  {t('accept')}
                </button>
              </div>
            </div>
          )}

          {/* ---- Add Text ---- */}
          {pop === 'text' && (
            <div className="story-pop" onPointerDown={(e) => e.stopPropagation()}>
              <textarea
                /* on-dark only for the pale inks that would vanish on the white field; the
                   two neutrals bring their own field with them */
                className={`story-field story-textarea font-${font}${light && !isFieldColour(colour) ? ' on-dark' : ''}`}
                style={storyTextStyle(colour)}
                placeholder={t('text_placeholder', { max: MAX_TEXT })}
                maxLength={MAX_TEXT}
                value={text}
                autoFocus
                onChange={(e) => setText(e.target.value)}
              />
              <div className="story-pop-row">
                <div className="story-fonts">
                  {FONTS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      className={`story-font ${f.key}${font === f.key ? ' on' : ''}`}
                      onClick={() => setFont(f.key)}
                    >
                      {t('font')}
                      <br />
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="story-colours">
                  {TEXT_COLOURS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      className={`story-colour${colour === hex ? ' on' : ''}`}
                      style={{ background: hex }}
                      onClick={() => setColour(hex)}
                      aria-label={hex}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="story-accept"
                  disabled={!text.trim()}
                  onClick={() => {
                    add({ kind: 'text', text: text.trim(), font, color: colour, x: 0.5, y: 0.5, rotation: 0, scale: 1 });
                    setText('');
                  }}
                >
                  {t('accept')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="story-tools">
          {/* the mockup breaks these over two lines; letting them wrap on their own keeps
              that shape in English and still fits a longer word in another language */}
          <button type="button" className="story-tool" onClick={() => setPop(pop === 'tag' ? null : 'tag')}>
            {t('tag_user')}
          </button>
          <button type="button" className="story-tool" onClick={() => setPop(pop === 'link' ? null : 'link')}>
            {t('add_link')}
          </button>
          <button type="button" className="story-tool" onClick={() => setPop(pop === 'text' ? null : 'text')}>
            {t('add_text')}
          </button>
        </div>
      </div>

      <button type="button" className="story-publish" onClick={onPublish} disabled={busy}>
        <span>✎</span>
        <span style={{ marginLeft: 2 }}>{busy ? t('posting') : t('publish')}</span>
      </button>
    </>
  );
}
