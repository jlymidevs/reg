export function buildFlashPath(path: string, tone: 'success' | 'error', message: string) {
  const url = new URL(path, 'http://pcm.local');
  url.searchParams.set('flash', tone);
  url.searchParams.set('message', message);
  return `${url.pathname}${url.search}`;
}
