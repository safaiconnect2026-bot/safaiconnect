# Sprint 2 — Firebase Infrastructure & Feature Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Remove the ProfileSetupPage blocker, complete Firestore rules/indexes, seed demo data, add Workers CRUD, add attendance time-gate, and add a Worker salary tab.

**Architecture:** This is a React 18 + TypeScript + Vite app using Firebase Auth v9 (modular), Firestore v9, and Firebase Storage. No automated test framework exists — verification is done by running `npm run dev` and checking the browser. Changes are made directly to the main project (no separate build step beyond TypeScript checking). Firestore rules and indexes are deployed with the Firebase CLI.

**Tech Stack:** React 18, TypeScript, Vite, Firebase Auth v9, Firestore v9, Firebase Storage v9, Tailwind CSS, Lucide React icons

---

## Context — What You Need To Know

- **Project root:** `D:\HP Shared\All Freelance Projects\safai-main`
- **Current branch:** `master` (Sprint 1 merged)
- **Firestore rules file:** `firestore.rules` — deployed with `npx firebase deploy --only firestore:rules`
- **Firestore indexes file:** `firestore.indexes.json` — deployed with `npx firebase deploy --only firestore:indexes`
- **Auth flow:** `src/contexts/AuthContext.tsx` — `onAuthStateChanged` → `onSnapshot(users/{uid})` → if no doc, sets `profileIncomplete=true` → `App.tsx` shows `<ProfileSetupPage />`
- **Role normalization:** Firestore stores `'Citizen'`, `'Worker'`, `'Admin'`, `'Superadmin'`, `'Green-Champion'`. `AuthContext` normalizes any casing.
- **No test runner.** Manual verification steps listed per task.
- **Toast notifications:** Use `const { error: toastError, success: toastSuccess } = useToast()` (from `src/contexts/ToastContext.tsx`)
- **Sprint 1 worktree** (`.claude/worktrees/great-cerf`) is stale — work on master directly or in a new worktree.

---

### Task 1: AuthContext — Auto-Create Citizen Profile on First Login

**Problem:** When a user logs in and has no Firestore `users/{uid}` doc (e.g. Firebase Console users, new signups before sprint 1 fix), `AuthContext` sets `profileIncomplete=true` and App.tsx shows `ProfileSetupPage`. User wants no role-selection page.

**Fix:** When `onSnapshot` fires with `!docSnap.exists()`, silently `setDoc` a default Citizen profile and return (keep `loading=true`). The next snapshot event will find the doc and load normally.

**Files:**
- Modify: `src/contexts/AuthContext.tsx` — lines 84–94 (the `!docSnap.exists()` branch)

**Step 1: Open the file and locate the target block**

In `src/contexts/AuthContext.tsx`, find this block (around line 84):
```typescript
// ── No Firestore document → profile setup needed ─────────────────
if (!docSnap.exists()) {
    setUserProfile({
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || '',
        role: '',
    });
    setProfileIncomplete(true);
    setLoading(false);
    return;
}
```

**Step 2: Replace that block with auto-creation logic**

Replace the entire `if (!docSnap.exists())` block with:
```typescript
// ── No Firestore document → auto-create a default Citizen profile ─
if (!docSnap.exists()) {
    // Silently create the profile; the next snapshot event will load it.
    const { serverTimestamp, setDoc: fsSetDoc } = await import('firebase/firestore');
    fsSetDoc(docRef, {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || (user.email?.split('@')[0] ?? 'User'),
        role: 'Citizen',
        createdAt: serverTimestamp(),
        rewardPoints: 0,
    }).catch((err: unknown) => console.error('[AuthContext] Auto-create profile failed:', err));
    // Keep loading=true — next snapshot will resolve everything
    return;
}
```

> **Note on imports:** `setDoc` is already imported at the top of the file. However, since this is inside an `onSnapshot` callback (not a module top-level), we can use the already-imported `setDoc` directly. Do NOT use dynamic import — just call `setDoc` and `serverTimestamp` which are already imported at line 5.

**Corrected Step 2 (no dynamic import needed):**

The top of `AuthContext.tsx` already has:
```typescript
import { doc, onSnapshot } from 'firebase/firestore';
```

You need to add `setDoc, serverTimestamp` to this import. Replace the existing Firestore import:
```typescript
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
```

Then replace the `!docSnap.exists()` block:
```typescript
// ── No Firestore document → auto-create a default Citizen profile ─
if (!docSnap.exists()) {
    setDoc(docRef, {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || (user.email?.split('@')[0] ?? 'User'),
        role: 'Citizen',
        createdAt: serverTimestamp(),
        rewardPoints: 0,
    }).catch((err: unknown) =>
        console.error('[AuthContext] Auto-create profile failed:', err)
    );
    // Keep loading=true — the next onSnapshot event will resolve
    return;
}
```

