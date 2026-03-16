import React, { useState } from 'react';
import { UserCheck, Leaf, ArrowLeft } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProfileSetupPage — shown when a user is authenticated in Firebase Auth
 * but has no matching Firestore users/{uid} document (or it has no role).
 *
 * This covers:
 *  - Accounts created directly in Firebase Console
 *  - Legacy accounts from before the Firestore schema was set up
 *  - Firestore permission errors (fallback)
 */
const ProfileSetupPage: React.FC = () => {
    const { currentUser } = useAuth();

    const [name, setName] = useState(currentUser?.displayName || '');
    const [role, setRole] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const roleOptions = [
        { value: 'Citizen',       label: '🏘️  Citizen',       desc: 'Report issues, track complaints, earn rewards' },
        { value: 'Worker',        label: '👷  Field Worker',   desc: 'View assigned tasks and submit completion evidence' },
        { value: 'Admin',         label: '📊  Admin',          desc: 'Manage complaints, workers, and zone operations' },
        { value: 'Superadmin',    label: '🛡️  Super Admin',    desc: 'Full platform oversight, inventory and reporting' },
        { value: 'Green-Champion',label: '🌿  Green Champion', desc: 'Community leader and eco-awareness ambassador' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        if (!name.trim()) { setError('Please enter your name.'); return; }
        if (!role)         { setError('Please select a role.'); return; }

        setIsLoading(true);
        setError('');

        try {
            await setDoc(doc(db, 'users', currentUser.uid), {
                uid: currentUser.uid,
                email: currentUser.email || '',
                name: name.trim(),
                role,
                createdAt: serverTimestamp(),
                memberSince: serverTimestamp(),
                ...(role === 'Citizen' && { rewardPoints: 0 }),
                phone: '',
                address: '',
                citizenID: `CIT-${Math.floor(Math.random() * 1_000_000)}`,
                assignedZone: '',
                preferences: { notifications: true, language: 'en' },
            });
            // onSnapshot in AuthContext will fire and set profileIncomplete = false
            // → App.tsx will re-render the correct dashboard automatically
        } catch (err: any) {
            console.error('[ProfileSetup] Error creating profile:', err);
            setError('Failed to save your profile. Please try again. (' + (err.message || 'unknown error') + ')');
            setIsLoading(false);
        }
    };

    const handleSignOut = async () => {
        await signOut(auth);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
                {/* Back button */}
                <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-emerald-600 transition-colors mb-6 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Login
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-emerald-100 p-3 rounded-xl">
                        <Leaf className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Complete Your Profile</h1>
                        <p className="text-sm text-gray-500">One-time setup to get started</p>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your full name"
                            required
                            className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-gray-900"
                        />
                    </div>

                    {/* Email (read-only) */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Email
                        </label>
                        <input
                            type="email"
                            value={currentUser?.email || ''}
                            readOnly
                            className="block w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
                        />
                    </div>

                    {/* Role */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Select Your Role
                        </label>
                        <div className="space-y-2">
                            {roleOptions.map((opt) => (
                                <label
                                    key={opt.value}
                                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                        role === opt.value
                                            ? 'border-emerald-500 bg-emerald-50'
                                            : 'border-gray-200 hover:border-emerald-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="role"
                                        value={opt.value}
                                        checked={role === opt.value}
                                        onChange={() => setRole(opt.value)}
                                        className="mt-0.5 accent-emerald-600"
                                    />
                                    <div>
                                        <p className="font-semibold text-sm text-gray-800">{opt.label}</p>
                                        <p className="text-xs text-gray-500">{opt.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !role || !name.trim()}
                        className="w-full bg-emerald-600 text-white font-bold py-3.5 px-6 rounded-xl hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <UserCheck className="w-5 h-5" />
                                Continue to Dashboard
                            </>
                        )}
                    </button>
                </form>

            </div>
        </div>
    );
};

export default ProfileSetupPage;
