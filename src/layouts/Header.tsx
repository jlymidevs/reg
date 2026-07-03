import { Search, Bell, Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export function Header() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentPage = pathParts.length > 0 
    ? pathParts[pathParts.length - 1].charAt(0).toUpperCase() + pathParts[pathParts.length - 1].slice(1) 
    : 'Dashboard';

  return (
    <header className="h-20 bg-surface border-b border-border/50 flex items-center justify-between px-8 sticky top-0 z-10">
      {/* Breadcrumbs & Title */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted mb-1">
          <span>Dashboard</span>
          {currentPage !== 'Dashboard' && (
            <>
              <span>/</span>
              <span className="text-secondary font-medium">{currentPage}</span>
            </>
          )}
        </div>
        <h1 className="text-2xl font-bold text-secondary">{currentPage}</h1>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input 
            type="text" 
            placeholder="Search anything" 
            className="pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-muted hover:text-secondary hover:bg-muted/10 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <button className="relative w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-muted hover:text-secondary hover:bg-muted/10 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-surface"></span>
          </button>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-6 border-l border-border/50 cursor-pointer">
          <img 
            src="https://ui-avatars.com/api/?name=Davis+Lavin&background=0F172A&color=fff" 
            alt="User avatar" 
            className="w-10 h-10 rounded-full"
          />
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-secondary">Davis Lavin</p>
            <p className="text-xs text-muted">Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}
