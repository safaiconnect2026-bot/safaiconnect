# Safai Connect — Full Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a fully working Safai Connect web app + Android APK — clean deps, all 5 roles active, all features wired to Firestore, build passing, deployed to Vercel.

**Architecture:** Layered sequential — Layer 1 (cleanup/build) → Layer 2 (roles) → Layer 3 (features) → Layer 4 (deployment) → Layer 5 (mobile). Each layer is independently testable before the next starts.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + Firebase (Auth/Firestore/Storage) + Capacitor 8 (Android) + Vercel (hosting)

---

## PRE-FLIGHT: What Already Works (Do NOT re-implement)
- `TrainingSystem.tsx` — fully wired to Firestore collection `training/{userId}`
- `CitizenDashboard` — GPS capture, multi-photo upload, voice (Web Speech API), ratings modal all implemented
- `ComplaintsTab` (Admin) — real-time Firestore, assignment modal, delete confirm
- `VerificationTab` (Admin) — reads `assignments` + `complaints`, approve/reject flow exists
- `WorkerDashboard` — tasks, attendance check-in/out, QR, evidence upload all wired
- `SignupPage` — role capitalisation mapping already correct (`roleMap`)
- `ReportsTab` — custom SVG charts, live Firestore data already wired

---

## LAYER 1 — Cleanup & Build Fix

### Task 1: Remove dead dependencies from package.json

**Files:**
- Modify: `package.json`

**Step 1: Edit package.json — remove 3 dead deps**

Remove these lines from `"dependencies"`:
```json
"@supabase/supabase-js": "^2.57.4",
"firebase-admin": "^13.6.1",
"next-pwa": "^5.6.0",
```

**Step 2: Run install to update lockfile**
```bash
npm install
```
Expected: No errors. `node_modules/@supabase`, `node_modules/firebase-admin`, `node_modules/next-pwa` should no longer exist.

Verify:
```bash
ls node_modules | grep supabase   # Should print nothing
ls node_modules | grep next-pwa   # Should print nothing
```

**Step 3: Commit**
```bash
git add package.json package-lock.json
git commit -m "chore: remove unused supabase, firebase-admin, next-pwa deps"
```

---

### Task 2: Delete the old firebase.js duplicate

**Files:**
- Delete: `src/firebase.js`

**Step 1: Delete the file**
```bash
rm "src/firebase.js"
```

**Step 2: Verify no imports reference it**
```bash
grep -r "from.*src/firebase" src/ --include="*.ts" --include="*.tsx"
grep -r "from.*'../firebase'" src/ --include="*.ts" --include="*.tsx"
grep -r "from.*'./firebase'" src/ --include="*.ts" --include="*.tsx"
```
Expected: All grep results should show `src/lib/firebase` not `src/firebase`.

**Step 3: Commit**
```bash
git add -A
git commit -m "chore: remove old unused src/firebase.js (duplicate config)"
```

---

### Task 3: Fix the lucide-react build error

The build fails with: `Could not resolve "./icons/git-branch-plus.js"` — this is a corrupted/mismatched node_modules install of lucide-react.

**Files:**
- Modify: `package.json` (version pin)

**Step 1: Update lucide-react to latest**
```bash
npm install lucide-react@latest
```

**Step 2: Attempt build**
```bash
npm run build
```
Expected: Build completes. If `git-branch-plus` error persists, do Step 3.

**Step 3 (if error persists): Force clean install**
```bash
rm -rf node_modules/lucide-react
npm install
npm run build
```
Expected: Build completes with `✓ built in Xs`

**Step 4: Commit**
```bash
git add package.json package-lock.json
git commit -m "fix: update lucide-react to fix git-branch-plus missing icon build error"
```

---

### Task 4: Add vercel.json for SPA routing

**Files:**
- Create: `vercel.json`

**Step 1: Create vercel.json**
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Step 2: Verify build still passes**
```bash
npm run build
```
Expected: `dist/` folder created, no errors.

