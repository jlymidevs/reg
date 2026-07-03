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
  UserCheck
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

  const navItems = [
    { name: 'Overview', path: '/admin', icon: LayoutDashboard },
    { name: 'Events', path: '/admin/events', icon: CalendarDays },
    { name: 'Registrations', path: '/admin/registrations', icon: Users },
    { name: 'Check-in', path: '/admin/check-in', icon: UserCheck },
    { name: 'Members', path: '/admin/members', icon: Users },
    { name: 'Users & Roles', path: '/admin/users-roles', icon: ShieldCheck },
    { name: 'Audit Log', path: '/admin/audit-logs', icon: FileClock },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="admin-shell min-h-screen flex bg-background">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white text-text h-screen sticky top-0 border-r border-border">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold flex items-center gap-2 text-primary">
            <img src="/logo.png" alt="JLYCC REG Logo" className="w-8 h-8 object-contain rounded-md" />
            Admin Panel
          </h1>
          <p className="text-muted text-xs mt-1 truncate">
            Event Registration
          </p>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                isActive(item.path)
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-text-muted hover:bg-secondary/50 hover:text-primary'
              }`}
            >
              <item.icon size={20} className={isActive(item.path) ? 'text-white' : 'text-text-muted group-hover:text-primary'} />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-4">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-text-muted hover:text-error hover:bg-error/10 rounded-xl transition-colors cursor-pointer font-medium text-sm"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-primary text-white z-50 px-4 flex items-center justify-between border-b border-primary-light">
        <h1 className="font-bold flex items-center gap-2">
          <img src="/logo.png" alt="JLYCC REG Logo" className="w-6 h-6 object-contain bg-white rounded-sm p-0.5" />
          Admin
        </h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-white/70 hover:text-white cursor-pointer">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-primary/95 backdrop-blur-sm pt-16">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-4 rounded-lg text-lg ${
                  isActive(item.path)
                    ? 'bg-primary-light text-white font-medium'
                    : 'text-white/70'
                }`}
              >
                <item.icon size={24} className={isActive(item.path) ? 'text-white' : 'text-white/50'} />
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
