import { 
  LayoutDashboard, 
  Inbox, 
  CalendarDays, 
  Users, 
  Clock, 
  TrendingUp, 
  CreditCard, 
  FileText, 
  Briefcase 
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Inbox, label: 'Inbox', path: '/inbox' },
  { icon: CalendarDays, label: 'Calendar', path: '/calendar' },
  { icon: Users, label: 'Employee', path: '/employee' },
  { icon: Clock, label: 'Attendance', path: '/attendance' },
  { icon: TrendingUp, label: 'Performance', path: '/performance' },
  { icon: CreditCard, label: 'Payroll', path: '/payroll' },
  { icon: FileText, label: 'Leave Management', path: '/leaves' },
  { icon: Briefcase, label: 'Recruitment', path: '/recruitment' },
];

export function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-surface border-r border-border/50 flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="h-20 flex items-center px-8 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl leading-none">T</span>
          </div>
          <span className="font-bold text-xl text-secondary">TeamHub</span>
        </div>
      </div>

      {/* Nav Links */}
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <nav className="space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-muted hover:bg-muted/10 hover:text-secondary'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Pro Banner */}
      <div className="p-4">
        <div className="bg-primary/10 rounded-2xl p-4 text-center">
          <h4 className="font-semibold text-secondary text-sm mb-2">Level Up Your HR System</h4>
          <p className="text-xs text-muted mb-4">TeamHub Pro gives you full control with advanced modules.</p>
          <button className="w-full bg-primary hover:bg-primary-light text-white text-sm font-medium py-2 rounded-lg transition-colors">
            Get TeamHub Pro
          </button>
        </div>
      </div>
    </aside>
  );
}
