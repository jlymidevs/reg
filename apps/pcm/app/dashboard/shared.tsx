import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-serif text-3xl text-[#147f84]">{title}</h1><p className="mt-1 text-sm font-medium text-[#22b8a4]">{subtitle}</p></div>{action}</header>;
}

export function LegacyCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_5px_rgba(15,23,42,0.06)] ${className}`}>{children}</section>;
}

export function TealButton({ children }: { children: ReactNode }) {
  return <button className="rounded-xl bg-[#299496] px-4 py-2 text-sm font-semibold text-white hover:bg-[#147f84]">{children}</button>;
}
