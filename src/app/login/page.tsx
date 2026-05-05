'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../store/auth.store';
import { Eye, EyeOff, ShoppingBag, Loader2, Lock, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [error,    setError]      = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(username.trim(), password);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Invalid username or password';
      setError(msg);
      toast.error(msg);
    }
  }

  const fillDemo = (u: string, p: string) => { setUsername(u); setPassword(p); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-emerald-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl shadow-2xl shadow-emerald-500/30 mb-4">
            <ShoppingBag size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">FreshMart</h1>
          <p className="text-gray-400 text-sm mt-1">Retail Operating System</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-gray-400 text-sm mb-6">Sign in to your account</p>

          {error && (
            <div className="mb-5 flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
              <Lock size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Username</label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username" required autoFocus
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password" required
                  className="w-full pl-11 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading || !username || !password}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2">
              {isLoading ? <><Loader2 size={16} className="animate-spin" />Signing in…</> : 'Sign In →'}
            </button>
          </form>

          {/* Demo users */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-xs text-gray-500 text-center mb-3">Demo accounts</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Admin',    u: 'admin',    p: 'admin123',   color: 'emerald' },
                { label: 'Manager',  u: 'manager',  p: 'manager123', color: 'blue' },
                { label: 'Cashier',  u: 'cashier',  p: 'cash123',    color: 'amber' },
              ].map(d => (
                <button key={d.u} type="button" onClick={() => fillDemo(d.u, d.p)}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-all text-center">
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          FreshMart POS © 2026 · Kuwait
        </p>
      </div>
    </div>
  );
}
