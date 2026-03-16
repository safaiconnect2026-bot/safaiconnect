# Sprint 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the auth pipeline, resolve all critical Trello bugs, and add Worker Salary tab + Superadmin Training Upload.

**Architecture:**
- Public signup exposes only Citizen/Worker/Green-Champion; existing users auto-sign-in instead of re-registering
- Pending-admin pattern lets Superadmin pre-create an Admin record by email; AuthContext picks it up on first login
- Training progress moves from the admin-only `training` collection to `users/{uid}.trainingProgress` (user-writable)

**Tech Stack:** React 18 + TypeScript, Firebase Auth v9, Firestore v9, Firebase Storage v9, Tailwind CSS (darkMode: 'class'), Vite

---

## Pre-flight Checks (Already Done — Verify Only)

Before any coding, confirm these are already fixed:

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main\.worktrees\sprint-3"
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Items already implemented (no code changes needed):**
- ✅ Dark mode: `SettingsTab.tsx` uses `useTheme` → `toggleTheme`. `ThemeContext.tsx` applies `.dark` class to `document.documentElement` and persists to `localStorage`. Works correctly.
- ✅ Booking stuck loading: `finally { setIsSubmitting(false) }` IS present in `OnDemandCollectionTab`.
- ✅ Admin Salary Tab: `AdminDashboard.tsx` imports and renders `./admin/SalaryTab`. Already wired.
- ✅ Storage file-size guard: `CitizenDashboard.tsx` has `MAX_PHOTO_BYTES = 5MB` and checks before upload.

---

## Task 1: SignupPage — Remove Admin/Superadmin + Existing-User Auto-Signin

**Files:**
- Modify: `src/components/SignupPage.tsx:5` (add signInWithEmailAndPassword import)
- Modify: `src/components/SignupPage.tsx:285-287` (remove admin/superadmin options)
- Modify: `src/components/SignupPage.tsx:52-57` (fix citizenID to use uid)
- Modify: `src/components/SignupPage.tsx:113-114` (fix citizenID to use uid in email flow)
- Modify: `src/components/SignupPage.tsx:128-148` (handle email-already-in-use → auto-signin)

**Step 1: Add signInWithEmailAndPassword to imports**

In `src/components/SignupPage.tsx` line 5, change:
```typescript
import { createUserWithEmailAndPassword, updateProfile, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
```
to:
```typescript
import { createUserWithEmailAndPassword, updateProfile, signInWithRedirect, getRedirectResult, signOut, signInWithEmailAndPassword } from 'firebase/auth';
```

**Step 2: Remove admin/superadmin from the role selector**

Find this block (around line 282–288):
```html
<option value="">{t('choose_role')}</option>
<option value="worker">{t('role_worker')}</option>
<option value="citizen">{t('role_citizen')}</option>
<option value="admin">Admin</option>
<option value="superadmin">Super Admin</option>
<option value="green-champion">Green Champion</option>
```
Replace with:
```html
<option value="">{t('choose_role')}</option>
<option value="citizen">{t('role_citizen')}</option>
<option value="worker">{t('role_worker')}</option>
<option value="green-champion">Green Champion</option>
```

**Step 3: Fix citizenID to use uid (Google signup useEffect, around line 52–57)**

Find:
```typescript
citizenID: `CIT-${Math.floor(Math.random() * 1000000)}`,
```
Replace with:
```typescript
citizenID: `CIT-${user.uid.slice(-6).toUpperCase()}`,
```

**Step 4: Fix citizenID in email signup flow (around line 113–114)**

Find:
```typescript
citizenID: `CIT-${Math.floor(Math.random() * 1000000)}`,
```
(the second occurrence in `handleSubmit`) Replace with:
```typescript
citizenID: `CIT-${user.uid.slice(-6).toUpperCase()}`,
```

**Step 5: Handle email-already-in-use → auto-signin**

Find the catch block (around line 128–148):
```typescript
if (err.code === 'auth/email-already-in-use') {
    setError('User with this email already exists');
}
```
Replace with:
```typescript
if (err.code === 'auth/email-already-in-use') {
    // User is already registered — sign them in directly and let AuthContext route to dashboard
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Auth state change will trigger AuthContext → App.tsx routing to dashboard
        // No need to call onSignupSuccess (which goes to login page)
    } catch (signInErr: any) {
        const code = signInErr.code || '';
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
            setError('An account with this email already exists. Please sign in with the correct password.');
        } else {
            setError('Account already exists. Please use the Sign In page instead.');
        }
    }
}
```

