'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@jlycc/supabase/client';

function LoginInner() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const authError = params.get('error');
  const [error, setError] = useState<string | null>(
    authError === 'auth' ? 'Sign-in did not complete. Please try again.' : null
  );

  async function signInWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) setError(error.message);
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-3xl border border-teal-100 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--pcm-primary)] font-heading text-lg font-bold text-white">
        PC
      </div>
      <h1 className="mt-5 font-heading text-2xl font-semibold text-[var(--pcm-text)]">PCM Staff Sign In</h1>
      <p className="mt-3 text-sm text-gray-500">
        Continue with Google to access member care dashboards, follow-up queues, and weekly reports.
      </p>
      <button
        onClick={signInWithGoogle}
        className="mt-6 w-full rounded-xl bg-[var(--pcm-primary)] px-4 py-3 font-semibold text-white transition-colors duration-200 hover:bg-[var(--pcm-primary-light)]"
      >
        Continue with Google
      </button>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