**Step 3: Commit**
```bash
git add vercel.json
git commit -m "feat: add vercel.json for SPA client-side routing"
```

---

## LAYER 2 — Roles Fixed End-to-End

### Task 5: Add green-champion to UserRole type and App.tsx routing

**Files:**
- Modify: `src/App.tsx`

**Step 1: Update UserRole type** — already includes `'green-champion'`, confirm line 14:
```typescript
export type UserRole = 'superadmin' | 'admin' | 'green-champion' | 'worker' | 'citizen';
```
✓ Already correct. No change needed here.

**Step 2: Add import for GreenChampionDashboard in App.tsx**

Add after line 8 (`import CitizenDashboard...`):
```typescript
import GreenChampionDashboard from './components/dashboards/GreenChampionDashboard';
```

**Step 3: Add green-champion case to renderDashboard switch**

Change the switch in `renderDashboard()` from:
```typescript
const renderDashboard = () => {
  switch (activeUser.role) {
    case 'superadmin': return <SuperadminDashboard user={activeUser} onLogout={handleLogout} />;
    case 'admin':      return <AdminDashboard user={activeUser} onLogout={handleLogout} />;
    case 'worker':     return <WorkerDashboard user={activeUser} onLogout={handleLogout} />;
    default:           return <CitizenDashboard user={activeUser} onLogout={handleLogout} />;
  }
};
```
To:
```typescript
const renderDashboard = () => {
  switch (activeUser.role) {
    case 'superadmin':       return <SuperadminDashboard user={activeUser} onLogout={handleLogout} />;
    case 'admin':            return <AdminDashboard user={activeUser} onLogout={handleLogout} />;
    case 'worker':           return <WorkerDashboard user={activeUser} onLogout={handleLogout} />;
    case 'green-champion':   return <GreenChampionDashboard user={activeUser} onLogout={handleLogout} />;
    default:                 return <CitizenDashboard user={activeUser} onLogout={handleLogout} />;
  }
};
```

**Step 4: Run build to confirm no TypeScript errors**
```bash
npm run build
```

**Step 5: Commit**
```bash
git add src/App.tsx
git commit -m "feat: add green-champion role routing to App.tsx"
```

---

### Task 6: Create GreenChampionDashboard.tsx

**Files:**
- Create: `src/components/dashboards/GreenChampionDashboard.tsx`

**Step 1: Create the file with full content**

```typescript
import React, { useState, useEffect } from 'react';
import { Trophy, Star, Award, Leaf } from 'lucide-react';
import { User } from '../../App';
import CitizenDashboard from './CitizenDashboard';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface GreenChampionDashboardProps {
  user: User;
  onLogout: () => void;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  rewardPoints: number;
  role: string;
}

const GreenChampionBanner: React.FC<{ user: User }> = ({ user }) => {
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      orderBy('rewardPoints', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const entries: LeaderboardEntry[] = snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || 'Anonymous',
        rewardPoints: d.data().rewardPoints || 0,
        role: d.data().role || 'Citizen',
      }));
      const userRank = entries.findIndex(e => e.id === user.id) + 1;
      setRank(userRank > 0 ? userRank : null);
    });
    return () => unsub();
  }, [user.id]);

  return (
    <div className="bg-gradient-to-r from-green-600 to-emerald-500 text-white px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 rounded-full p-2">
          <Leaf className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-sm">Green Champion</p>
          <p className="text-green-100 text-xs">{user.name}</p>
        </div>
        <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
          <Award className="w-4 h-4 text-yellow-300" />
          <span className="text-xs font-semibold">Champion</span>
        </div>
      </div>
      <div className="text-right">
        {rank !== null && (
          <div className="flex items-center gap-1">
            <Trophy className="w-4 h-4 text-yellow-300" />
            <span className="font-bold text-sm">#{rank} Leaderboard</span>
          </div>
        )}
        <div className="flex items-center gap-1 mt-0.5">
          <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />
          <span className="text-xs">{user.preferences?.notifications !== undefined ? 'Active Champion' : 'Champion'}</span>
        </div>
      </div>
    </div>
  );
};

const GreenChampionDashboard: React.FC<GreenChampionDashboardProps> = ({ user, onLogout }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <GreenChampionBanner user={user} />
      <div className="flex-1">
        <CitizenDashboard user={user} onLogout={onLogout} />
      </div>
    </div>
  );
};

export default GreenChampionDashboard;
```

