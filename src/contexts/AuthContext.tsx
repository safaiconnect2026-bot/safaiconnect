import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { normalizeRoleForRouting } from '../lib/roles';

// Extended user profile stored in Firestore
export interface UserProfile {
    uid: string;
    email: string;
    name: string;
    role: string;
    area?: string;
    rewardPoints?: number;
    createdAt?: any;
    phone?: string;
    address?: string;
    citizenID?: string;
    assignedZone?: string;
    zoneId?: string;
    cityId?: string;
    wardId?: string;
    memberSince?: any;
    preferences?: {
        notifications?: boolean;
        language?: string;
    };
}

interface AuthContextType {
    currentUser: FirebaseUser | null;
    userProfile: UserProfile | null;
    loading: boolean;
    noDocument: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Role normalization is handled by normalizeRoleForRouting() from src/lib/roles.ts.

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [noDocument, setNoDocument] = useState(false);

    useEffect(() => {
        let unsubscribeProfile: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            // Clean up previous profile listener if any
            if (unsubscribeProfile) {
                unsubscribeProfile();
                unsubscribeProfile = null;
            }

            if (user) {
                // Set initial loading state for profile
                setLoading(true);
                setNoDocument(false);

                // Start listening to the user profile document
                const docRef = doc(db, 'users', user.uid);
                let documentSeenOnce = false;
                unsubscribeProfile = onSnapshot(docRef,
                    (docSnap: any) => {
                        let firestoreData: any = null;
                        if (docSnap.exists()) {
                            firestoreData = docSnap.data();
                            setNoDocument(false);
                            documentSeenOnce = true;
                            console.log('✅ User document found in Firestore:', { uid: user.uid, data: firestoreData });
                        } else if (!documentSeenOnce) {
                            // First snapshot: doc doesn't exist yet.
                            // SignupPage writes the profile with the chosen role — give it
                            // time to land before we overwrite with a default Citizen profile.
                            documentSeenOnce = true; // prevent duplicate auto-creates
                            console.warn('⏳ User document not found, waiting for signup write...');

                            setTimeout(async () => {
                                try {
                                    // Re-check: SignupPage may have written the doc by now
                                    const { getDoc: gd, setDoc: sd, serverTimestamp: st } = await import('firebase/firestore');
                                    const freshSnap = await gd(docRef);
                                    if (freshSnap.exists()) {
                                        console.log('✅ Profile appeared after wait — signup write landed.');
                                        // onSnapshot will pick it up; nothing to do.
                                        return;
                                    }

                                    // Still missing — this is likely a direct login for a user
                                    // whose profile was deleted. Create a safe default.
                                    console.warn('⚠️ Still no profile after wait — auto-creating Citizen profile.');
                                    await sd(docRef, {
                                        uid: user.uid,
                                        email: user.email || '',
                                        name: user.displayName || (user.email?.split('@')[0] ?? 'User'),
                                        role: 'Citizen',
                                        createdAt: st(),
                                        memberSince: st(),
                                        rewardPoints: 0,
                                        phone: '',
                                        address: '',
                                        citizenID: `CIT-${user.uid.slice(-6).toUpperCase()}`,
                                        assignedZone: '',
                                        preferences: { notifications: true, language: 'en' },
                                    });
                                    console.log('✅ Auto-created Citizen profile for:', user.uid);
                                } catch (err: unknown) {
                                    console.error('[AuthContext] Auto-create profile failed:', err);
                                    setNoDocument(true);
                                    setLoading(false);
                                }
                            }, 2000); // wait 2s for SignupPage's setDoc to land
                            return; // onSnapshot will fire when the doc appears
                        } else {
                            console.error('❌ NO USER DOCUMENT in Firestore for:', user.uid, user.email);
                            setNoDocument(true);
                        }

                        // ── Normalize role — handle all known formats ─────────────────
                        // e.g. 'Admin', 'SUPER_ADMIN', 'green-champion', 'worker' all work
                        const rawRole = String(firestoreData?.role || '').toLowerCase();
                        const resolvedRole = normalizeRoleForRouting(rawRole);

                        // Dev-mode visibility: log role resolution so routing bugs are obvious
                        if (import.meta.env.DEV) {
                            console.log(
                                `[AuthContext] uid=${user.uid} | firestoreRole="${firestoreData?.role}" ` +
                                `→ rawRole="${rawRole}" → resolvedRole="${resolvedRole}"`
                            );
                        }

                        setUserProfile({
                            uid: user.uid,
                            email: user.email || '',
                            name: firestoreData?.name || user.displayName || 'User',
                            role: resolvedRole,
                            area: firestoreData?.area,
                            rewardPoints: firestoreData?.rewardPoints,
                            createdAt: firestoreData?.createdAt,
                            phone: firestoreData?.phone,
                            address: firestoreData?.address,
                            citizenID: firestoreData?.citizenID,
                            assignedZone: firestoreData?.assignedZone,
                            zoneId: firestoreData?.zoneId,
                            cityId: firestoreData?.cityId,
                            wardId: firestoreData?.wardId,
                            memberSince: firestoreData?.memberSince,
                            preferences: firestoreData?.preferences
                        });
                        setLoading(false);
                    },
                    (error: any) => {
                        console.error("Error listening to user profile:", error);
                        // Fallback - use lowercase for consistency
                        setUserProfile({
                            uid: user.uid,
                            email: user.email || '',
                            name: user.displayName || 'User',
                            role: 'citizen',
                        });
                        setLoading(false);
                    }
                );
            } else {
                setUserProfile(null);
                setNoDocument(false);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
        };
    }, []);

    const value = {
        currentUser,
        userProfile,
        loading,
        noDocument,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
