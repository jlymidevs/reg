import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Search,
  Bell,
  ShieldCheck,
  FileClock,
  UserCheck,
  MessageSquareHeart,
  BarChart3,
  ChevronsUpDown,
  MapPin
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AdminLayout() {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const coreNavItems = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard },
    { name: 'Events', path: '/admin/events', icon: CalendarDays },
    { name: 'Registrations', path: '/admin/registrations', icon: Users },
    { name: 'Check-in', path: '/admin/check-in', icon: UserCheck },
    { name: 'Feedback', path: '/admin/feedback', icon: MessageSquareHeart },
    { name: 'Members', path: '/admin/members', icon: Users },
  ];

  const adminNavItems = [
    { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
    { name: 'Users & Roles', path: '/admin/users-roles', icon: ShieldCheck },
    { name: 'Audit Log', path: '/admin/audit-logs', icon: FileClock },
  ];

  const navItems = [...coreNavItems, ...adminNavItems];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="admin-shell min-h-screen flex bg-background">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0F172A] text-slate-200 h-screen sticky top-0">
        <button className="flex items-center gap-3 p-4 border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer text-left">
          <img src="/logo.png" alt="JLYCC REG Logo" className="w-9 h-9 object-contain rounded-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm truncate">JLYCC REG</p>
            <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
              <MapPin size={10} /> Event Registration
            </p>
          </div>
          <ChevronsUpDown size={14} className="text-slate-500 shrink-0" />
        </button>

        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-9 pr-12 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#22C55E]/50 focus:bg-white/10 transition-colors"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
              ctrlK
            </kbd>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {coreNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-lg transition-colors text-sm font-medium border-l-2 ${
                isActive(item.path)
                  ? 'bg-white/10 text-white border-[#22C55E]'
                  : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={18} className={isActive(item.path) ? 'text-[#22C55E]' : 'text-slate-500'} />
              {item.name}
            </Link>
          ))}

          <div className="my-3 border-t border-white/10" />

          {adminNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-lg transition-colors text-sm font-medium border-l-2 ${
                isActive(item.path)
                  ? 'bg-white/10 text-white border-[#22C55E]'
                  : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={18} className={isActive(item.path) ? 'text-[#22C55E]' : 'text-slate-500'} />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer font-medium text-sm"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#0F172A] text-white z-50 px-4 flex items-center justify-between border-b border-white/10">
        <h1 className="font-bold flex items-center gap-2">
          <img src="/logo.png" alt="JLYCC REG Logo" className="w-7 h-7 object-contain rounded-md" />
          JLYCC REG
        </h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400 hover:text-white cursor-pointer">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-[#0F172A] pt-16 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {coreNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-4 rounded-lg text-lg border-l-2 ${
                  isActive(item.path)
                    ? 'bg-white/10 text-white font-medium border-[#22C55E]'
                    : 'text-slate-400 border-transparent'
                }`}
              >
                <item.icon size={24} className={isActive(item.path) ? 'text-[#22C55E]' : 'text-slate-500'} />
                {item.name}
              </Link>
            ))}
            <div className="my-3 border-t border-white/10" />
            {adminNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-4 rounded-lg text-lg border-l-2 ${
                  isActive(item.path)
                    ? 'bg-white/10 text-white font-medium border-[#22C55E]'
                    : 'text-slate-400 border-transparent'
                }`}
              >
                <item.icon size={24} className={isActive(item.path) ? 'text-[#22C55E]' : 'text-slate-500'} />
                {item.name}
              </Link>
            ))}
            <div className="pt-8 mt-8 border-t border-white/10">
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 px-4 py-4 text-white text-lg cursor-pointer"
              >
                <LogOut size={24} />
                Sign Out
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen pt-16 md:pt-0 overflow-x-hidden">
        <header className="bg-white border-b border-border h-20 hidden md:flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 text-text-muted text-sm font-medium flex-1">
            <div className="relative w-full max-w-md hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
            <span className="lg:hidden">{navItems.find(item => isActive(item.path))?.name}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/" target="_blank" className="text-sm font-medium text-text-muted hover:text-primary flex items-center gap-1 transition-colors">
              <ExternalLink size={16} /> <span className="hidden xl:inline">Public Site</span>
            </Link>
            <button className="relative p-2 text-text-muted hover:text-primary transition-colors bg-background rounded-full">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-border">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
                A
              </div>
              <div className="hidden xl:block">
                <p className="text-sm font-bold text-text leading-tight">Admin User</p>
                <p className="text-xs text-text-muted">Administrator</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
