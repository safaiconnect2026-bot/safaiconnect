import React, { useState } from 'react';
import { LogIn, ArrowLeft, ShieldCheck, Mail, Lock, Zap, Eye, EyeOff } from 'lucide-react';
import { User } from '../App';
import { useLanguage } from '../contexts/LanguageContext';
import { signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { auth, googleProvider } from '../lib/firebase';
import LanguageSwitcher from './common/LanguageSwitcher';

interface LoginPageProps {
  onLogin: (user: User) => void;
  onNavigateToSignup: () => void;
  onBack: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onNavigateToSignup, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Wait for AuthContext's onAuthStateChanged to pick this up.
      // We pass a stub User object since App.tsx expects one until we fully migrate it out of props.
      onLogin({
        id: userCredential.user.uid,
        email: userCredential.user.email || '',
        name: userCredential.user.displayName || 'User',
        role: 'citizen' // this gets overridden by AuthContext anyway
      });

    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else {
        setError('Failed to log in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle redirect result on mount (for mobile/popup-blocked fallback)
  React.useEffect(() => {
    getRedirectResult(auth).then(async (result) => {
      if (!result) return;
      const user = result.user;
      const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, {
          uid: user.uid, email: user.email,
          name: user.displayName || 'Google User',
          role: 'Citizen', createdAt: serverTimestamp(),
          rewardPoints: 0, phone: '', address: '',
          citizenID: `CIT-${Math.floor(Math.random() * 1000000)}`,
          assignedZone: '', memberSince: serverTimestamp(),
          preferences: { notifications: true, language: 'en' }
        });
      }
      onLogin({ id: user.uid, email: user.email || '', name: user.displayName || 'User', role: 'citizen' });
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      // On Capacitor native, popup doesn't work — use redirect
      if (Capacitor.isNativePlatform()) {
        await signInWithRedirect(auth, googleProvider);
        return; // result handled by getRedirectResult on next load
      }

      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;

      const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          uid: user.uid,
          email: user.email,
          name: user.displayName || 'Google User',
          role: 'Citizen',  // capitalized to match Firestore schema
          createdAt: serverTimestamp(),
          rewardPoints: 0,
          phone: '',
          address: '',
          citizenID: `CIT-${Math.floor(Math.random() * 1000000)}`,
          assignedZone: '',
          memberSince: serverTimestamp(),
          preferences: { notifications: true, language: 'en' }
        });
      }

      onLogin({ id: user.uid, email: user.email || '', name: user.displayName || 'User', role: 'citizen' });
    } catch (err: any) {
      console.error('Google Login Error:', err.code, err.message);
      if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for Google sign-in. Please contact support or use email/password login.');
      } else if (err.code === 'auth/popup-blocked') {
        // Fallback to redirect
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch {
          setError('Popup was blocked. Please allow popups for this site and try again.');
        }
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // ignore — another popup was opened
      } else {
        setError(`Google sign-in failed (${err.code || 'unknown'}). Please try again.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans transition-colors duration-300">
      {/* Left Side - Image & Branding */}
      <div className="hidden lg:flex w-1/2 bg-emerald-900 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/90 to-teal-900/90 z-10 mixture-blend-multiply"></div>
        <img
          src="https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
          alt="Clean City"
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="relative z-20 text-white p-12 max-w-lg space-y-6">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <img src="/logo.png" alt="Safai Connect Logo" className="w-auto h-12 object-contain block mix-blend-screen" />
          </div>

          <h2 className="text-5xl font-bold leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            {t('welcome_back')}
          </h2>
          <p className="text-lg text-emerald-100 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            {t('login_subtitle')}
          </p>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl animate-in fade-in zoom-in duration-700 delay-300">
            <div className="flex items-start space-x-4">
              <ShieldCheck className="w-8 h-8 text-emerald-300 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-lg mb-1">{t('secure_reliable')}</h4>
                <p className="text-sm text-emerald-100/80">{t('secure_msg')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 bg-white">
        <div className="w-full max-w-md space-y-6 sm:space-y-8 animate-in slide-in-from-right duration-500">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <button
                onClick={onBack}
                className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-emerald-600 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                {t('back_home')}
              </button>
              <LanguageSwitcher />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('sign_in')}</h2>
            <p className="mt-2 text-sm sm:text-base text-gray-600">{t('enter_details')}</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-center animate-shake">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full bg-white text-gray-700 font-bold py-3.5 px-6 rounded-xl border border-gray-200 hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 transform transition-all duration-200 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Log in with Google
            </button>
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium">OR</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('email_address')}</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-gray-900 placeholder-gray-400"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('password')}</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-gray-900 placeholder-gray-400"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-emerald-500 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 text-white font-bold py-4 px-6 rounded-xl hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-100 transform transition-all duration-200 shadow-lg hover:shadow-emerald-500/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {t('sign_in')}
                </>
              )}
            </button>
          </form>

          {/* ── Quick Demo Access ─────────────────────────────────────────── */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-sm font-bold text-amber-800">{t('quick_demo')}</span>
            </div>
            <p className="text-xs text-amber-600 mb-3">Click a role to auto-fill demo credentials, then press Sign In.</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { role: 'Citizen',       email: 'citizen@demo.com',    icon: '🏘️', cls: 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100' },
                { role: 'Worker',        email: 'worker@demo.com',     icon: '👷', cls: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100' },
                { role: 'Admin',         email: 'admin@demo.com',      icon: '📊', cls: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100' },
                { role: 'Super Admin',   email: 'superadmin@demo.com', icon: '🛡️', cls: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100' },
                { role: 'Champion',      email: 'champion@demo.com',   icon: '🌿', cls: 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100' },
                { role: 'Zonal Admin',   email: 'zonaladmin@demo.com', icon: '🏢', cls: 'bg-cyan-50 border-cyan-200 text-cyan-800 hover:bg-cyan-100' },
              ].map(d => (
                <button
                  key={d.role}
                  type="button"
                  onClick={() => { setEmail(d.email); setPassword('Demo@1234'); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-semibold transition-colors ${d.cls}`}
                >
                  <span>{d.icon}</span>
                  <span>{d.role}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-amber-500 mt-2 text-center">
              Password: <code className="bg-amber-100 px-1 rounded font-mono">Demo@1234</code> · Set up these accounts in Firebase first
            </p>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-center text-sm text-gray-600">
              {t('dont_have_account')}{' '}
              <button
                onClick={onNavigateToSignup}
                className="font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                {t('sign_up_now')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;