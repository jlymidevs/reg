'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@jlycc/supabase/client';

const NAV = [
  { href: '/', label: 'Dashboard', icon: DashboardIcon },
  { href: '/members', label: 'Members', icon: MembersIcon },
  { href: '/watchlist', label: 'Watchlist', icon: WatchlistIcon },
  { href: '/journey-approvals', label: 'Journey Approvals', icon: ApprovalIcon },
  { href: '/followups', label: 'Follow-ups', icon: FollowupIcon },
  { href: '/reports/weekly', label: 'Weekly Report', icon: ReportIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = '/login';
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-slate-200 bg-white px-0 py-7 sm:flex">
      <div className="mb-8 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#198f91] font-serif text-xl font-bold text-white shadow-sm">
          PCM
        </div>
        <p className="mt-4 font-serif text-xl font-semibold text-[#176f76]">PCM</p>
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">D-Journey CRM</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                active
                  ? 'bg-[#e2f2f2] text-slate-900'
                  : 'text-slate-600 hover:bg-[#eef8f7] hover:text-[#176f76]'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-2 mt-5 rounded-2xl bg-[#299496] p-4 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-50">User role</p>
        <p className="mt-2 font-serif text-xl">Super Admin</p>
      </div>
      <div className="mt-5 flex items-center gap-3 px-5 pb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#299496] font-semibold text-white">AD</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">JLYMI Admin</p>
          <p className="truncate text-xs text-[#20aaa0]">jlymi.devs@gmail.com</p>
        </div>
      </div>
      <button onClick={() => void signOut()} className="mt-5 flex items-center gap-3 px-5 text-sm font-semibold text-[#a5cf39] hover:text-[#79a817]">
        <span className="text-lg">↪</span> Sign Out
      </button>
    </aside>
  );
}

function iconProps(className?: string) {
  return {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
function MembersIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M15.5 14c2.6.3 4.5 2.6 4.5 6" />
    </svg>
  );
}
function WatchlistIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M12 9v4l2.5 2.5" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
function ApprovalIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function FollowupIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M21 11.5a8.5 8.5 0 1 1-3.6-6.9" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}
function ReportIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M4 19V6a2 2 0 0 1 2-2h7l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M13 4v5h5M8 13h8M8 17h5" />
    </svg>
  );
}