**Step 6: Run TypeScript check**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main\.worktrees\sprint-3"
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 7: Commit**

```bash
git add src/components/SignupPage.tsx
git commit -m "fix: remove admin/superadmin from public signup + auto-signin for existing users"
```

---

## Task 2: ProfilePage — Fix assignedZone Saving + updateProfile

**Files:**
- Modify: `src/components/common/ProfilePage.tsx:28` (add updateProfile import)
- Modify: `src/components/common/ProfilePage.tsx:134–175` (handleSave — add zone + updateProfile)

**Step 1: Add updateProfile to imports**

Find line 29:
```typescript
import { sendPasswordResetEmail } from 'firebase/auth';
```
Replace with:
```typescript
import { sendPasswordResetEmail, updateProfile } from 'firebase/auth';
```

**Step 2: Fix handleSave to include assignedZone and updateProfile**

Find the `handleSave` function body (the `const data` block around line 137–165):
```typescript
const data: Record<string, any> = {
    name: form.name,
    phone: form.phone,
    address: form.address,
};
if (user.role === 'superadmin') {
    Object.assign(data, {
        department: form.department,
        designation: form.designation,
        govtId: form.govtId,
        officeAddress: form.officeAddress,
        region: form.region,
        state: form.state,
        city: form.city,
    });
} else if (user.role === 'admin') {
    Object.assign(data, {
        designation: form.designation,
        department: form.department,
    });
} else if (user.role === 'worker') {
    Object.assign(data, {
        workerType: form.workerType,
```

Replace the entire `handleSave` body (lines 135–175) with:
```typescript
const handleSave = async () => {
    setIsSaving(true);
    try {
        const data: Record<string, any> = {
            name: form.name,
            phone: form.phone,
            address: form.address,
            assignedZone: form.zone,
        };
        if (user.role === 'superadmin') {
            Object.assign(data, {
                department: form.department,
                designation: form.designation,
                govtId: form.govtId,
                officeAddress: form.officeAddress,
                region: form.region,
                state: form.state,
                city: form.city,
            });
        } else if (user.role === 'admin') {
            Object.assign(data, {
                designation: form.designation,
                department: form.department,
            });
        } else if (user.role === 'worker') {
            Object.assign(data, {
                workerType: form.workerType,
            });
        } else if (user.role === 'citizen') {
            Object.assign(data, { ward: form.ward });
        }
        await updateDoc(doc(db, 'users', user.id), data);
        // Sync display name to Firebase Auth
        if (auth.currentUser && form.name.trim()) {
            try {
                await updateProfile(auth.currentUser, { displayName: form.name.trim() });
            } catch (err) {
                console.warn('updateProfile failed (non-critical):', err);
            }
        }
        setIsEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    } catch (error) {
        console.error('Error updating profile:', error);
        toastError('Failed to update profile. Please try again.');
    } finally {
        setIsSaving(false);
    }
};
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/components/common/ProfilePage.tsx
git commit -m "fix: save assignedZone in profile + sync displayName to Firebase Auth"
```

---

## Task 3: TrainingSystem — Fix Progress Saving (training → users/{uid})

**Context:** `training` Firestore collection requires `isAdmin()` to write. Workers/citizens call `setDoc(doc(db, 'training', user.id), ...)` and get silent `permission-denied`. Progress resets on every reload.

**Fix:** Move reads/writes to `users/{uid}` document under a `trainingProgress` field. Users can write their own `users/{uid}` doc per Firestore rules (`isOwner(userId)`).

**Files:**
- Modify: `src/components/training/TrainingSystem.tsx:87–119` (loadUserProgress + saveUserProgress)

**Step 1: Fix loadUserProgress**

Find `loadUserProgress` (line 87–108):
```typescript
const loadUserProgress = async () => {
    try {
      const docRef = doc(db, 'training', user.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProgress({
          completedModules: data.completedModules || [],
          totalPoints: data.totalPoints || 0,
          certificates: data.certificates || [],
          currentStreak: data.currentStreak || 0,
          lastActivityDate: data.lastActivityDate || null,
          hearts: data.hearts !== undefined ? data.hearts : 5,
          level: data.level || 1,
          xp: data.xp || 0,
          achievements: data.achievements || []
        });
      }
    } catch (error) {
      console.error('Error loading training progress:', error);
    }
  };
```

