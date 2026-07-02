'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // shared session across *.jlycc.org subdomains
      cookieOptions:
        process.env.NODE_ENV === 'production' ? { domain: '.jlycc.org' } : undefined,
    }
  );
}
