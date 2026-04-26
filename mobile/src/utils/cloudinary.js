/**
 * Fixes Cloudinary URLs that 403 on Android (ExoPlayer).
 * - Rewrites /image/upload/ → /video/upload/ for mistyped resource paths
 * - Strips query strings (signed/expiring params cause 403 on Android)
 */
export function toStreamableUri(uri) {
  if (!uri || !uri.includes('cloudinary.com')) return uri;
  try {
    let url = uri.replace('/image/upload/', '/video/upload/');
    const qIdx = url.indexOf('?');
    if (qIdx !== -1) url = url.slice(0, qIdx);
    return url;
  } catch {
    return uri;
  }
}
