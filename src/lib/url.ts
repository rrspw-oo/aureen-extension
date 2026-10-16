export function normalizePageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith('utm_')) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Short human label for where an item came from: the site's host for web pages, the app name
 * for desktop sources (`aureen-app://Notes`), and nothing for a plain desktop screenshot.
 */
export function sourceHost(url: string): string {
  if (!url) return '';
  const app = /^aureen-app:\/\/([^/?#]+)/.exec(url);
  if (app) {
    try {
      return decodeURIComponent(app[1]);
    } catch {
      return app[1];
    }
  }
  if (url.startsWith('aureen://')) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
