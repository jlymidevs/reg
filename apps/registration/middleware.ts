import { updateSession } from '@jlycc/supabase/middleware';
import type { NextRequest } from 'next/server';

// scanner tooling stays auth-gated even though /events/* is public
const PROTECTED = [/^\/scanner(\/|$)/, /^\/events\/[^/]+\/(scan|manual)(\/|$)/, /^\/my-/];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((r) => r.test(path));
  return updateSession(request, {
    publicPaths: isProtected ? ['/login', '/auth'] : ['/login', '/auth', '/', '/events', '/register'],
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
