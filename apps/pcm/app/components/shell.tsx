'use client';

import { usePathname } from 'next/navigation';
import { isBareRoute } from '../lib/routes';
import { Sidebar } from './sidebar';

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = isBareRoute(pathname);

  if (bare) return <main className="min-h-screen">{children}</main>;

  return (
    <>
      <Sidebar />
      <div className="sm:pl-60">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">{children}</main>
      </div>
    </>
  );
}
