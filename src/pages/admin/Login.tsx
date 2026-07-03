import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Mail, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading, authError, signIn, signInWithGoogle } = useAuth();

  if (authLoading) {
    return (
      <div className="admin-shell min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-primary font-medium">Verifying access...</div>
      </div>
    );
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const result = await signInWithGoogle();
    if (!result.ok) {
      setError(result.message || 'Google sign-in failed');
      setLoading(false);
    }
    // On success the browser redirects to Google — no further handling here
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn(email, password);
      if (result.ok) {
        navigate('/admin', { replace: true });
      } else {
        setError(result.message || 'Failed to sign in');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-shell min-h-screen flex items-center justify-center bg-background p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/5 rounded-full blur-3xl"></div>

      <div className="card w-full max-w-md p-8 relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h2 className="text-3xl font-bold text-primary">Admin Access</h2>
          <p className="text-muted mt-2">Sign in to manage your events and registrations</p>
        </div>

        {(error || authError) && (
          <div className="mb-6 p-4 bg-error/10 border border-error/20 text-error rounded-md text-sm text-center">
            {error || authError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="form-group mb-0">
            <label className="label" htmlFor="email">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="input pl-10"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group mb-0">
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="input pl-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full mt-6"
            disabled={loading}
          >
            {loading ? 'Verifying access...' : 'Sign In'} <ArrowRight size={18} className="ml-1" />
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border"></div>
          <span className="text-xs text-muted uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-border"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="btn w-full border border-border bg-white text-text hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center gap-3"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-muted hover:text-primary transition-colors cursor-pointer"
          >
            &larr; Back to Public Website
          </button>
        </div>
      </div>
    </div>
  );
}
