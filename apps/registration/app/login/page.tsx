'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@jlycc/supabase/client';

function LoginInner() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const [error, setError] = useState<string | null>(null);

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
    <div className="mx-auto mt-16 max-w-sm rounded-xl border bg-white p-8 text-center shadow-sm">
      <h1 className="mb-2 text-xl font-bold">Staff Sign In</h1>
      <p className="mb-6 text-sm text-gray-500">
        Scanner access for PCM staff, leaders, and admins.
      </p>
      <button
        onClick={signInWithGoogle}
        className="w-full rounded-lg bg-violet-700 px-4 py-3 font-semibold text-white hover:bg-violet-800"
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
