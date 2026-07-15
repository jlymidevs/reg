'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-teal-100 bg-white px-4 py-6 sm:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--pcm-primary)] font-heading text-sm font-bold text-white">
          PC
        </div>
        <span className="font-heading text-lg font-semibold text-[var(--pcm-text)]">PCM Portal</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                active
                  ? 'bg-[var(--pcm-primary)] text-white'
                  : 'text-gray-500 hover:bg-teal-50 hover:text-[var(--pcm-text)]'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
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
