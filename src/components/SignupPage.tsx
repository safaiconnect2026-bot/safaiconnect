import React, { useState } from 'react';
import { UserPlus, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { UserRole } from '../App';
import { useLanguage } from '../contexts/LanguageContext';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { auth, db, googleProvider } from '../lib/firebase';

interface SignupPageProps {
    onSignupSuccess: (email: string) => void;
    onNavigateToLogin: () => void;
}

const SignupPage: React.FC<SignupPageProps> = ({ onSignupSuccess, onNavigateToLogin }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole | ''>('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { t } = useLanguage();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!role) {
            setError('Please select a role');
            setIsLoading(false);
            return;
        }

        // Store roles in capitalized form for consistent Firestore queries
        const roleMap: Record<string, string> = {
            worker: 'Worker',
            citizen: 'Citizen',
            admin: 'Admin',
            'zonal-admin': 'Zonal-Admin',
            superadmin: 'Superadmin',
            'green-champion': 'Green-Champion'
        };
        const firestoreRole = roleMap[role] || 'Citizen';
        console.log('📝 Signup: Saving role to Firestore:', { selectedRole: role, firestoreRole });

        try {
            // 1. Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Update display name in Auth profile
            await updateProfile(user, { displayName: name });

            // 3. Save extended user profile to Firestore BEFORE proceeding
            // This ensures the profile exists when auth state changes
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                name: name,
                role: firestoreRole,
                createdAt: serverTimestamp(),
                rewardPoints: 0,
                phone: '',
                address: '',
                citizenID: `CIT-${Math.floor(Math.random() * 1000000)}`,
                assignedZone: '',
                memberSince: serverTimestamp(),
                preferences: {
                    notifications: true,
                    language: 'en'
                }
            });

            // 4. Notify success only after Firestore write completes
            onSignupSuccess(email);
        } catch (err: any) {
            console.error('🔥 Detailed Signup Error:', err);

            // Critical: If auth succeeded but Firestore failed, we must sign out 
            // to prevent the app from landing in a half-logged-in state.
            try {
                await auth.signOut();
            } catch (signOutErr) {
                console.error('Sign out error after partial failure:', signOutErr);
            }

            // Translate common Firebase errors
            if (err.code === 'auth/email-already-in-use') {
                setError('User with this email already exists');
            } else if (err.code === 'auth/weak-password') {
                setError('Password is too weak. Please use at least 6 characters.');
            } else if (err.code === 'permission-denied') {
                setError('Database access denied. Your database is blocking the "' + firestoreRole + '" role. Please run the deployment command (see walkthrough.md) or update rules manually in Firebase Console.');
            } else {
                setError('Failed to create account profile. Error: ' + (err.message || 'Unknown error'));
            }
        } finally {
            setIsLoading(false);
        }
    }; // Missing closing bracket for handleSubmit

    const ROLE_MAP: Record<string, string> = {
        worker: 'Worker', citizen: 'Citizen', admin: 'Admin',
        superadmin: 'Superadmin', 'green-champion': 'Green-Champion'
    };

    // Handle redirect result on mount (mobile fallback)
    React.useEffect(() => {
        if (!role) return;
        const firestoreRole = ROLE_MAP[role] || 'Citizen';
        getRedirectResult(auth).then(async (result) => {
            if (!result) return;
            const user = result.user;
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                await setDoc(docRef, {
                    uid: user.uid, email: user.email,
                    name: user.displayName || 'Google User',
                    role: firestoreRole, createdAt: serverTimestamp(),
                    rewardPoints: 0, phone: '', address: '',
                    citizenID: `CIT-${Math.floor(Math.random() * 1000000)}`,
                    assignedZone: '', memberSince: serverTimestamp(),
                    preferences: { notifications: true, language: 'en' }
                });
            }
            onSignupSuccess(user.email || 'Google User');
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGoogleSignup = async () => {
        if (!role) {
            setError('Please select a role before signing up with Google.');
            return;
        }

        const firestoreRole = ROLE_MAP[role] || 'Citizen';
        setError('');
        setIsLoading(true);
        try {
            // On Capacitor native, popup doesn't work — use redirect
            if (Capacitor.isNativePlatform()) {
                await signInWithRedirect(auth, googleProvider);
                return;
            }

            const userCredential = await signInWithPopup(auth, googleProvider);
            const user = userCredential.user;

            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                await setDoc(docRef, {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || 'Google User',
                    role: firestoreRole,
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

            onSignupSuccess(user.email || 'Google User');
        } catch (err: any) {
            console.error('Google Signup Error:', err.code, err.message);
            if (err.code === 'auth/unauthorized-domain') {
                setError('This domain is not authorized for Google sign-in. Please contact support or use email/password.');
            } else if (err.code === 'auth/popup-blocked') {
                try { await signInWithRedirect(auth, googleProvider); }
                catch { setError('Popup was blocked. Please allow popups for this site and try again.'); }
            } else if (err.code === 'auth/popup-closed-by-user') {
                setError('Sign-up was cancelled. Please try again.');
            } else if (err.code === 'auth/cancelled-popup-request') {
                // ignore
            } else {
                setError(`Google sign-up failed (${err.code || 'unknown'}). Please try again.`);
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
                    src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=2626&q=80"
                    alt="Sustainable Future"
                    className="absolute inset-0 w-full h-full object-cover"
                />

                <div className="relative z-20 text-white p-12 max-w-lg">
                    <div className="flex items-center space-x-3 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="bg-white/20 p-2 rounded-2xl backdrop-blur-sm shadow-xl border border-white/10">
                            <img src="/logo.png" alt="Safai Connect Logo" className="w-auto h-12 object-contain drop-shadow-md" />
                        </div>
                    </div>

                    <h2 className="text-5xl font-bold leading-tight mb-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                        {t('join_movement')}
                    </h2>
                    <p className="text-lg text-emerald-100 mb-8 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        {t('create_account_subtitle')}
                    </p>

                    <div className="space-y-4 animate-in fade-in zoom-in duration-700 delay-300">
                        {[
                            t('real_time_tracking'),
                            t('role_based_dashboards'),
                            t('community_tools')
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-center space-x-3 text-emerald-50 bg-white/5 p-3 rounded-xl backdrop-blur-sm border border-white/5 hover:bg-white/10 transition-colors">
                                <CheckCircle className="w-5 h-5 text-emerald-400" />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-white overflow-y-auto max-h-screen">
                <div className="w-full max-w-md space-y-4 sm:space-y-5 animate-in slide-in-from-right duration-500 py-6">
                    <div className="text-center lg:text-left">
                        <button
                            onClick={onNavigateToLogin}
                            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-emerald-600 transition-colors mb-4 group"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                            {t('back_login')}
                        </button>
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('create_account')}</h2>
                        <p className="mt-1 text-sm text-gray-600">{t('enter_details_register')}</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-center animate-shake">
                            {error}
                        </div>
                    )}


                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={handleGoogleSignup}
                            disabled={isLoading}
                            className="w-full bg-white text-gray-700 font-semibold py-3 px-6 rounded-xl border border-gray-200 hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 transform transition-all duration-200 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Sign up with Google
                        </button>

                        <div className="relative flex items-center py-1">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-medium">OR</span>
                            <div className="flex-grow border-t border-gray-200"></div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('select_role')}</label>
                                <div className="relative">
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value as UserRole)}
                                        className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none appearance-none text-gray-900"
                                        required
                                    >
                                        <option value="">{t('choose_role')}</option>
                                        <option value="citizen">{t('role_citizen')}</option>
                                        <option value="worker">{t('role_worker')}</option>
                                        <option value="green-champion">Green Champion</option>
                                        <option value="admin">Admin</option>
                                        <option value="zonal-admin">Zonal Admin</option>
                                        <option value="superadmin">Super Admin</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('full_name')}</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-gray-900 placeholder-gray-400"
                                    placeholder="John Doe"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('email_address')}</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-gray-900 placeholder-gray-400"
                                    placeholder="john@example.com"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t('password')}</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full px-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-gray-900 placeholder-gray-400"
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
                            className="w-full bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-100 transform transition-all duration-200 shadow-lg hover:shadow-emerald-500/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <UserPlus className="w-5 h-5" />
                                    {t('create_account')}
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-sm text-gray-600">
                        {t('already_have_account')}{' '}
                        <button
                            onClick={onNavigateToLogin}
                            className="font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                            {t('sign_in_here')}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