**Step 2: Run build**
```bash
npm run build
```
Expected: No TypeScript errors.

**Step 3: Commit**
```bash
git add src/components/dashboards/GreenChampionDashboard.tsx
git commit -m "feat: add GreenChampionDashboard with champion banner and leaderboard rank"
```

---

### Task 7: Add green-champion to SignupPage role selector

**Files:**
- Modify: `src/components/SignupPage.tsx`

**Step 1: Add green-champion to roleMap** (currently around line 34)

Change:
```typescript
const roleMap: Record<string, string> = {
    worker: 'Worker',
    citizen: 'Citizen',
    admin: 'Admin',
    superadmin: 'Superadmin'
};
```
To:
```typescript
const roleMap: Record<string, string> = {
    worker: 'Worker',
    citizen: 'Citizen',
    admin: 'Admin',
    superadmin: 'Superadmin',
    'green-champion': 'Green-Champion'
};
```

**Step 2: Find the role `<select>` dropdown in SignupPage JSX and add the option**

Find the `<select>` for role (search for `"select a role"` or `role` select). Add inside the select:
```tsx
<option value="green-champion">Green Champion</option>
```
alongside the existing options for citizen, worker, admin, superadmin.

**Step 3: Update AuthContext valid roles list** in `src/contexts/AuthContext.tsx` line 76:
```typescript
const validRoles = ['citizen', 'worker', 'admin', 'superadmin', 'green-champion'];
```
This already exists — confirm `green-champion` is already in the array. ✓

**Step 4: Run build**
```bash
npm run build
```

**Step 5: Commit**
```bash
git add src/components/SignupPage.tsx
git commit -m "feat: add green-champion option to signup role selector"
```

---

## LAYER 3 — Feature Activation

### Task 8: Wire reward points increment on complaint resolution

When an Admin approves work in `VerificationTab`, the complaint becomes `RESOLVED`. We need to increment the citizen's `rewardPoints` by 10.

**Files:**
- Modify: `src/components/dashboards/admin/VerificationTab.tsx`

**Step 1: Read the current approve handler in VerificationTab**

Find the function that sets complaint status to `RESOLVED` (likely called `handleApprove` or similar). It currently calls `updateDoc` on the complaint.

After the complaint status update, add a reward points increment. The complaint doc contains `citizenId`. Add this logic:

```typescript
// After updating complaint status to RESOLVED:
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

// Inside the approve handler, after complaint updateDoc:
try {
  const citizenRef = doc(db, 'users', entry.citizenId); // use citizenId from complaint
  await updateDoc(citizenRef, {
    rewardPoints: increment(10)
  });
} catch (e) {
  console.warn('Could not increment reward points:', e);
}
```

**Step 2: Ensure `increment` is imported from firebase/firestore**

At the top of `VerificationTab.tsx`, add `increment` to the existing firestore import:
```typescript
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
```

**Step 3: Read the full VerificationTab approve handler to find citizenId**

The `VerificationEntry` interface has `complaintId` and `workerId`. The complaint doc itself has `citizenId`. When approving, fetch citizenId from the stored entry data. The approve handler needs to get the citizenId from the complaint doc already fetched.

Add `citizenId?: string` to the `VerificationEntry` interface and populate it when building entries in the `useEffect`:
```typescript
interface VerificationEntry {
    assignmentId: string;
    complaintId: string;
    workerId: string;
    workerName: string;
    workerEmail: string;
    complaintTitle: string;
    complaintLocation: string;
    completedAt: any;
    evidenceImageUrl?: string;
    evidenceNotes?: string;
    complaintStatus: string;
    citizenId?: string;  // ADD THIS
}
```