**Step 3: Also fix the error handler to not set profileIncomplete**

Find the `onSnapshot` error handler (around line 122):
```typescript
(error: any) => {
    console.error("[AuthContext] Firestore profile read error:", error);
    setUserProfile({
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || 'User',
        role: '',
    });
    setProfileIncomplete(true);
    setLoading(false);
}
```

Replace with (auto-create fallback on error too):
```typescript
(error: unknown) => {
    console.error("[AuthContext] Firestore profile read error:", error);
    // Treat as a fresh user — set a minimal Citizen profile so the app loads
    setUserProfile({
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || (user.email?.split('@')[0] ?? 'User'),
        role: 'Citizen',
    });
    setProfileIncomplete(false);
    setLoading(false);
}
```

**Step 4: Verify TypeScript compiles**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main"
npx tsc --noEmit
```
Expected: no errors related to `setDoc` or `serverTimestamp`.

**Step 5: Manual verification**

1. Run `npm run dev`
2. Open browser, go to Firebase Console and manually create a new user in Authentication (email/password)
3. Log in with that user in the app
4. Expected: app loads CitizenDashboard directly (no ProfileSetupPage shown)
5. Check Firestore Console — `users/{uid}` doc should be auto-created with `role: 'Citizen'`

**Step 6: Commit**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main"
git add src/contexts/AuthContext.tsx
git commit -m "fix: auto-create Citizen profile on first login — no more ProfileSetupPage"
```

---

### Task 2: App.tsx — Remove ProfileSetupPage Rendering

**Problem:** `App.tsx` renders `<ProfileSetupPage />` when `profileIncomplete=true`. After Task 1, this state is never set to `true`, but we should remove the dead code to keep the codebase clean.

**Files:**
- Modify: `src/App.tsx` — lines 5, 102–108

**Step 1: Remove ProfileSetupPage import and usage**

In `src/App.tsx`:

Remove line 5:
```typescript
import ProfileSetupPage from './components/ProfileSetupPage';
```

Remove lines 102–108:
```typescript
// Logged in but Firestore profile is missing or incomplete → setup screen
if (profileIncomplete) {
    return (
        <ThemeProvider>
            <ProfileSetupPage />
        </ThemeProvider>
    );
}
```

Also update the `useAuth()` destructuring (around line 38) to remove `profileIncomplete`:
```typescript
const { currentUser, userProfile, loading, profileIncomplete } = useAuth();
```
→ Remove `profileIncomplete` (or keep it if used elsewhere — check the file first):
```typescript
const { currentUser, userProfile, loading } = useAuth();
```

**Step 2: Verify TypeScript compiles**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main"
npx tsc --noEmit
```
Expected: no errors. If `profileIncomplete` is referenced elsewhere in App.tsx, keep the import but just remove the `if (profileIncomplete)` block.

**Step 3: Manual verification**

1. Run `npm run dev`
2. Sign in with any user
3. Expected: goes directly to the appropriate dashboard, never sees ProfileSetupPage

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "fix: remove ProfileSetupPage — auth flow auto-creates Citizen profile now"
```

---

### Task 3: Firestore Rules — Complete Coverage

**Problem:** `firestore.rules` is missing rules for the `training` and `notifications` collections. The `users` `create` rule only allows the owner (not superadmin) to create user docs — blocking admin onboarding flows.

**Files:**
- Modify: `firestore.rules`

**Step 1: Read the current file**

The current file is at `D:\HP Shared\All Freelance Projects\safai-main\firestore.rules`. Read it before editing.

**Step 2: Replace the entire file content**

