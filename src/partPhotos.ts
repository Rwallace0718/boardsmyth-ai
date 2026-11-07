/** Customer photos of their own boards and parts, kept on this computer only and shown in the wiring picture. */
const KEY = 'bsPartPhotos';
const MAX_SAVED = 24;

export const boardPhotoKey = (boardName: string) => `board:${boardName.trim().toLowerCase()}`;
export const partPhotoKey = (label: string) => `part:${label.trim().toLowerCase()}`;

export function loadPartPhotos(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function savePartPhotos(map: Record<string, string>): void {
  try {
    const keys = Object.keys(map);
    const trimmed: Record<string, string> = {};
    // Keep the newest photos when the list grows too long (insertion order).
    for (const k of keys.slice(-MAX_SAVED)) trimmed[k] = map[k];
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full or blocked: the photo still shows until the window closes */
  }
}

/** Shrinks a photo to a small JPEG so many of them fit in storage. */
export async function shrinkPhoto(source: Blob | HTMLVideoElement): Promise<string> {
  const isVideo = !(source instanceof Blob);
  const w = isVideo ? (source as HTMLVideoElement).videoWidth : 0;
  const h = isVideo ? (source as HTMLVideoElement).videoHeight : 0;
  const bitmap = isVideo ? null : await createImageBitmap(source as Blob);
  const sw = bitmap ? bitmap.width : w;
  const sh = bitmap ? bitmap.height : h;
  if (!sw || !sh) throw new Error('Empty picture');
  const scale = Math.min(1, 480 / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext('2d')!.drawImage((bitmap ?? source) as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.75);
}
