import { Outlet, Link } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-text">
      <header className="bg-white border-b border-border sticky top-0 z-40 shadow-sm transition-all">
        <div className="container py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/logo.png" alt="JLYCC REG Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-primary leading-tight">JLYCC REG</h1>
            </div>
          </Link>
          
          <div className="flex items-center gap-6">
            <Link to="/admin/login" className="text-sm font-medium text-muted hover:text-primary transition-colors">
              Admin Login
            </Link>
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        <Outlet />
      </main>
      
      <footer className="bg-primary text-white py-12 border-t border-primary-light">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="JLYCC REG Logo" className="w-8 h-8 object-contain" />
              <span className="font-bold">JLYCC REG</span>
            </div>
            
            <div className="text-blue-200 text-sm text-center md:text-right">
              <p>&copy; {new Date().getFullYear()} Event Registration Platform. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
