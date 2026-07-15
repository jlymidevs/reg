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
        <main className="min-h-screen px-4 py-7 sm:px-8 lg:px-10">{children}</main>
      </div>
    </>
  );
}