Replace with:
```typescript
const loadUserProgress = async () => {
    try {
      // Progress now stored in users/{uid}.trainingProgress (user-writable)
      const docRef = doc(db, 'users', user.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const raw = docSnap.data();
        // Support both new location (trainingProgress field) and legacy (root fields in training collection)
        const data = raw.trainingProgress || raw;
        if (data.completedModules !== undefined) {
          setUserProgress({
            completedModules: data.completedModules || [],
            totalPoints: data.totalPoints || 0,
            certificates: data.certificates || [],
            currentStreak: data.currentStreak || 0,
            lastActivityDate: data.lastActivityDate || null,
            hearts: data.hearts !== undefined ? data.hearts : 5,
            level: data.level || 1,
            xp: data.xp || 0,
            achievements: data.achievements || []
          });
        }
      }
    } catch (error) {
      console.error('Error loading training progress:', error);
    }
  };
```

**Step 2: Fix saveUserProgress**

Find `saveUserProgress` (line 110–119):
```typescript
const saveUserProgress = async (progress: UserProgress) => {
    setUserProgress(progress);
    try {
      // Also ensuring we save userId for comprehensive tracking
      const dataToSave = { ...progress, userId: user.id };
      await setDoc(doc(db, 'training', user.id), dataToSave, { merge: true });
    } catch (error) {
      console.error('Error saving training progress:', error);
    }
  };
```

Replace with:
```typescript
const saveUserProgress = async (progress: UserProgress) => {
    setUserProgress(progress);
    try {
      // Save under users/{uid}.trainingProgress — writable by the user themselves
      await setDoc(
        doc(db, 'users', user.id),
        { trainingProgress: { ...progress, userId: user.id } },
        { merge: true }
      );
    } catch (error) {
      console.error('Error saving training progress:', error);
    }
  };
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/components/training/TrainingSystem.tsx
git commit -m "fix: move training progress to users/{uid}.trainingProgress (permission fix)"
```

---

## Task 4: WorkerDashboard — Add Worker Salary Tab

**Context:** Workers need to see their own salary records. The `salary_records` collection is already indexed by `workerId`. Firestore rules allow workers to read their own records (`resource.data.workerId == request.auth.uid`).

**Files:**
- Modify: `src/components/dashboards/WorkerDashboard.tsx` (add sidebar item, renderContent case, import DollarSign + Calendar + IndianRupee)

**Step 1: Add DollarSign and IndianRupee to lucide imports**

Find line 2–7 (the imports from lucide-react):
```typescript
import {
  ClipboardList, Camera, CheckCircle, GraduationCap,
  QrCode, BarChart3, Clock, Target,
  MapPin, X, Loader2, UserCircle, Settings,
  CalendarCheck, LogIn, LogOut, Calendar
} from 'lucide-react';
```

Replace with:
```typescript
import {
  ClipboardList, Camera, CheckCircle, GraduationCap,
  QrCode, BarChart3, Clock, Target,
  MapPin, X, Loader2, UserCircle, Settings,
  CalendarCheck, LogIn, LogOut, Calendar,
  DollarSign, IndianRupee
} from 'lucide-react';
```

**Step 2: Add `salary` to the sidebar**

Find the sidebarItems array (around line 277–286):
```typescript
const sidebarItems = [
    { icon: <ClipboardList className="w-5 h-5" />, label: t('my_tasks'), active: activeTab === 'tasks', onClick: () => setActiveTab('tasks') },
    { icon: <MapPin className="w-5 h-5" />, label: 'Route', active: activeTab === 'route', onClick: () => setActiveTab('route') },
    { icon: <Camera className="w-5 h-5" />, label: t('submit_proof'), active: activeTab === 'proof', onClick: () => setActiveTab('proof') },
    { icon: <CheckCircle className="w-5 h-5" />, label: t('attendance'), active: activeTab === 'attendance', onClick: () => setActiveTab('attendance') },
    { icon: <QrCode className="w-5 h-5" />, label: t('digital_id'), active: activeTab === 'digitalid', onClick: () => setActiveTab('digitalid') },
    { icon: <GraduationCap className="w-5 h-5" />, label: t('training'), active: activeTab === 'training', onClick: () => setActiveTab('training') },
    { icon: <Settings className="w-5 h-5" />, label: t('settings'), active: activeTab === 'settings', onClick: () => setActiveTab('settings') },
    { icon: <UserCircle className="w-5 h-5" />, label: t('profile'), active: activeTab === 'profile', onClick: () => setActiveTab('profile') },
  ];
```

