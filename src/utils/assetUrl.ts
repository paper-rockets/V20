/**
 * Utility to resolve static asset paths against Vite's configured BASE_URL and document location.
 * Handles root-relative paths ('/models/...'), relative paths ('models/...', './models/...'),
 * passes through remote URLs (http, https, blob, data), and is completely idempotent.
 */
export function resolveAssetUrl(path: string): string {
  if (!path) return path;

  // Pass through absolute network or in-memory blob/data URLs
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('blob:') ||
    path.startsWith('data:')
  ) {
    return path;
  }

  const isDirectory = path.endsWith('/');
  // Strip leading slashes, dot-slashes, and redundant prefixes (makes it idempotent)
  const cleanPath = path.replace(/^(\.\/|\/)+/, '');

  // In browser environments (GitHub Pages, localhost, mobile browsers),
  // dynamically resolve against the document base URI to guarantee correct paths on subpaths
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    let pathname = window.location.pathname || '/';
    // If pathname ends with a file (e.g. /index.html), strip the file name
    if (/\/[^/]+\.[^/]+$/.test(pathname)) {
      pathname = pathname.replace(/\/[^/]+\.[^/]+$/, '/');
    } else if (!pathname.endsWith('/')) {
      pathname = `${pathname}/`;
    }
    const base = `${window.location.origin}${pathname}`;
    const resolved = new URL(cleanPath, base).href;
    return isDirectory && !resolved.endsWith('/') ? `${resolved}/` : resolved;
  }

  // Fallback for non-browser / SSR contexts
  const baseUrl = (import.meta as any).env?.BASE_URL || './';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const result = `${normalizedBase}${cleanPath}`;
  return isDirectory && !result.endsWith('/') ? `${result}/` : result;
}