And in the `useEffect` where entries are built, add:
```typescript
citizenId: complaint.citizenId || complaint.userId,
```

**Step 4: Run build**
```bash
npm run build
```
Expected: No errors.

**Step 5: Commit**
```bash
git add src/components/dashboards/admin/VerificationTab.tsx
git commit -m "feat: increment citizen rewardPoints by 10 on complaint resolution"
```

---

### Task 9: Add Notifications system

**Files:**
- Create: `src/contexts/NotificationContext.tsx`
- Create: `src/components/common/NotificationBell.tsx`
- Modify: `src/components/common/Layout.tsx`
- Modify: `src/components/dashboards/admin/VerificationTab.tsx`
- Modify: `src/components/dashboards/admin/ComplaintsTab.tsx`

**Step 1: Create NotificationContext.tsx**

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: string;
  userId: string;
  message: string;
  type: 'complaint_assigned' | 'complaint_resolved' | 'work_submitted' | 'general';
  read: boolean;
  createdAt: any;
  linkId?: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  addNotification: (userId: string, message: string, type: AppNotification['type'], linkId?: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  markAllRead: async () => {},
  addNotification: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!currentUser) { setNotifications([]); return; }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
    });
    return () => unsub();
  }, [currentUser]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    if (!currentUser) return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const addNotification = async (userId: string, message: string, type: AppNotification['type'], linkId?: string) => {
    await addDoc(collection(db, 'notifications'), {
      userId,
      message,
      type,
      read: false,
      createdAt: serverTimestamp(),
      ...(linkId ? { linkId } : {}),
    });
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};
```

**Step 2: Create NotificationBell.tsx**

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';

const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open && unreadCount > 0) markAllRead();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-emerald-600 font-medium">{unreadCount} new</span>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No notifications yet</div>
            ) : notifications.map(n => (
              <div key={n.id} className={`px-4 py-3 ${!n.read ? 'bg-emerald-50' : ''}`}>
                <p className="text-sm text-gray-800">{n.message}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : 'Just now'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
```

**Step 3: Add NotificationProvider to main.tsx**

In `src/main.tsx`, import and wrap with `NotificationProvider` inside `AuthProvider` (it needs auth context):

```typescript
import { NotificationProvider } from './contexts/NotificationContext';

// In the JSX tree, after AuthProvider:
<AuthProvider>
  <NotificationProvider>
    <ToastProvider>
      <App />
    </ToastProvider>
  </NotificationProvider>
</AuthProvider>
```

**Step 4: Add NotificationBell to Layout**

Read `src/components/common/Layout.tsx`. Find the header/topbar area where the user avatar or logout button sits. Import and add `<NotificationBell />` next to the user avatar.

```typescript
import NotificationBell from './NotificationBell';

// In the header JSX, alongside profile/logout:
<div className="flex items-center gap-2">
  <NotificationBell />
  {/* existing profile/logout buttons */}
</div>
```

**Step 5: Fire notification when complaint status changes to ASSIGNED**

In `src/components/dashboards/admin/ComplaintsTab.tsx`, in the assign handler (where `addDoc` to `assignments` happens), after assigning add:

```typescript
import { useNotifications } from '../../../contexts/NotificationContext';

// Inside component:
const { addNotification } = useNotifications();

// After successful assignment:
await addNotification(
  selectedWorkerId,
  `You have been assigned a new complaint: ${complaint.title || complaint.category}`,
  'complaint_assigned',
  selectedComplaintId
);
```

**Step 6: Fire notification when complaint resolved**

In `src/components/dashboards/admin/VerificationTab.tsx`, in the approve handler, after updating complaint to RESOLVED:
```typescript
const { addNotification } = useNotifications();

// After updating to RESOLVED:
await addNotification(
  entry.citizenId!,
  `Your complaint "${entry.complaintTitle}" has been resolved!`,
  'complaint_resolved',
  entry.complaintId
);
```

**Step 7: Run build**
```bash
npm run build
```

