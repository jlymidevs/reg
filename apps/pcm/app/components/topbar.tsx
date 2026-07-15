'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@jlycc/supabase/client';

export function Topbar({ title }: { title: string }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <header className="mb-6 flex items-center justify-between">
      <h1 className="font-heading text-2xl font-semibold text-[var(--pcm-text)]">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-gray-500 sm:block">{email}</span>
        <button
          onClick={() => void signOut()}
          className="cursor-pointer rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-sm font-medium text-[var(--pcm-text)] transition-colors duration-200 hover:bg-teal-50"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