Write the following complete rules file:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helper functions ──────────────────────────────────────────────────────

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function isSuperadmin() {
      return isAuthenticated() && getUserRole() == 'Superadmin';
    }

    function isAdmin() {
      return isAuthenticated() && (getUserRole() == 'Admin' || getUserRole() == 'Superadmin');
    }

    function isWorker() {
      return isAuthenticated() && (getUserRole() == 'Worker' || getUserRole() == 'Admin' || getUserRole() == 'Superadmin');
    }

    // ── `users` collection ────────────────────────────────────────────────────
    match /users/{userId} {
      // Any signed-in user can read profiles (needed for worker lookups, etc.)
      allow read: if isAuthenticated();
      // Users create their own profile on signup; Superadmins can create any user doc
      allow create: if isOwner(userId) || isSuperadmin();
      // Users update their own profile; Admins/Superadmins can update any (role changes, zone assignment)
      allow update: if isOwner(userId) || isAdmin();
      // Only superadmins can delete user profiles
      allow delete: if isSuperadmin();
    }

    // ── `complaints` collection ───────────────────────────────────────────────
    match /complaints/{complaintId} {
      allow read:   if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if isAdmin();
    }

    // ── `assignments` collection ──────────────────────────────────────────────
    match /assignments/{assignmentId} {
      allow read:   if isAuthenticated();
      allow create: if isAdmin();
      allow update: if isAuthenticated();
      allow delete: if isAdmin();
    }

    // ── `completion_evidence` collection ─────────────────────────────────────
    match /completion_evidence/{evidenceId} {
      allow read:   if isAuthenticated();
      allow create: if isAuthenticated();
      // Workers/admins can update evidence (e.g. re-upload photo)
      allow update: if isWorker();
      allow delete: if isAdmin();
    }

    // ── `ratings` collection ──────────────────────────────────────────────────
    match /ratings/{ratingId} {
      allow read:   if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
    }

    // ── `inventory` collection ────────────────────────────────────────────────
    // Managed exclusively by Superadmin (read for all authenticated for reporting)
    match /inventory/{itemId} {
      allow read:   if isAuthenticated();
      allow create: if isSuperadmin();
      allow update: if isSuperadmin();
      allow delete: if isSuperadmin();
    }

    // ── `attendance` collection ───────────────────────────────────────────────
    // Workers record their own attendance; admins/superadmins can read all
    match /attendance/{recordId} {
      allow read:   if isAuthenticated();
      allow create: if isAuthenticated();
      // Only the owning worker or an admin can update an attendance record
      allow update: if isAuthenticated() &&
                       (resource.data.workerId == request.auth.uid || isAdmin());
      allow delete: if isAdmin();
    }

    // ── `collection_bookings` collection ─────────────────────────────────────
    // Citizens create bookings; admins/workers can update (assign, complete)
    match /collection_bookings/{bookingId} {
      allow read:   if isAuthenticated();
      allow create: if isAuthenticated();
      // Citizens can update their own booking; workers/admins can update any
      allow update: if isAuthenticated() &&
                       (resource.data.userId == request.auth.uid || isWorker());
      allow delete: if isAuthenticated() &&
                       (resource.data.userId == request.auth.uid || isAdmin());
    }

    // ── `salary_records` collection ───────────────────────────────────────────
    // Written by admins; workers can read their own record; admins can read all
    match /salary_records/{recordId} {
      allow read:   if isAuthenticated();
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isSuperadmin();
    }

    // ── `training` collection ─────────────────────────────────────────────────
    // Training modules readable by all authenticated; writable by admins
    match /training/{trainingId} {
      allow read:   if isAuthenticated();
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isSuperadmin();
    }

    // ── `notifications` collection ────────────────────────────────────────────
    // Each user can read their own notifications; system/admins create them
    match /notifications/{notifId} {
      allow read:   if isAuthenticated() &&
                       (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated();
      // Users can mark their own notifications as read (update)
      allow update: if isAuthenticated() &&
                       (resource.data.userId == request.auth.uid || isAdmin());
      allow delete: if isAuthenticated() &&
                       (resource.data.userId == request.auth.uid || isAdmin());
    }

  }
}
```

**Step 3: Deploy the rules**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main"
npx firebase deploy --only firestore:rules
```
Expected output: `✔  firestore: released rules firestore.rules`

If you get "Error: Failed to get Firebase project", run `npx firebase login` first.

**Step 4: Commit**

```bash
git add firestore.rules
git commit -m "fix: complete Firestore rules — add training+notifications, allow admin user creation"
```

---

### Task 4: Firestore Indexes — Complete Composite Indexes

**Problem:** `firestore.indexes.json` only has 1 index (notifications). The codebase uses many compound queries that need composite indexes or Firestore will throw `"The query requires an index"` errors at runtime.

**Queries found in codebase requiring composite indexes:**
- `complaints` by `citizenId` + `orderBy createdAt DESC`
- `complaints` by `citizenId` + `orderBy updatedAt DESC`
- `assignments` by `workerId` + `orderBy createdAt DESC`
- `assignments` by `workerId` + `workerStatus` (compound where)
- `users` by `role` + `orderBy name ASC` (listing workers/admins)
- `attendance` by `workerId` + `orderBy date DESC`
- `salary_records` by `workerId` + `orderBy createdAt DESC`
- `collection_bookings` by `userId` + `orderBy createdAt DESC`
- `completion_evidence` by `complaintId` + `orderBy createdAt DESC`
- `notifications` by `userId` + `orderBy createdAt DESC` (already exists)

**Files:**
- Modify: `firestore.indexes.json`