Replace with:
```typescript
const sidebarItems = [
    { icon: <ClipboardList className="w-5 h-5" />, label: t('my_tasks'), active: activeTab === 'tasks', onClick: () => setActiveTab('tasks') },
    { icon: <MapPin className="w-5 h-5" />, label: 'Route', active: activeTab === 'route', onClick: () => setActiveTab('route') },
    { icon: <Camera className="w-5 h-5" />, label: t('submit_proof'), active: activeTab === 'proof', onClick: () => setActiveTab('proof') },
    { icon: <CheckCircle className="w-5 h-5" />, label: t('attendance'), active: activeTab === 'attendance', onClick: () => setActiveTab('attendance') },
    { icon: <QrCode className="w-5 h-5" />, label: t('digital_id'), active: activeTab === 'digitalid', onClick: () => setActiveTab('digitalid') },
    { icon: <DollarSign className="w-5 h-5" />, label: 'Salary', active: activeTab === 'salary', onClick: () => setActiveTab('salary') },
    { icon: <GraduationCap className="w-5 h-5" />, label: t('training'), active: activeTab === 'training', onClick: () => setActiveTab('training') },
    { icon: <Settings className="w-5 h-5" />, label: t('settings'), active: activeTab === 'settings', onClick: () => setActiveTab('settings') },
    { icon: <UserCircle className="w-5 h-5" />, label: t('profile'), active: activeTab === 'profile', onClick: () => setActiveTab('profile') },
  ];
```

**Step 3: Add case to renderContent**

Find (around line 666–668):
```typescript
      case 'training': return <TrainingSystem user={user} />;
      case 'settings': return <SettingsTab />;
      case 'profile': return <ProfilePage user={user} />;
```

Replace with:
```typescript
      case 'salary': return <WorkerSalaryTab workerId={user.id} />;
      case 'training': return <TrainingSystem user={user} />;
      case 'settings': return <SettingsTab />;
      case 'profile': return <ProfilePage user={user} />;
```

**Step 4: Add WorkerSalaryTab component at the bottom of WorkerDashboard.tsx**

Add this component after the `AttendanceTab` component (at the very end of the file, before the final `export default`):

```typescript
// ─── Worker Salary Tab ────────────────────────────────────────────────────────

interface WorkerSalaryRecord {
  id: string;
  month: string;
  baseSalary: number;
  overtime: number;
  deductions: number;
  netSalary: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  createdAt: any;
}

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const STATUS_COLORS: Record<string, string> = {
  Paid: 'bg-green-100 text-green-800',
  Pending: 'bg-yellow-100 text-yellow-800',
  Overdue: 'bg-red-100 text-red-800',
};

const WorkerSalaryTab: React.FC<{ workerId: string }> = ({ workerId }) => {
  const [records, setRecords] = useState<WorkerSalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'salary_records'),
      where('workerId', '==', workerId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: WorkerSalaryRecord[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkerSalaryRecord));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setRecords(list);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [workerId]);

  const totalYTD = records.filter((r) => r.status === 'Paid').reduce((sum, r) => sum + (r.netSalary || 0), 0);
  const lastPaid = records.find((r) => r.status === 'Paid');
  const nextPending = records.find((r) => r.status === 'Pending');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">My Salary</h2>
        <p className="text-gray-600">Your salary records and payment history</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Earned (YTD)"
          value={formatINR(totalYTD)}
          icon={<IndianRupee className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Last Payment"
          value={lastPaid?.month || '—'}
          icon={<Calendar className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Next Due"
          value={nextPending?.month || '—'}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
      </div>

      {/* Salary Records Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Payment History</h3>
        </div>
        {loading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center p-10 text-gray-500">
            <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No salary records yet</p>
            <p className="text-sm mt-1">Records will appear here once created by your admin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left">Month</th>
                  <th className="px-6 py-3 text-right">Base Salary</th>
                  <th className="px-6 py-3 text-right">Overtime</th>
                  <th className="px-6 py-3 text-right">Deductions</th>
                  <th className="px-6 py-3 text-right font-bold">Net Salary</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{rec.month || '—'}</td>
                    <td className="px-6 py-4 text-right text-gray-700">{formatINR(rec.baseSalary || 0)}</td>
                    <td className="px-6 py-4 text-right text-green-700">+{formatINR(rec.overtime || 0)}</td>
                    <td className="px-6 py-4 text-right text-red-700">-{formatINR(rec.deductions || 0)}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">{formatINR(rec.netSalary || 0)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${STATUS_COLORS[rec.status] || 'bg-gray-100 text-gray-700'}`}>
                        {rec.status}
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
};
```

**Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 6: Commit**

```bash
git add src/components/dashboards/WorkerDashboard.tsx
git commit -m "feat: add Worker Salary tab showing salary_records from Firestore"
```

---

## Task 5: AdminManagementTab — Fix Add Admin Pipeline

**Context:** Currently, clicking "Add New Admin" → filling the form → clicking Save does `setIsEditing('__new_instructions__')` which is a broken hack. Firebase Auth cannot create users from the client without signing out the current user.

**Solution (pending_admins pattern):**
1. Superadmin fills in name, email, zone → we write to `pending_admins/{email}` in Firestore
2. Superadmin sends the signup link to the new admin
3. Admin signs up via the regular signup page with that email
4. AuthContext detects a `pending_admins/{email}` doc on first login → applies Admin role + zone automatically
5. `pending_admins` doc is deleted after applying

**Files:**
- Modify: `src/components/dashboards/tabs/AdminManagementTab.tsx` (handleSubmit new admin section)
- Modify: `src/contexts/AuthContext.tsx` (check pending_admins before auto-create)
- Modify: `firestore.rules` (add pending_admins rule)

**Step 1: Update AdminManagementTab imports**

Find line 9:
```typescript
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
```
Replace with:
```typescript
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
```

**Step 2: Replace the broken new-admin else branch in handleSubmit**

Find (around line 153–159):
```typescript
    } else {
      // ── New admin: cannot create Firebase Auth from client ─────────────────
      // Show the instructions panel instead of creating an account
      setShowAddModal(false);
      setShowAddModal(true);   // keep the modal open in "instructions" state
      setIsEditing('__new_instructions__');
    }
