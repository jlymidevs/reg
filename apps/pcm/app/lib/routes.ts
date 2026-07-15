export function isBareRoute(pathname: string) {
  return pathname === '/login' || pathname.startsWith('/auth');
}
