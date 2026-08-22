import { api } from './client';

/** The client's cap on story video, kept in step with STORY_MAX_VIDEO_SECONDS on the server. */
export const STORY_MAX_VIDEO_SECONDS = 60;
/** How long a still image is held before the viewer moves on. */
export const STORY_IMAGE_SECONDS = 5;

export interface StoryElement {
  kind: 'tag' | 'link' | 'text';
  x: number;
  y: number;
  rotation: number;
  scale: number;
  username?: string;
  url?: string;
  title?: string;
  text?: string;
  font?: 'gamer' | 'spacial' | 'classic' | 'base';
  color?: string;
}

export interface StoryOwner {
  id: string;
  usernameUrl: string | null;
  name: string | null;
  profilePicture: string | null;
  verified: boolean;
}

export interface Story {
  id: string;
  imageVideo: string;
  thumbnail: string | null;
  mediaType: 'image' | 'video';
  durationSeconds: number | null;
  elements: StoryElement[];
  createdAt: string;
  expiresAt: string;
}

/** One ringed avatar in the feed strip. */
export interface StripEntry {
  user: StoryOwner;
  count: number;
  latestAt: string;
  isSelf: boolean;
  viewerFollowing: boolean;
}

export async function fetchStoryStrip(): Promise<StripEntry[]> {
  const r = await api.get<{ data: { items: StripEntry[] } }>('/stories');
  return r.data.data.items;
}

export async function fetchUserStories(
  usernameUrl: string,
): Promise<{ user: StoryOwner; stories: Story[] }> {
  const r = await api.get<{ data: { user: StoryOwner; stories: Story[] } }>(
    `/stories/user/${encodeURIComponent(usernameUrl)}`,
  );
  return r.data.data;
}

export async function uploadStory(
  file: File,
  durationSeconds?: number,
  elements?: StoryElement[],
): Promise<void> {
  const form = new FormData();
  form.append('storyMedia', file);
  if (durationSeconds !== undefined) form.append('durationSeconds', String(durationSeconds));
  if (elements && elements.length > 0) form.append('elements', JSON.stringify(elements));
  /* the shared client defaults to application/json, which would send this body as a string
     and leave multer seeing no file at all — the same override add_post uses */
  await api.post('/stories', form, { headers: { 'Content-Type': 'multipart/form-data' } });
}

export async function deleteStory(id: string): Promise<void> {
  await api.delete(`/stories/${id}`);
}

export async function markStorySeen(id: string): Promise<void> {
  await api.post(`/stories/${id}/view`).catch(() => undefined);
}

/**
 * How long a clip runs, measured by the browser's own decoder before anything is uploaded.
 * The server checks the file again on arrival — this only spares the user a pointless upload
 * and gives an immediate answer.
 */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}