```

Replace with:
```typescript
    } else {
      // ── New admin: pre-create Firestore record, instruct Superadmin to share signup link ──
      if (!formData.email.trim()) {
        showToast('Email address is required to create an admin.', false);
        return;
      }
      setSaving(true);
      try {
        // Sanitize email for use as Firestore document ID
        const emailKey = formData.email.trim().toLowerCase().replace(/\./g, '_').replace(/@/g, '__at__');
        await setDoc(doc(db, 'pending_admins', emailKey), {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          role: 'Admin',
          assignedZone: formData.area,
          adminLevel: formData.role,
          status: 'Active',
          createdAt: serverTimestamp(),
        });
        showToast(`Admin invitation created! Ask ${formData.email} to sign up at the app — they will automatically get Admin access.`);
        setShowAddModal(false);
        setFormData({ name: '', email: '', area: 'Zone A', role: 'Zone Admin', password: '', status: 'Active' });
      } catch (err: any) {
        showToast(err.message || 'Failed to create admin invitation.', false);
      } finally {
        setSaving(false);
      }
    }
```

**Step 3: Update AuthContext to check pending_admins before auto-creating Citizen**

In `src/contexts/AuthContext.tsx`, add `getDoc` to imports if not present. Find line 3:
```typescript
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
```
Replace with:
```typescript
import { doc, onSnapshot, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
```

**Step 4: Add pending admin lookup helper in AuthContext**

Add a helper function before the `AuthProvider` component (after the `ROLE_NORMALIZATION` constant):

```typescript
// ── Pending admin lookup ──────────────────────────────────────────────────────
// Returns pending admin data if a pending_admins record exists for this email, else null.
const getPendingAdminData = async (email: string): Promise<Record<string, any> | null> => {
    const emailKey = email.toLowerCase().replace(/\./g, '_').replace(/@/g, '__at__');
    const pendingRef = doc(db, 'pending_admins', emailKey);
    try {
        const snap = await getDoc(pendingRef);
        if (snap.exists()) return snap.data();
    } catch {
        // If read fails (e.g. rules block), ignore and fall through to Citizen
    }
    return null;
};
```

**Step 5: Use pending admin data in the auto-create block**

Find the auto-create block inside the `onSnapshot` callback (around line 83–104):
```typescript
if (!docSnap.exists()) {
    // Silently create the profile; the next onSnapshot event will load it.
    setDoc(docRef, {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || (user.email?.split('@')[0] ?? 'User'),
        role: 'Citizen',
        createdAt: serverTimestamp(),
        rewardPoints: 0,
    }).catch((err: unknown) => {
```

Replace the entire `if (!docSnap.exists())` block with:
```typescript
if (!docSnap.exists()) {
    // Check if a Superadmin pre-created an admin invitation for this email
    const email = user.email || '';
    const pending = email ? await getPendingAdminData(email) : null;

    const newProfile: Record<string, any> = pending
        ? {
            uid: user.uid,
            email: email,
            name: pending.name || user.displayName || (email.split('@')[0] ?? 'User'),
            role: pending.role || 'Admin',
            assignedZone: pending.assignedZone || '',
            adminLevel: pending.adminLevel || 'Zone Admin',
            status: pending.status || 'Active',
            createdAt: serverTimestamp(),
        }
        : {
            uid: user.uid,
            email: email,
            name: user.displayName || (email.split('@')[0] ?? 'User'),
            role: 'Citizen',
            createdAt: serverTimestamp(),
            rewardPoints: 0,
            citizenID: `CIT-${user.uid.slice(-6).toUpperCase()}`,
        };

    setDoc(docRef, newProfile).then(async () => {
        // If we consumed a pending_admins record, clean it up
        if (pending && email) {
            const emailKey = email.toLowerCase().replace(/\./g, '_').replace(/@/g, '__at__');
            deleteDoc(doc(db, 'pending_admins', emailKey)).catch(() => {});
        }
    }).catch((err: unknown) => {
```

> **Note:** You'll also need to close the `.catch` block correctly. The full replacement for the auto-create block is:
```typescript
if (!docSnap.exists()) {
    const email = user.email || '';
    const pending = email ? await getPendingAdminData(email) : null;

    const newProfile: Record<string, any> = pending
        ? {
            uid: user.uid,
            email: email,
            name: pending.name || user.displayName || (email.split('@')[0] ?? 'User'),
            role: pending.role || 'Admin',
            assignedZone: pending.assignedZone || '',
            adminLevel: pending.adminLevel || 'Zone Admin',
            status: pending.status || 'Active',
            createdAt: serverTimestamp(),
        }
        : {
            uid: user.uid,
            email: email,
            name: user.displayName || (email.split('@')[0] ?? 'User'),
            role: 'Citizen',
            createdAt: serverTimestamp(),
            rewardPoints: 0,
            citizenID: `CIT-${user.uid.slice(-6).toUpperCase()}`,
        };

    setDoc(docRef, newProfile)
        .then(async () => {
            if (pending && email) {
                const emailKey = email.toLowerCase().replace(/\./g, '_').replace(/@/g, '__at__');
                deleteDoc(doc(db, 'pending_admins', emailKey)).catch(() => {});
            }
        })
        .catch((err: unknown) => {
            console.error('[AuthContext] Auto-create profile failed:', err);
            setUserProfile({
                uid: user.uid,
                email: email,
                name: user.displayName || (email.split('@')[0] ?? 'User'),
                role: 'Citizen',
            });
            setLoading(false);
        });
    return;
}
```

**Step 6: Add pending_admins rule to firestore.rules**

In `firestore.rules`, add before the final closing `}` (after the `notifications` block, around line 146):

```
    // ── `pending_admins` collection ───────────────────────────────────────────
    // Superadmins create/delete admin invitations; the invited user can read their own record
    match /pending_admins/{docId} {
      allow read: if isSuperadmin() ||
                     (isAuthenticated() && resource.data.email == request.auth.token.email);
      allow create, update: if isSuperadmin();
      allow delete: if isSuperadmin() ||
                       (isAuthenticated() && resource.data.email == request.auth.token.email);
    }
```

**Step 7: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 8: Commit**

```bash
git add src/components/dashboards/tabs/AdminManagementTab.tsx src/contexts/AuthContext.tsx firestore.rules
git commit -m "feat: pending_admins pipeline — Superadmin creates invite, AuthContext applies role on first login"
```

---

## Task 6: SuperadminDashboard — Add Training Upload Tab

**Context:** Superadmin should be able to upload training materials (PDF/MP4, max 50MB) to Firebase Storage and create `training` collection docs.

**Files:**
- Create: `src/components/dashboards/tabs/TrainingUploadTab.tsx`
- Modify: `src/components/dashboards/SuperadminDashboard.tsx` (add sidebar item + renderContent case)

**Step 1: Create TrainingUploadTab component**

Create file `src/components/dashboards/tabs/TrainingUploadTab.tsx`:

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Video, Download, Loader2, CheckCircle, Trash2, AlertCircle } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, storage } from '../../../lib/firebase';
import { User } from '../../../App';
import { useToast } from '../../../contexts/ToastContext';

interface TrainingMaterial {
  id: string;
  title: string;
  fileUrl: string;
  type: 'pdf' | 'video' | 'other';
  uploadedBy: string;
  createdAt: any;
  fileName?: string;
  fileSize?: number;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

interface TrainingUploadTabProps {
  user: User;
}

const TrainingUploadTab: React.FC<TrainingUploadTabProps> = ({ user }) => {
  const { success: toastSuccess, error: toastError } = useToast();
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'training_materials'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setMaterials(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingMaterial)));
      setLoadingMaterials(false);
    }, () => setLoadingMaterials(false));
    return () => unsub();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toastError('File too large. Maximum size is 50 MB.');
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  const detectType = (file: File): 'pdf' | 'video' | 'other' => {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('video/')) return 'video';
    return 'other';
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !title.trim()) {
      toastError('Please select a file and enter a title.');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const fileType = detectType(selectedFile);
      const safeFileName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storageRef = ref(storage, `training-materials/${safeFileName}`);

      await new Promise<void>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, selectedFile);
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          },
          reject,
          async () => {
            const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
            await addDoc(collection(db, 'training_materials'), {
              title: title.trim(),
              fileUrl,
              type: fileType,
              uploadedBy: user.name || user.email,
              uploadedById: user.id,
              fileName: selectedFile.name,
              fileSize: selectedFile.size,
              createdAt: serverTimestamp(),
            });
            resolve();
          }
        );
      });

      toastSuccess('Training material uploaded successfully!');
      setTitle('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Upload error:', err);
      toastError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (material: TrainingMaterial) => {
    if (!window.confirm(`Delete "${material.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'training_materials', material.id));
      toastSuccess('Material deleted.');
    } catch (err: any) {
      toastError(err?.message || 'Failed to delete.');
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Training Materials</h2>
        <p className="text-gray-600">Upload PDF documents and videos for worker training</p>
      </div>

      {/* Upload Form */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Upload className="w-5 h-5 text-emerald-600" />
          Upload New Material
        </h3>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Waste Segregation Guide"
              className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              File (PDF or Video, max 50 MB)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,video/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              required
            />
            {selectedFile && (
              <p className="text-xs text-gray-500 mt-1">
                Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
              </p>
            )}
          </div>
          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition-colors font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {uploading ? 'Uploading…' : 'Upload Material'}
          </button>
        </form>
      </div>

      {/* Uploaded Materials List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Uploaded Materials ({materials.length})</h3>
        </div>
        {loadingMaterials ? (
          <div className="flex justify-center p-10">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : materials.length === 0 ? (
          <div className="text-center p-10 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No materials uploaded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {materials.map((m) => (
              <div key={m.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {m.type === 'pdf' ? (
                    <FileText className="w-8 h-8 text-red-500 flex-shrink-0" />
                  ) : m.type === 'video' ? (
                    <Video className="w-8 h-8 text-blue-500 flex-shrink-0" />
                  ) : (
                    <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{m.title}</p>
                    <p className="text-xs text-gray-500">
                      {m.type?.toUpperCase()} · {formatBytes(m.fileSize)} · by {m.uploadedBy}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Download / Open"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                  <button
                    onClick={() => handleDelete(m)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingUploadTab;
```

**Step 2: Add Training Upload tab to SuperadminDashboard**

In `src/components/dashboards/SuperadminDashboard.tsx`, add import:
```typescript
import TrainingUploadTab from './tabs/TrainingUploadTab';
```

Add sidebar item (after the training item):
```typescript
{ icon: <GraduationCap className="w-5 h-5" />, label: t('training'), active: activeTab === 'training', onClick: () => setActiveTab('training') },
{ icon: <Upload className="w-5 h-5" />, label: 'Upload Training', active: activeTab === 'training_upload', onClick: () => setActiveTab('training_upload') },
```

> **Note:** Also add `Upload` to the lucide-react import at the top of SuperadminDashboard.tsx.

Add case to renderContent:
```typescript
case 'training_upload': return <TrainingUploadTab user={user} />;
```

**Step 3: Add Firestore rule for training_materials collection**

In `firestore.rules`, add:
```
    // ── `training_materials` collection ──────────────────────────────────────
    // Superadmins upload materials; all authenticated users can read
    match /training_materials/{materialId} {
      allow read: if isAuthenticated();
      allow create, update: if isSuperadmin();
      allow delete: if isSuperadmin();
    }
```

**Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 5: Commit**

```bash
git add src/components/dashboards/tabs/TrainingUploadTab.tsx src/components/dashboards/SuperadminDashboard.tsx firestore.rules
git commit -m "feat: Superadmin Training Upload — upload PDFs/videos to Storage, list in training_materials collection"
```

---

## Task 7: CitizenDashboard — Add Retry Logic to Storage Upload

**Context:** Storage upload already has a 5MB size guard and `storage/retry-limit-exceeded` error handling. Adding explicit retry (3 attempts, 2s backoff) makes it more resilient on poor mobile connections.

**Files:**
- Modify: `src/components/dashboards/CitizenDashboard.tsx` (~line 431–433)

**Step 1: Add uploadWithRetry helper**

Add this helper function near the top of the file (after the `MAX_PHOTO_BYTES` constant):
```typescript
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const uploadWithRetry = async (
  fileRef: ReturnType<typeof ref>,
  file: File,
  maxAttempts = 3
): Promise<string> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await uploadBytes(fileRef, file);
      return await getDownloadURL(fileRef);
    } catch (err: any) {
      if (attempt === maxAttempts) throw err;
      await sleep(2000 * attempt); // 2s, 4s backoff
    }
  }
  throw new Error('Upload failed after retries');
};
```

**Step 2: Replace the uploadBytes call in the complaint submit handler**

Find (around line 431–433):
```typescript
        const fileRef = ref(storage, `complaints/${user.id}_${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        imageUrl = await getDownloadURL(fileRef);
```
Replace with:
```typescript
        const fileRef = ref(storage, `complaints/${user.id}_${Date.now()}_${file.name}`);
        imageUrl = await uploadWithRetry(fileRef, file);
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/components/dashboards/CitizenDashboard.tsx
git commit -m "fix: add 3-attempt retry logic with 2s backoff to complaint photo upload"
```

---

## Task 8: Final Integration — Firestore Index + Full Build Check

**Step 1: Add salary_records Firestore index (already in firestore.indexes.json — verify)**

```bash
cat "D:\HP Shared\All Freelance Projects\safai-main\.worktrees\sprint-3\firestore.indexes.json" | grep salary
```
Expected: shows `salary_records` index on `workerId` + `createdAt`. ✅ Already present.

**Step 2: Add training_materials index (new)**

In `firestore.indexes.json`, add inside the `"indexes"` array:
```json
{
  "collectionGroup": "training_materials",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**Step 3: Final TypeScript check**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main\.worktrees\sprint-3"
npx tsc --noEmit 2>&1
```
Expected: 0 errors.

**Step 4: Build check**

```bash
npm run build 2>&1 | tail -20
```
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add firestore.indexes.json
git commit -m "chore: add training_materials Firestore index"
```

---

## Task 9: Merge to Master and Push

```bash
git checkout master
git merge --no-ff claude/sprint-3 -m "feat: Sprint 3 — auth pipeline, bug fixes, salary tab, training upload"
git push origin master
```

Vercel will auto-deploy on push to master.

---

## Summary of All Changes

| File | What Changed |
|------|-------------|
| `src/components/SignupPage.tsx` | Removed admin/superadmin options; existing-user auto-signin; uid-based citizenID |
| `src/components/common/ProfilePage.tsx` | Saves `assignedZone`; calls `updateProfile` for Firebase Auth displayName |
| `src/components/training/TrainingSystem.tsx` | Progress saved to `users/{uid}.trainingProgress` instead of `training/{uid}` |
| `src/components/dashboards/WorkerDashboard.tsx` | Added Salary tab + `WorkerSalaryTab` component |
| `src/components/dashboards/tabs/AdminManagementTab.tsx` | Add Admin now writes `pending_admins` doc instead of broken hack |
| `src/contexts/AuthContext.tsx` | Checks `pending_admins` before auto-creating Citizen; adds `citizenID` to new profiles |
| `src/components/dashboards/tabs/TrainingUploadTab.tsx` | New component — upload PDF/video to Storage, list materials |
| `src/components/dashboards/SuperadminDashboard.tsx` | Added Training Upload tab |
| `src/components/dashboards/CitizenDashboard.tsx` | Added 3-attempt retry to Storage upload |
| `firestore.rules` | Added `pending_admins` + `training_materials` collection rules |
| `firestore.indexes.json` | Added `training_materials` index |

## Already Done (No Changes Needed)

| Item | Status |
|------|--------|
| Dark mode toggle | ✅ ThemeContext + SettingsTab already wired |
| Booking stuck loading | ✅ `finally { setIsSubmitting(false) }` present |
| Admin Salary Tab | ✅ `AdminDashboard.tsx` imports and uses `./admin/SalaryTab` |
| Storage 5MB size guard | ✅ `MAX_PHOTO_BYTES` guard in CitizenDashboard |