**Step 8: Commit**
```bash
git add src/contexts/NotificationContext.tsx src/components/common/NotificationBell.tsx src/main.tsx src/components/common/Layout.tsx src/components/dashboards/admin/ComplaintsTab.tsx src/components/dashboards/admin/VerificationTab.tsx
git commit -m "feat: add real-time notifications system with bell icon and Firestore backend"
```

---

### Task 10: Add Firestore index for notifications query

The notifications query uses `where('userId', ...) + orderBy('createdAt', ...)` which requires a composite index.

**Step 1: Add index to firestore.json (or create it manually in Firebase Console)**

Update `firebase.json`:
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

**Step 2: Create `firestore.indexes.json`**
```json
{
  "indexes": [
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Step 3: Commit**
```bash
git add firebase.json firestore.indexes.json
git commit -m "feat: add Firestore composite index for notifications query"
```

---

### Task 11: Create demo seed script

**Files:**
- Create: `scripts/seed-demo.ts`

**Step 1: Create seed script**

```typescript
/**
 * Seed script — creates one test user profile per role in Firestore.
 * Run: npx tsx scripts/seed-demo.ts
 *
 * IMPORTANT: This only creates Firestore user docs, NOT Firebase Auth accounts.
 * Create the Auth accounts manually in Firebase Console or use the app's signup
 * with these emails, then this script will upsert the correct role.
 *
 * Demo accounts:
 *   superadmin@demo.com  / Demo1234!
 *   admin@demo.com       / Demo1234!
 *   worker@demo.com      / Demo1234!
 *   citizen@demo.com     / Demo1234!
 *   champion@demo.com    / Demo1234!
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// NOTE: You need a service account key for this script.
// Download from Firebase Console → Project Settings → Service Accounts → Generate new private key
// Save as scripts/serviceAccountKey.json (this file is gitignored)

import serviceAccount from './serviceAccountKey.json';

initializeApp({ credential: cert(serviceAccount as any) });
const db = getFirestore();

const demoUsers = [
  { uid: 'demo-superadmin', email: 'superadmin@demo.com', name: 'Demo Superadmin', role: 'Superadmin' },
  { uid: 'demo-admin',      email: 'admin@demo.com',      name: 'Demo Admin',      role: 'Admin',     assignedZone: 'Zone A' },
  { uid: 'demo-worker',     email: 'worker@demo.com',     name: 'Demo Worker',     role: 'Worker',    assignedZone: 'Zone A' },
  { uid: 'demo-citizen',    email: 'citizen@demo.com',    name: 'Demo Citizen',    role: 'Citizen',   rewardPoints: 50 },
  { uid: 'demo-champion',   email: 'champion@demo.com',   name: 'Demo Champion',   role: 'Green-Champion', rewardPoints: 200 },
];

async function seed() {
  for (const user of demoUsers) {
    await db.collection('users').doc(user.uid).set({
      ...user,
      createdAt: new Date(),
      memberSince: new Date(),
      phone: '',
      address: '',
      citizenID: `CIT-DEMO-${user.role.toUpperCase()}`,
      preferences: { notifications: true, language: 'en' },
    }, { merge: true });
    console.log(`✓ Seeded: ${user.email} (${user.role})`);
  }
  console.log('\n✅ Seed complete. Create matching Firebase Auth accounts with password Demo1234!');
  process.exit(0);
}

seed().catch(console.error);
```

**Step 2: Add `scripts/serviceAccountKey.json` to .gitignore**
```bash
echo "scripts/serviceAccountKey.json" >> .gitignore
```

**Step 3: Add tsx as dev dep if not present**
```bash
npm install --save-dev tsx
```

**Step 4: Commit**
```bash
git add scripts/seed-demo.ts .gitignore
git commit -m "chore: add demo seed script for hackathon demo accounts"
```

---

## LAYER 4 — Deployment (Vercel)

### Task 12: Final build verification

**Step 1: Clean build**
```bash
rm -rf dist
npm run build
```
Expected output:
```
✓ 200+ modules transformed
dist/index.html    x.xx kB
dist/assets/...    xxx kB
✓ built in x.xxs
```
Zero errors, zero warnings about missing modules.

**Step 2: Local preview test**
```bash
npm run preview
```
Navigate to `http://localhost:4173` — verify:
- Landing page loads
- Login page works
- No console errors on load

**Step 3: Commit**
```bash
git add -A
git commit -m "chore: verify clean production build passes"
```

---

### Task 13: Deploy to Vercel

**Step 1: Install Vercel CLI if not present**
```bash
npm install -g vercel
```

**Step 2: Deploy**
```bash
vercel --prod
```
When prompted:
- Set up and deploy: `Y`
- Which scope: choose your account
- Link to existing project: `N` (first deploy)
- Project name: `safai-connect`
- Directory: `./` (root)
- Override build settings: `N` (Vercel auto-detects Vite)

**Step 3: Verify the live URL**
- Open the deployed URL
- Test login with a demo account
- Verify all routes work (no 404 on refresh — vercel.json handles this)

**Step 4: Set environment note**
Firebase config is hardcoded in `src/lib/firebase.ts` — no env vars needed for Vercel. (Post-hackathon, move to VITE_ env vars in Vercel dashboard.)

---

## LAYER 5 — Mobile (Android APK via Capacitor)

> **This is a dedicated mobile section. All steps below are purely for the Android build.**

### Task 14: Sync web build to Capacitor

**Files:**
- No source changes — just build commands

**Step 1: Ensure web build is current**
```bash
npm run build
```

**Step 2: Sync to Android project**
```bash
npx cap sync android
```
Expected: `✔ Copying web assets from dist to android/app/src/main/assets/public` + plugin sync messages.

**Step 3: Verify Android project exists**
```bash
ls android/app/src/main/
```
Expected: `assets/`, `java/`, `res/`, `AndroidManifest.xml`

---

### Task 15: Add Android permissions to AndroidManifest.xml

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`

**Step 1: Open AndroidManifest.xml and add permissions before `<application>` tag**

```xml
<!-- Camera -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />

<!-- Location -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Storage (for photo upload) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />

<!-- Internet (Firebase) -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

**Step 2: Commit**
```bash
git add android/app/src/main/AndroidManifest.xml
git commit -m "feat(mobile): add Android permissions for camera, location, storage, internet"
```

---

### Task 16: Configure capacitor.config.ts for production

**Files:**
- Modify: `capacitor.config.ts`

**Step 1: Update config with server allowNavigation for Firebase**

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.safaiconnect.app',
  appName: 'Safai Connect',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#10b981',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    Camera: {
      presentationStyle: 'fullscreen',
    },
  },
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
```

**Step 2: Re-sync after config change**
```bash
npx cap sync android
```

**Step 3: Commit**
```bash
git add capacitor.config.ts
git commit -m "feat(mobile): update Capacitor config with Android scheme and plugin settings"
```

---

### Task 17: Open in Android Studio and generate APK

**Step 1: Open Android Studio**
```bash
npx cap open android
```
Android Studio will open the `android/` folder as a Gradle project.

**Step 2: Wait for Gradle sync**
Bottom bar shows "Gradle sync in progress..." — wait until it finishes (1-3 min first time).

**Step 3: Build Debug APK (for testing)**
In Android Studio:
- Menu → `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
- Output: `android/app/build/outputs/apk/debug/app-debug.apk`

**Step 4: Install on test device**
```bash
# With device connected via USB (USB debugging enabled):
adb install android/app/build/outputs/apk/debug/app-debug.apk
```
Or use Android Studio's Run button (▶) with device selected.

**Step 5: Test checklist on device**
- [ ] App opens without crashing
- [ ] Login works (Firebase Auth over HTTPS)
- [ ] Camera permission prompt appears when filing complaint
- [ ] GPS permission prompt appears on complaint form
- [ ] Photos upload to Firebase Storage
- [ ] All 5 role dashboards render correctly

---

### Task 18: Create MOBILE.md documentation

**Files:**
- Create: `MOBILE.md`

**Step 1: Create MOBILE.md**

```markdown
# Safai Connect — Mobile Build Guide

## Overview
The Android app is built using **Capacitor 8** which wraps the web app into a native Android container.
App ID: `com.safaiconnect.app`

## Prerequisites
- [Android Studio](https://developer.android.com/studio) (latest stable)
- JDK 17+ (bundled with Android Studio)
- Android SDK 34
- USB debugging enabled on test device (or Android emulator)

## Build Steps

### 1. Build the web app
```bash
npm run build
```

### 2. Sync to Android
```bash
npx cap sync android
```
This copies `dist/` into the Android project and syncs Capacitor plugins.

### 3. Open in Android Studio
```bash
npx cap open android
```
Wait for Gradle sync to complete (~1-3 min).

### 4. Build Debug APK (for testing)
In Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### 5. Install on device
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### 6. Build Release APK (for distribution)
In Android Studio: **Build → Generate Signed Bundle/APK**
- Choose APK
- Create or use existing keystore
- Build type: Release
- Output: `android/app/build/outputs/apk/release/app-release.apk`

## Capacitor Plugins Used
| Plugin | Purpose |
|--------|---------|
| `@capacitor/camera` | Photo capture for complaints and work evidence |
| `@capacitor/geolocation` | GPS tagging on complaint photos |
| `@capacitor/core` | Core bridge between web and native |

## Android Permissions
| Permission | Reason |
|-----------|--------|
| `CAMERA` | Capture complaint/evidence photos |
| `ACCESS_FINE_LOCATION` | GPS tagging |
| `READ/WRITE_EXTERNAL_STORAGE` | Photo access (Android < 13) |
| `INTERNET` | Firebase connection |
| `ACCESS_NETWORK_STATE` | Offline detection |

## Updating the App
Whenever you change source code:
```bash
npm run build && npx cap sync android
```
Then rebuild in Android Studio.

## Troubleshooting
- **Gradle sync fails**: File → Invalidate Caches & Restart
- **Firebase connection fails on device**: Ensure `androidScheme: 'https'` in `capacitor.config.ts`
- **Camera not working**: Check permissions in device Settings → Apps → Safai Connect → Permissions
- **Build error "SDK not found"**: Android Studio → SDK Manager → install Android 14 (API 34)
```

**Step 2: Commit**
```bash
git add MOBILE.md
git commit -m "docs(mobile): add dedicated MOBILE.md build guide for Android APK"
```

---

## Final Checklist

Run through this before the hackathon demo:

### Web App
- [ ] `npm run build` — zero errors
- [ ] `npm run preview` — app loads at localhost:4173
- [ ] Superadmin login → sees live stats, can manage admins, inventory
- [ ] Admin login → can view complaints, assign to workers, verify work
- [ ] Worker login → sees assigned tasks, can mark complete with photo
- [ ] Citizen login → can file complaint (photo + GPS), track status, rate resolved complaints
- [ ] Green Champion login → sees champion banner + leaderboard rank + all citizen features
- [ ] Training modules completable for all roles, progress persists after refresh
- [ ] Notifications bell shows unread count, marks read on open
- [ ] Vercel deployment — all routes work, no 404 on refresh

### Android APK
- [ ] App installs and opens without crash
- [ ] Login works
- [ ] Camera permission prompt appears correctly
- [ ] GPS capture works on complaint form
- [ ] Photos upload to Firebase Storage
- [ ] All dashboards render on mobile screen size

---

## Notes
- Firebase config is hardcoded in `src/lib/firebase.ts` — acceptable for hackathon, move to env vars post-hackathon
- `scripts/seed-demo.ts` requires a Firebase Admin service account key — download from Firebase Console before running
- The `training` Firestore collection (not `training_progress`) is used by `TrainingSystem.tsx` — this is by design
- `green-champion` maps to `'Green-Champion'` in Firestore (capitalised with hyphen)
```