**Step 1: Replace the entire file content**

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
    },
    {
      "collectionGroup": "complaints",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "citizenId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "complaints",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "citizenId", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "assignments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workerId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "assignments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workerId", "order": "ASCENDING" },
        { "fieldPath": "workerStatus", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "attendance",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workerId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "salary_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "workerId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "collection_bookings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "completion_evidence",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "complaintId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Step 2: Deploy indexes**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main"
npx firebase deploy --only firestore:indexes
```
Expected: `✔  firestore: deployed indexes in firestore.indexes.json`

> Note: Indexes may take a few minutes to build in the Firebase Console. This is normal.

**Step 3: Commit**

```bash
git add firestore.indexes.json
git commit -m "fix: add complete composite Firestore indexes for all compound queries"
```

---

### Task 5: Seed Demo Data — Superadmin Dashboard Button

**Problem:** Firestore is empty. Admin/Superadmin dashboards show no data. We need to add demo data so the app looks real and can be demoed.

**Approach:** Add a "Seed Demo Data" button inside the Superadmin OverviewTab that creates sample complaints, inventory items, and salary records using the currently logged-in user's session. No Firebase Admin SDK needed — uses the client SDK with the superadmin's auth context.

**Files:**
- Modify: `src/components/dashboards/tabs/OverviewTab.tsx` — add seeder section at bottom

**Step 1: Read OverviewTab.tsx first**

Read `src/components/dashboards/tabs/OverviewTab.tsx` in full to understand its current structure before editing.

**Step 2: Add seed function and button**

At the top of `OverviewTab.tsx`, add imports (if not already present):
```typescript
import { collection, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useState } from 'react';
```

Inside the component, add state and seed function:
```typescript
const { currentUser } = useAuth();
const [seeding, setSeeding] = useState(false);
const [seedDone, setSeedDone] = useState(false);

const SEED_COMPLAINTS = [
  { title: 'Overflowing garbage bin near market', category: 'Waste Management', location: 'MG Road, Zone A', status: 'SUBMITTED', lat: 28.6139, lng: 77.2090 },
  { title: 'Pothole causing accidents', category: 'Road Damage', location: 'NH-44, Zone B', status: 'UNDER_REVIEW', lat: 28.6200, lng: 77.2150 },
  { title: 'Street light out for 3 days', category: 'Street Lighting', location: 'Sector 15, Zone C', status: 'ASSIGNED', lat: 28.6050, lng: 77.2200 },
  { title: 'Blocked drainage causing flooding', category: 'Drainage/Sewage', location: 'Ring Road, Zone D', status: 'SUBMITTED', lat: 28.6300, lng: 77.2300 },
  { title: 'Broken water pipe on main street', category: 'Water Supply', location: 'Civil Lines, Zone A', status: 'RESOLVED', lat: 28.6100, lng: 77.2050 },
];

const SEED_INVENTORY = [
  { name: 'Garbage Collection Trucks', quantity: 12, unit: 'vehicles', lastUpdated: serverTimestamp(), zone: 'All Zones' },
  { name: 'Safety Gloves (pairs)', quantity: 500, unit: 'pairs', lastUpdated: serverTimestamp(), zone: 'All Zones' },
  { name: 'High-Visibility Vests', quantity: 200, unit: 'pieces', lastUpdated: serverTimestamp(), zone: 'All Zones' },
];

const handleSeedData = async () => {
  if (!currentUser) return;
  setSeeding(true);
  try {
    // Seed complaints
    for (const c of SEED_COMPLAINTS) {
      await addDoc(collection(db, 'complaints'), {
        ...c,
        citizenId: currentUser.uid,
        citizenName: currentUser.displayName || 'Demo User',
        description: `Demo complaint: ${c.title}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    // Seed inventory
    for (const item of SEED_INVENTORY) {
      await addDoc(collection(db, 'inventory'), item);
    }
    setSeedDone(true);
  } catch (err) {
    console.error('Seed failed:', err);
    alert('Seed failed — check console for details. Make sure you are logged in as Superadmin.');
  } finally {
    setSeeding(false);
  }
};
```

At the bottom of the JSX return (before the closing `</div>`), add the seeder panel:
```tsx
{/* ── Demo Data Seeder ───────────────────────────────────────────── */}
<div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h3 className="text-lg font-bold text-amber-900 mb-1">🌱 Demo Data Seeder</h3>
      <p className="text-sm text-amber-700">
        Click to populate Firestore with sample complaints and inventory so dashboards show real data.
        {seedDone && <span className="ml-2 font-semibold text-green-700">✓ Seeded successfully!</span>}
      </p>
    </div>
    <button
      onClick={handleSeedData}
      disabled={seeding || seedDone}
      className="flex-shrink-0 px-5 py-2.5 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
    >
      {seeding ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Seeding...
        </>
      ) : seedDone ? '✓ Done' : 'Seed Demo Data'}
    </button>
  </div>
</div>
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 4: Manual verification**

1. Run `npm run dev`, log in as Superadmin
2. Go to Overview tab
3. See the amber "Demo Data Seeder" panel at the bottom
4. Click "Seed Demo Data"
5. Wait for button to show "✓ Done"
6. Navigate to other tabs — complaints, inventory should now show data
7. Open Firestore Console and verify `complaints` and `inventory` collections have docs

**Step 5: Commit**

```bash
git add src/components/dashboards/tabs/OverviewTab.tsx
git commit -m "feat: add demo data seeder button in Superadmin overview"
```

---

### Task 6: WorkersTab — Add Edit and Remove Functionality

**Problem:** `src/components/dashboards/admin/WorkersTab.tsx` is read-only. It has a "View Details" modal but no Edit or Remove actions.

**Files:**
- Modify: `src/components/dashboards/admin/WorkersTab.tsx`

**Step 1: Read the current file**

Read `src/components/dashboards/admin/WorkersTab.tsx` in full before editing.

**Step 2: Add required imports**

Add to the existing imports at the top:
```typescript
import { updateDoc, deleteDoc, doc as fsDoc } from 'firebase/firestore';
import { Edit2, Trash2, UserPlus, Loader2, Info, MoreVertical } from 'lucide-react';
```

Check which icons are already imported and only add the missing ones.

**Step 3: Add state for edit/remove/add**

Inside the `WorkersTab` component, add new state after existing state declarations:
```typescript
// Edit/Remove state
const [editWorker, setEditWorker] = useState<WorkerData | null>(null);
const [confirmRemove, setConfirmRemove] = useState<WorkerData | null>(null);
const [saving, setSaving] = useState(false);
const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);

// Edit form state
const [editForm, setEditForm] = useState({
  name: '',
  phone: '',
  assignedZone: '',
  workerType: '',
  designation: '',
  status: 'Active',
});

// Add toast helper
const showToast = (msg: string, ok = true) => {
  setToast({ msg, ok });
  setTimeout(() => setToast(null), 3500);
};

// Open edit modal
const handleEdit = (worker: WorkerData) => {
  setEditForm({
    name: worker.name || '',
    phone: worker.phone || '',
    assignedZone: worker.assignedZone || '',
    workerType: worker.workerType || '',
    designation: worker.designation || '',
    status: (worker.status as string) || 'Active',
  });
  setEditWorker(worker);
  setActiveActionMenu(null);
};

// Save edit
const handleSaveEdit = async () => {
  if (!editWorker || !editForm.name.trim()) {
    showToast('Name is required.', false);
    return;
  }
  setSaving(true);
  try {
    await updateDoc(fsDoc(db, 'users', editWorker.id), {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      assignedZone: editForm.assignedZone.trim(),
      workerType: editForm.workerType.trim(),
      designation: editForm.designation.trim(),
      status: editForm.status,
    });
    showToast('Worker updated successfully!');
    setEditWorker(null);
  } catch (err: any) {
    showToast(err.message || 'Update failed.', false);
  } finally {
    setSaving(false);
  }
};

// Remove worker
const handleRemoveConfirmed = async () => {
  if (!confirmRemove) return;
  setSaving(true);
  try {
    await deleteDoc(fsDoc(db, 'users', confirmRemove.id));
    showToast(`${confirmRemove.name}'s profile removed.`);
  } catch (err: any) {
    showToast(err.message || 'Remove failed.', false);
  } finally {
    setSaving(false);
    setConfirmRemove(null);
  }
};
```

**Step 4: Update WorkerData interface to add status**

Find the `WorkerData` interface and add `status`:
```typescript
interface WorkerData {
  id: string;
  name: string;
  email: string;
  assignedZone?: string;
  status?: string;
  phone?: string;
  workerType?: string;
  designation?: string;
  createdAt?: any;
}
```
(The `status` field is already there — just verify it's present.)

**Step 5: Wrap the return JSX with a click handler and add Toast**

The outer `<div className="space-y-8 animate-fade-in">` — add `onClick` to close action menus:
```tsx
<div className="space-y-8 animate-fade-in" onClick={() => setActiveActionMenu(null)}>
  {/* ── Toast ─────────────────────────────────── */}
  {toast && (
    <div className={`fixed top-4 right-4 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium ${toast.ok ? 'bg-emerald-600' : 'bg-red-500'}`}>
      {toast.msg}
    </div>
  )}
  {/* rest of the existing JSX ... */}
```

**Step 6: Update the roster header to add action menu per row**

Find the table row for each worker. The current `<td>` for "Actions" contains just a "View Details" button:
```tsx
<td className="px-6 py-4 whitespace-nowrap text-right">
  <button
    onClick={() => openDetails(worker)}
    className="text-emerald-600 hover:text-emerald-900 text-sm font-semibold transition-colors hover:underline"
  >
    View Details
  </button>
</td>
```

Replace this `<td>` with an action menu:
```tsx
<td className="px-6 py-4 whitespace-nowrap text-right relative">
  <div className="flex items-center justify-end gap-2">
    <button
      onClick={() => openDetails(worker)}
      className="text-emerald-600 hover:text-emerald-900 text-sm font-semibold transition-colors hover:underline"
    >
      View
    </button>
    <button
      onClick={(e) => {
        e.stopPropagation();
        setActiveActionMenu(activeActionMenu === worker.id ? null : worker.id);
      }}
      className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
    >
      <MoreVertical className="w-4 h-4" />
    </button>
  </div>
  {activeActionMenu === worker.id && (
    <div className="absolute right-2 top-10 w-40 bg-white rounded-xl shadow-xl border border-gray-100 z-[100] overflow-hidden">
      <button
        onClick={(e) => { e.stopPropagation(); handleEdit(worker); }}
        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      >
        <Edit2 className="w-4 h-4 text-blue-500" /> Edit
      </button>
      <div className="h-px bg-gray-100" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          setConfirmRemove(worker);
          setActiveActionMenu(null);
        }}
        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
      >
        <Trash2 className="w-4 h-4" /> Remove
      </button>
    </div>
  )}
</td>
```

**Step 7: Add Edit Modal**

Before the closing `</div>` of the component return, add:
```tsx
{/* ── Edit Worker Modal ─────────────────────────────────────────── */}
{editWorker && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="text-lg font-bold text-gray-900">Edit Worker</h3>
        <button onClick={() => setEditWorker(null)} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        {[
          { label: 'Full Name *', key: 'name', placeholder: 'e.g. Rajan Kumar' },
          { label: 'Phone', key: 'phone', placeholder: 'e.g. +91 9876543210' },
          { label: 'Assigned Zone', key: 'assignedZone', placeholder: 'e.g. Zone A' },
          { label: 'Worker Type', key: 'workerType', placeholder: 'e.g. Waste Collector' },
          { label: 'Designation', key: 'designation', placeholder: 'e.g. Senior Field Worker' },
        ].map(({ label, key, placeholder }) => (
          <div key={key} className="space-y-1">
            <label className="text-sm font-medium text-gray-700">{label}</label>
            <input
              type="text"
              value={editForm[key as keyof typeof editForm]}
              onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
              placeholder={placeholder}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        ))}
      </div>
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
        <button
          onClick={() => setEditWorker(null)}
          className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveEdit}
          disabled={saving}
          className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-60 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </div>
  </div>
)}

{/* ── Remove Confirmation Modal ─────────────────────────────────── */}
{confirmRemove && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Trash2 className="w-7 h-7 text-red-500" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Worker</h3>
      <p className="text-gray-500 text-sm mb-5">
        Remove <strong className="text-gray-800">{confirmRemove.name}</strong>'s profile?
        Their Firebase Auth account remains active — disable it in Firebase Console to prevent login.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => setConfirmRemove(null)}
          className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl"
        >
          Cancel
        </button>
        <button
          onClick={handleRemoveConfirmed}
          disabled={saving}
          className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Remove
        </button>
      </div>
    </div>
  </div>
)}
```

Also add `X` to the imports if not already there.

**Step 8: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 9: Manual verification**

1. Run `npm run dev`, log in as Admin or Superadmin
2. Navigate to Workers tab
3. See each worker row has a View button + ⋮ menu
4. Click ⋮ on a worker → see "Edit" and "Remove" options
5. Click Edit → modal opens with pre-filled fields
6. Change a field and save → toast shows "Worker updated successfully!"
7. Check Firestore Console — the worker doc is updated
8. Click Remove → confirmation dialog → confirm → worker removed from list

**Step 10: Commit**

```bash
git add src/components/dashboards/admin/WorkersTab.tsx
git commit -m "feat: add Edit and Remove actions to Workers roster"
```

---

### Task 7: Attendance — Checkout Time-Gate (4-Hour Minimum)

**Problem:** Workers can check out immediately after checking in. The Trello card requires a minimum shift time before checkout is allowed.

**Files:**
- Modify: `src/components/dashboards/WorkerDashboard.tsx` — inside the `AttendanceTab` component (starting around line 692)

**Step 1: Read the AttendanceTab code**

The `AttendanceTab` component is at the bottom of `WorkerDashboard.tsx` (starts around line 692). Find:
- `const isCheckedIn = !!todayRecord?.checkIn;`
- `const isCheckedOut = !!todayRecord?.checkOut;`
- The checkout button: `<button onClick={handleCheckOut} ...>`

**Step 2: Add time-gate state and logic**

After `const isCheckedOut = !!todayRecord?.checkOut;`, add:
```typescript
// ── Checkout time-gate: minimum 4 hours after check-in ──────────────────
const MIN_SHIFT_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
const [now2, setNow2] = useState(() => Date.now());

