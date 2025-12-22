import { API_BASE_URL } from './config';

/**
 * Convert what we store on the server (usually a short URL like /uploads/uuid.jpg)
 * into an URI that <Image/> can render.
 *
 * Backward compatible:
 * - full http(s) url
 * - data: uri
 * - local file/content uri
 * - legacy bare base64 (old builds)
 */
export function photoToImageUri(photoLink?: string | null): string {
  const s = (photoLink ?? '').trim();
  if (!s) return '';

  if (
    s.startsWith('data:') ||
    s.startsWith('file://') ||
    s.startsWith('content://') ||
    s.startsWith('asset:')
  ) {
    return s;
  }

  if (s.startsWith('http://') || s.startsWith('https://')) return s;

  // Legacy: a bare base64 string (no prefix). Heuristic: long and base64-ish.
  if (s.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(s)) {
    return `data:image/jpeg;base64,${s.replace(/\s+/g, '')}`;
  }

  // Relative path from API, e.g. /uploads/abc.jpg
  const base = API_BASE_URL.replace(/\/+$/, '');
  const path = s.startsWith('/') ? s : `/${s}`;
  return `${base}${path}`;
}

/**
 * Returns true if the uri is a local file that must be uploaded.
 */
export function isLocalPhotoUri(uri?: string | null): boolean {
  const s = (uri ?? '').trim();
  if (!s) return false;
  return s.startsWith('file://') || s.startsWith('content://');
}
