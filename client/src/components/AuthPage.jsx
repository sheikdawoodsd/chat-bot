import { useState } from 'react';
import {
  Sparkles,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { CosmicBackground } from './CosmicBackground';

export function AuthPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password validation checks
  const hasMinLength = password.length >= 6;
  const passwordsMatch = !isLogin && password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      if (!email.trim() || !password) {
        setError('Please enter both your email and password.');
        return;
      }

      setIsSubmitting(true);
      try {
        await login({ email: email.trim(), password });
      } catch (err) {
        setError(err.message || 'Login failed. Please check your credentials.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!fullName.trim() || fullName.trim().length < 2) {
        setError('Please enter your full name (at least 2 characters).');
        return;
      }
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Please provide a valid email address.');
        return;
      }
      if (!hasMinLength) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify your password.');
        return;
      }

      setIsSubmitting(true);
      try {
        await register({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        });
      } catch (err) {
        setError(err.message || 'Registration failed. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const switchMode = (mode) => {
    setIsLogin(mode);
    setError('');
  };

  return (
    <div className="min-h-screen w-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0A0A0F] text-[#1E1E24] dark:text-[#F3F4F6] relative overflow-x-hidden selection:bg-purple-500/30 selection:text-purple-300 transition-colors duration-300">
      {/* Animated Purple Cosmic Silk Waves (Image 1) */}
      <CosmicBackground />

      {/* Cosmic background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[360px] bg-purple-600/15 dark:bg-[#8B5CF6]/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[400px] h-[300px] bg-pink-500/10 dark:bg-pink-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Top Navbar */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 opacity-60 blur-xs group-hover:opacity-100 transition-opacity" />
            <img
              src="/logo.png"
              alt="Hi Nova! Planet Logo"
              className="relative w-9 h-9 rounded-full object-cover border border-purple-400/40"
            />
          </div>
          <div>
            <span className="font-bold text-lg text-gray-900 dark:text-white leading-none tracking-tight block">
              Hi Nova!
            </span>
            <span className="text-[11px] text-purple-600 dark:text-[#A78BFA] font-medium">
              Cosmic AI Assistant
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Form Center Box */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-md bg-white dark:bg-[#12121A] rounded-3xl p-8 sm:p-10 border border-gray-200/90 dark:border-[#232332] shadow-2xl purple-glow relative overflow-hidden transition-all">
          {/* Subtle top card glow line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500" />

          {/* Heading */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-500/10 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 mb-4 border border-purple-500/20 shadow-inner">
              <Sparkles className="w-7 h-7" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
              {isLogin
                ? 'Sign in to access your chats, files, and voice mode'
                : 'Get started instantly with your server-saved conversations'}
            </p>
          </div>

          {/* Mode Switcher Pills */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 dark:bg-[#1A1A26] rounded-2xl mb-6 border border-gray-200/70 dark:border-[#28283C]">
            <button
              type="button"
              onClick={() => switchMode(true)}
              className={`py-2 text-xs font-semibold rounded-xl transition-all ${
                isLogin
                  ? 'bg-white dark:bg-[#2A2A3E] text-purple-600 dark:text-purple-300 shadow-sm'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode(false)}
              className={`py-2 text-xs font-semibold rounded-xl transition-all ${
                !isLogin
                  ? 'bg-white dark:bg-[#2A2A3E] text-purple-600 dark:text-purple-300 shadow-sm'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Nova"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#181824] border border-gray-200 dark:border-[#2A2A3E] text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#181824] border border-gray-200 dark:border-[#2A2A3E] text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-gray-50 dark:bg-[#181824] border border-gray-200 dark:border-[#2A2A3E] text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {!isLogin && password && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-zinc-400">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      hasMinLength ? 'text-emerald-500' : 'text-gray-400 dark:text-zinc-600'
                    }`}
                  />
                  <span>At least 6 characters</span>
                </div>
              )}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-gray-50 dark:bg-[#181824] border border-gray-200 dark:border-[#2A2A3E] text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 p-0.5"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {confirmPassword && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                    {passwordsMatch ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-amber-600 dark:text-amber-400">Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isLogin ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? 'Sign In to Nova' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Note */}
          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-[#1E1E2E] text-center text-xs text-gray-500 dark:text-zinc-400">
            {isLogin ? (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => switchMode(false)}
                  className="font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Create one now
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode(true)}
                  className="font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-4 text-xs text-gray-400 dark:text-zinc-600 z-10">
        Hi Nova! AI Chatbot • Secured with 30-day session cookies & permanent cloud storage
      </footer>
    </div>
  );
}