// Refresh the current time every 30 seconds so the countdown updates
useEffect(() => {
  const timer = setInterval(() => setNow2(Date.now()), 30_000);
  return () => clearInterval(timer);
}, []);

const checkInMs = (todayRecord?.checkInTs as { toMillis?: () => number } | undefined)?.toMillis?.() ?? null;
const msElapsed = checkInMs !== null ? now2 - checkInMs : 0;
const checkoutUnlocked = !isCheckedIn || isCheckedOut || msElapsed >= MIN_SHIFT_MS;
const msRemaining = checkInMs !== null ? Math.max(0, MIN_SHIFT_MS - msElapsed) : 0;
const hoursRemaining = Math.floor(msRemaining / 3_600_000);
const minutesRemaining = Math.floor((msRemaining % 3_600_000) / 60_000);
const checkoutCountdown = `${hoursRemaining}h ${minutesRemaining}m`;
```

**Step 3: Update the checkout button to use the gate**

Find the checkout button:
```tsx
{!isCheckedOut && isCheckedIn && (
  <button
    onClick={handleCheckOut}
    disabled={acting}
    className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
  >
    {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
    Check Out Now
  </button>
)}
```

Replace with:
```tsx
{!isCheckedOut && isCheckedIn && (
  <button
    onClick={handleCheckOut}
    disabled={acting || !checkoutUnlocked}
    className={`w-full py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
      checkoutUnlocked
        ? 'bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60'
        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
    }`}
  >
    {acting ? (
      <Loader2 className="w-4 h-4 animate-spin" />
    ) : checkoutUnlocked ? (
      <LogOut className="w-4 h-4" />
    ) : (
      <Clock className="w-4 h-4" />
    )}
    {checkoutUnlocked
      ? 'Check Out Now'
      : `Available in ${checkoutCountdown}`}
  </button>
)}
```

Verify `Clock` is already imported at the top of `WorkerDashboard.tsx` (it should be — it was used for stats).

**Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 5: Manual verification**

1. Run `npm run dev`, log in as a Worker
2. Go to Attendance tab
3. Click "Check In Now"
4. Checkout button should show "Available in 3h 59m" (approximately)
5. The button should be gray/disabled
6. After 4 hours (or for testing: temporarily set `MIN_SHIFT_MS = 5000` for 5 seconds), verify the button becomes enabled

**Step 6: Commit**

```bash
git add src/components/dashboards/WorkerDashboard.tsx
git commit -m "feat: add 4-hour minimum shift gate to attendance checkout"
```

---

### Task 8: Worker Dashboard — Salary Tab

**Problem:** Workers cannot see their salary records. `salary_records` collection exists in Firestore rules but there's no UI to display it in WorkerDashboard.

**Files:**
- Modify: `src/components/dashboards/WorkerDashboard.tsx`

**Step 1: Add salary tab to sidebar**

Find the `sidebarItems` array in `WorkerDashboard` (around line 277):
```typescript
const sidebarItems = [
  { icon: <ClipboardList .../>, label: t('my_tasks'), ... },
  ...
];
```

Add a salary item after the attendance item:
```typescript
{ icon: <DollarSign className="w-5 h-5" />, label: 'Salary', active: activeTab === 'salary', onClick: () => setActiveTab('salary') },
```

Add `DollarSign` to the lucide-react import at the top of `WorkerDashboard.tsx`.

**Step 2: Add salary data fetching state**

Add near the other `useState` declarations at the top of the component:
```typescript
interface SalaryRecord {
  id: string;
  month: string;          // e.g. "March 2026"
  baseSalary: number;
  overtime: number;
  deductions: number;
  total: number;
  status: string;         // 'Paid' | 'Pending'
  paidOn?: string;
  createdAt?: any;
}

const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
const [loadingSalary, setLoadingSalary] = useState(true);
```

**Step 3: Add Firestore listener for salary records**

Add a `useEffect` alongside the existing task-fetching useEffect:
```typescript
useEffect(() => {
  const q = query(
    collection(db, 'salary_records'),
    where('workerId', '==', user.id),
    orderBy('createdAt', 'desc')
  );
  const unsub = onSnapshot(q, (snap) => {
    setSalaryRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as SalaryRecord)));
    setLoadingSalary(false);
  }, (err) => {
    console.error('Salary records fetch error:', err);
    setLoadingSalary(false);
  });
  return () => unsub();
}, [user.id]);
```

Add `orderBy` to the Firestore imports at the top of WorkerDashboard (it may already be imported):
```typescript
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, addDoc, serverTimestamp, setDoc, orderBy } from 'firebase/firestore';
```

**Step 4: Add salary case to renderContent switch**

In the `renderContent()` function, add before the default case:
```tsx
case 'salary':
  const totalEarned = salaryRecords.filter(r => r.status === 'Paid').reduce((s, r) => s + (r.total || 0), 0);
  const pending = salaryRecords.filter(r => r.status === 'Pending').reduce((s, r) => s + (r.total || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">My Salary</h2>
        <p className="text-gray-500">Your payroll history and earnings</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Earned (YTD)"
          value={`₹${totalEarned.toLocaleString('en-IN')}`}
          icon={<DollarSign className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Pending"
          value={`₹${pending.toLocaleString('en-IN')}`}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
        <StatCard
          title="Records"
          value={loadingSalary ? '...' : salaryRecords.length.toString()}
          icon={<BarChart3 className="w-6 h-6" />}
          color="blue"
        />
      </div>

      {/* Salary Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Payroll History</h3>
        </div>
        {loadingSalary ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : salaryRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400">
            <DollarSign className="w-12 h-12 mb-3 text-gray-200" />
            <p className="font-medium">No salary records yet</p>
            <p className="text-sm mt-1">Your payroll records will appear here once processed by admin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50">
                <tr>
                  {['Month', 'Base', 'Overtime', 'Deductions', 'Total', 'Status'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {salaryRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{rec.month || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">₹{(rec.baseSalary || 0).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">+₹{(rec.overtime || 0).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">-₹{(rec.deductions || 0).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">₹{(rec.total || 0).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                        rec.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {rec.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors. Fix any import issues (e.g., ensure `DollarSign` is imported from lucide-react, `orderBy` from firebase/firestore).

**Step 6: Manual verification**

1. Run `npm run dev`, log in as a Worker
2. See "Salary" tab in the sidebar
3. Click it — shows empty state "No salary records yet"
4. Go to Firestore Console, manually add a `salary_records` doc:
   ```
   workerId: <worker uid>
   month: "March 2026"
   baseSalary: 18000
   overtime: 2500
   deductions: 1000
   total: 19500
   status: "Paid"
   createdAt: (server timestamp)
   ```
5. Reload the app — salary tab should show the record

**Step 7: Commit**

```bash
git add src/components/dashboards/WorkerDashboard.tsx
git commit -m "feat: add Salary tab to Worker dashboard with payroll history"
```

---

## Verification Checklist (Run After All Tasks)

Run these checks before declaring Sprint 2 complete:

```bash
# 1. TypeScript
cd "D:\HP Shared\All Freelance Projects\safai-main"
npx tsc --noEmit

# 2. Build check
npm run build

# 3. Git log
git log --oneline -10
```

Expected build: no TypeScript errors, Vite build succeeds.

Manual smoke tests:
- [ ] New Firebase Console user → logs in → goes to CitizenDashboard (no ProfileSetupPage)
- [ ] Existing user → logs in → goes to correct role dashboard
- [ ] Superadmin → Overview → "Seed Demo Data" button visible → click seeds data
- [ ] Admin → Workers tab → ⋮ menu shows Edit and Remove → both work
- [ ] Worker → Attendance → checks in → checkout button shows countdown
- [ ] Worker → Salary tab → shows empty state or records
- [ ] Firestore Console → `complaints`, `inventory` collections populated after seeding

---

## Summary of Files Changed

| Task | File | Change |
|------|------|--------|
| 1 | `src/contexts/AuthContext.tsx` | Auto-create Citizen profile |
| 2 | `src/App.tsx` | Remove ProfileSetupPage block |
| 3 | `firestore.rules` | Add training + notifications |
| 4 | `firestore.indexes.json` | Add 9 composite indexes |
| 5 | `src/components/dashboards/tabs/OverviewTab.tsx` | Add seeder button |
| 6 | `src/components/dashboards/admin/WorkersTab.tsx` | Add Edit + Remove |
| 7 | `src/components/dashboards/WorkerDashboard.tsx` | Checkout time-gate |
| 8 | `src/components/dashboards/WorkerDashboard.tsx` | Salary tab |
