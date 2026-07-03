import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  LogOut, 
  Menu, 
  X,
  ExternalLink
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
    { name: 'Members', path: '/admin/members', icon: Users },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-primary text-white h-screen sticky top-0 border-r border-primary-light">
        <div className="p-6 border-b border-primary-light">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <img src="/logo.png" alt="JLYCC REG Logo" className="w-8 h-8 object-contain bg-white rounded-md p-1" />
            Admin Panel
          </h1>
          <p className="text-blue-200 text-xs mt-1 truncate">
            Event Registration
          </p>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-primary-light text-white font-medium shadow-md'
                  : 'text-blue-200 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={20} className={isActive(item.path) ? 'text-secondary' : 'text-blue-300'} />
              {item.name}
            </Link>
          ))}
        </nav>
        
        <div className="p-4 border-t border-primary-light">
          <div className="mb-4 px-4 py-3 bg-white/5 rounded-lg border border-white/10">
            <p className="text-xs text-blue-200 mb-1">Logged in as</p>
            <p className="text-sm font-medium truncate" title="Admin">Admin User</p>
          </div>
          <button 
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-4 py-2 text-blue-200 hover:text-error hover:bg-white/5 rounded-lg transition-colors"
          >
            <LogOut size={20} />
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
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-blue-200 hover:text-white">
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
                    : 'text-blue-200'
                }`}
              >
                <item.icon size={24} className={isActive(item.path) ? 'text-secondary' : 'text-blue-300'} />
                {item.name}
              </Link>
            ))}
            <div className="pt-8 mt-8 border-t border-primary-light">
              <button 
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 px-4 py-4 text-error text-lg"
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
        <header className="bg-white border-b border-border h-16 hidden md:flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="text-muted text-sm font-medium">
            {navItems.find(item => isActive(item.path))?.name}
          </div>
          <Link to="/" target="_blank" className="text-sm font-medium text-secondary hover:text-primary-light flex items-center gap-1 transition-colors">
            View Public Site <ExternalLink size={14} />
          </Link>
        </header>
        
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
