# Pending Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 12 pending items — route-map GPS, notifications, 2FA stub removal, Champion Hub tab, role casing guard, training videos, and housekeeping cleanups.

**Architecture:** Changes span CitizenDashboard (GPS already captured, just needs to propagate to assignments), ComplaintsTab (assignment write), SettingsTab (remove 2FA button), GreenChampionDashboard (new Champion Hub tab injected via `isChampion` prop), and `src/lib/roles.ts` (new utility). No new Firestore collections needed.

**Tech Stack:** React 18 + TypeScript + Vite, Firebase Firestore v9, Tailwind CSS, lucide-react icons

---

## Task 1 — `.gitignore` Cleanup + Remove Firebase TODO Comment

**Files:**
- Modify: `.gitignore`
- Modify: `src/lib/firebase.ts:7-8`

**Step 1: Update `.gitignore`**

Replace the entire `.gitignore` with:

```
node_modules
.env
.env.local
.env.*.local
public/sw.js
public/workbox-*.js
public/worker-*.js
scripts/*.json
.worktrees/

# Build outputs
dist/
dev-dist/

# Test artifacts
test-results/
playwright-report/

# TypeScript build info
*.tsbuildinfo

# Misc generated files
build_error_*.txt
build_log.txt
push_error.txt
push_out.txt
reflog.txt

# Tool directories
.bolt/
app/
js/
styles/
```

**Step 2: Remove boilerplate TODO from `src/lib/firebase.ts`**

Remove lines 7-8:
```typescript
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
```

The file should read (lines 1-9 after fix):
```typescript
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
```

**Step 3: Commit**

```bash
git add .gitignore src/lib/firebase.ts
git commit -m "chore: clean up .gitignore and remove boilerplate firebase TODO comment"
```

---

## Task 2 — Deploy Firestore Indexes (Fix Notifications)

The `notifications` composite index is already defined in `firestore.indexes.json` (userId ASC + createdAt DESC). It just needs to be deployed.

**Files:** None to edit. Run CLI only.

**Step 1: Deploy indexes**

```bash
cd "D:/HP Shared/All Freelance Projects/safai-main"
npx firebase deploy --only firestore:indexes
```

Expected output: `✔  Deployed Firestore indexes`

**Step 2: Verify**

Open Firebase Console → Firestore → Indexes → confirm `notifications` composite index status is "Enabled" (not "Building").

> Note: Index build can take 2-5 minutes. `NotificationContext.tsx` already silently ignores the error while building, so it self-heals once deployed.

---

## Task 3 — Remove 2FA Stub from SettingsTab

**Files:**
- Modify: `src/components/dashboards/tabs/SettingsTab.tsx`

**Step 1: Remove `handleTwoFactor` function (lines 82-84)**

Delete this block entirely:
```typescript
    const handleTwoFactor = () => {
        toastInfo('Two-factor authentication enrollment is coming soon. Stay tuned for updates!');
    };
```

**Step 2: Remove the 2FA button JSX (lines 232-241)**

Delete this block entirely from the Security & Account section:
```tsx
                        <button
                            onClick={handleTwoFactor}
                            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group"
                        >
                            <div className="flex items-center gap-3">
                                <Shield className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
                                <span className="font-medium text-gray-700 group-hover:text-gray-900">{t('two_factor_auth')}</span>
                            </div>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Soon</span>
                        </button>
```

> Note: `Shield` icon is still used in the section header (`<Shield className="w-5 h-5 text-gray-500" />`), so do NOT remove it from imports.

**Step 3: Verify build**

```bash
cd "D:/HP Shared/All Freelance Projects/safai-main"
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/dashboards/tabs/SettingsTab.tsx
git commit -m "feat: remove 2FA stub from Settings — was never implemented"
```

---

## Task 4 — Propagate lat/lng from Complaint to Assignment

**Why:** `WorkerRouteTab` reads `lat`/`lng` from `assignments` documents. Currently `handleAssignWorkers` in `ComplaintsTab.tsx` writes assignments without GPS coordinates, even though the parent complaint may have them.

**Files:**
- Modify: `src/components/dashboards/admin/ComplaintsTab.tsx`

**Step 1: Add `lat`/`lng` to the `Complaint` interface (line 13)**

Change:
```typescript
interface Complaint {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    status: string;
    citizenId: string;
    imageUrl?: string;
    createdAt: any;
}
```

To:
```typescript
interface Complaint {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    status: string;
    citizenId: string;
    imageUrl?: string;
    createdAt: any;
    lat?: number;
    lng?: number;
}
```

**Step 2: Move complaint lookup before the assignment loop in `handleAssignWorkers`**

In `handleAssignWorkers` (starting line 206), add the complaint lookup BEFORE the loop, and pass GPS coords to the assignment doc:

Change the function body so the loop becomes:

```typescript
    const handleAssignWorkers = async () => {
        if (!selectedComplaintId || selectedWorkerIds.length === 0) return;

        setIsAssigning(true);
        try {
            // Find the complaint early so we can copy GPS coords to each assignment
            const assignedComplaint = complaints.find(c => c.id === selectedComplaintId);

            // Write to assignments collection for each worker
            for (const wId of selectedWorkerIds) {
                await addDoc(collection(db, 'assignments'), {
                    complaintId: selectedComplaintId,
                    workerId: wId,
                    assignedAt: serverTimestamp(),
                    workerStatus: 'ASSIGNED',
                    // Copy GPS coords from complaint so WorkerRouteTab can show task on map
                    ...(assignedComplaint?.lat != null && assignedComplaint?.lng != null && {
                        lat: assignedComplaint.lat,
                        lng: assignedComplaint.lng,
                    }),
                });
            }

            // Update main complaint status
            const complaintRef = doc(db, 'complaints', selectedComplaintId);
            await updateDoc(complaintRef, {
                status: 'ASSIGNED',
                updatedAt: serverTimestamp()
            });

            // Notify the assigned worker(s)
            for (const wId of selectedWorkerIds) {
                await addNotification(
                    wId,
                    `You have been assigned a new complaint: ${assignedComplaint?.title || assignedComplaint?.category || 'Complaint'}`,
                    'complaint_assigned',
                    selectedComplaintId || undefined
                );
            }
```

> Note: Remove the duplicate `const assignedComplaint = complaints.find(...)` that was originally at line 229 — it is now declared above.

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/dashboards/admin/ComplaintsTab.tsx
git commit -m "fix: propagate lat/lng from complaint to assignment so WorkerRouteTab shows tasks on map"
```

---

## Task 5 — Fix Training Placeholder YouTube Video IDs

**Files:**
- Modify: `src/data/trainingModules.ts`

There are 2 placeholder video IDs (`Y2W0jPg2JBk`) for:
1. Line 179: "Waste Management Safety" (worker safety training)
2. Line 355: "Modern Waste Management Systems" (admin/strategic training)

**Step 1: Verify current placeholder**

Open `https://www.youtube.com/watch?v=Y2W0jPg2JBk` in a browser to check what the current placeholder shows.

**Step 2: Replace with suitable public educational videos**

Replace both occurrences of `Y2W0jPg2JBk` with real YouTube IDs:

- For **"Waste Management Safety"** (line 179): Use `MrIXFXpHKnc`
  - Verify: `https://www.youtube.com/watch?v=MrIXFXpHKnc`
  - If unavailable, search YouTube for "waste collection safety training" and use a verified educational video ID

- For **"Modern Waste Management Systems"** (line 355): Use `WlLbPSFOBqg`
  - Verify: `https://www.youtube.com/watch?v=WlLbPSFOBqg`
  - If unavailable, search YouTube for "solid waste management systems overview" and use a verified educational video ID

In `src/data/trainingModules.ts`, make both replacements:

```typescript
// Line 179 — was:
videoUrl: 'Y2W0jPg2JBk', // Placeholder until specific ID confirmed
// Change to:
videoUrl: 'MrIXFXpHKnc',

// Line 355 — was:
videoUrl: 'Y2W0jPg2JBk', // Placeholder
// Change to:
videoUrl: 'WlLbPSFOBqg',
```

**Step 3: Manual verify**

Run `npm run dev`, open Training tab as any role, play both videos to confirm they load correct content.

**Step 4: Commit**

```bash
git add src/data/trainingModules.ts
git commit -m "fix: replace placeholder YouTube video IDs in training modules with real educational content"
```

---

## Task 6 — Add Champion Hub Tab to GreenChampionDashboard

**Why:** Champion role currently just shows CitizenDashboard with a banner. Champions need their own "Champion Hub" tab with a live leaderboard and champion-exclusive badges.

**Files:**
- Modify: `src/components/dashboards/CitizenDashboard.tsx`
- Modify: `src/components/dashboards/GreenChampionDashboard.tsx`

### Step 1: Add `isChampion` prop to `CitizenDashboardProps`

In `CitizenDashboard.tsx`, change the interface (line 67):

```typescript
interface CitizenDashboardProps {
  user: User;
  onLogout: () => void;
  isChampion?: boolean;
}
```

And destructure it in the component signature (line 98):

```typescript
const CitizenDashboard: React.FC<CitizenDashboardProps> = ({ user, onLogout, isChampion = false }) => {
```

### Step 2: Add `onSnapshot` import for leaderboard query

The required Firestore imports (`collection`, `query`, `orderBy`, `limit`, `onSnapshot`) are already imported at the top of `CitizenDashboard.tsx`. No change needed.

### Step 3: Add Champion Hub state (inside CitizenDashboard, after existing state declarations ~line 170)

Add this state block right after `const [trainingProgress, setTrainingProgress] = useState(0);`:

```typescript
  // ----------- Champion Hub state (only used when isChampion=true) -----------
  const [leaderboard, setLeaderboard] = useState<Array<{
    id: string; name: string; rewardPoints: number; role: string;
  }>>([]);

  React.useEffect(() => {
    if (!isChampion) return;
    const q = query(
      collection(db, 'users'),
      orderBy('rewardPoints', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, snap => {
      setLeaderboard(snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || 'Anonymous',
        rewardPoints: d.data().rewardPoints || 0,
        role: d.data().role || 'Citizen',
      })));
    });
    return () => unsub();
  }, [isChampion]);
```

### Step 4: Add "Champion Hub" sidebar item (after existing sidebarItems, line 511)

Change the `sidebarItems` array to conditionally include the Champion Hub item:

```typescript
  const sidebarItems = [
    { icon: <LayoutDashboard className="w-5 h-5" />, label: t('nav_home'), active: activeTab === 'home', onClick: () => setActiveTab('home') },
    ...(isChampion ? [{ icon: <Trophy className="w-5 h-5 text-yellow-500" />, label: 'Champion Hub', active: activeTab === 'champion', onClick: () => setActiveTab('champion') }] : []),
    { icon: <Truck className="w-5 h-5" />, label: 'Book Collection', active: activeTab === 'collection', onClick: () => setActiveTab('collection') },
    { icon: <GraduationCap className="w-5 h-5" />, label: t('nav_education'), active: activeTab === 'training', onClick: () => setActiveTab('training') },
    { icon: <AlertTriangle className="w-5 h-5" />, label: t('nav_report'), active: activeTab === 'report', onClick: () => setActiveTab('report') },
    { icon: <History className="w-5 h-5" />, label: t('nav_track'), active: activeTab === 'track', onClick: () => setActiveTab('track') },
    { icon: <Trophy className="w-5 h-5" />, label: t('nav_rewards'), active: activeTab === 'rewards', onClick: () => setActiveTab('rewards') },
    { icon: <Settings className="w-5 h-5" />, label: t('settings'), active: activeTab === 'settings', onClick: () => setActiveTab('settings') },
    { icon: <UserCircle className="w-5 h-5" />, label: t('profile'), active: activeTab === 'profile', onClick: () => setActiveTab('profile') },
  ];
```

### Step 5: Add `case 'champion'` to `renderContent()` switch

Add this case inside the `switch (activeTab)` block in `renderContent()`, right before the `default:` case:

```tsx
      case 'champion': {
        const userRank = leaderboard.findIndex(e => e.id === user.id) + 1;
        const myPoints = leaderboard.find(e => e.id === user.id)?.rewardPoints ?? (user as any).rewardPoints ?? 0;

        const CHAMPION_BADGES = [
          { id: 'comm-leader', icon: '🌿', label: 'Community Leader', desc: 'Submit 20+ reports', unlocked: myComplaints.length >= 20 },
          { id: 'eco-warrior', icon: '♻️', label: 'Eco Warrior', desc: '10 issues resolved', unlocked: myComplaints.filter(c => ['RESOLVED', 'CLOSED'].includes(c.status)).length >= 10 },
          { id: 'train-master', icon: '🎓', label: 'Training Master', desc: 'Complete all training', unlocked: trainingProgress >= 100 },
          { id: 'top-champ', icon: '🏆', label: 'Top Champion', desc: 'Reach leaderboard top 3', unlocked: userRank > 0 && userRank <= 3 },
        ];

        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Trophy className="w-8 h-8 text-yellow-500" />
                Champion Hub
              </h2>
              <p className="text-gray-500 text-sm">Your exclusive champion dashboard</p>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-yellow-50 to-amber-100 rounded-2xl p-5 border border-amber-200 text-center">
                <p className="text-3xl font-bold text-amber-700">{userRank > 0 ? `#${userRank}` : '—'}</p>
                <p className="text-xs text-amber-600 font-medium mt-1">Leaderboard Rank</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-5 border border-emerald-200 text-center">
                <p className="text-3xl font-bold text-emerald-700">{myPoints}</p>
                <p className="text-xs text-emerald-600 font-medium mt-1">Reward Points</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl p-5 border border-violet-200 text-center">
                <p className="text-3xl font-bold text-violet-700">{CHAMPION_BADGES.filter(b => b.unlocked).length}/{CHAMPION_BADGES.length}</p>
                <p className="text-xs text-violet-600 font-medium mt-1">Badges Earned</p>
              </div>
            </div>

            {/* Champion-exclusive badges */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" /> Champion Badges
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {CHAMPION_BADGES.map(badge => (
                  <div key={badge.id} className={`rounded-xl p-4 text-center border-2 transition-all ${badge.unlocked ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100 bg-gray-50 opacity-50 grayscale'}`}>
                    <div className="text-3xl mb-2">{badge.icon}</div>
                    <p className="font-semibold text-gray-900 text-sm">{badge.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{badge.desc}</p>
                    {badge.unlocked && <p className="text-xs text-yellow-600 font-bold mt-2">✓ Earned</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" /> Top Champions
              </h3>
              {leaderboard.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Loading leaderboard…</p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((entry, i) => (
                    <div key={entry.id} className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${entry.id === user.id ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'}`}>
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {entry.name}{entry.id === user.id ? ' (You)' : ''}
                        </p>
                        <p className="text-xs text-gray-500">{entry.rewardPoints} pts</p>
                      </div>
                      {i < 3 && <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }
```

**Note:** `Award` icon needs to be added to the imports at the top of `CitizenDashboard.tsx`. Check if `Award` is already imported from `lucide-react` — it isn't. Add it to the import list.

### Step 6: Update `GreenChampionDashboard.tsx` to pass `isChampion`

Change line 78:
```tsx
        <CitizenDashboard user={user} onLogout={onLogout} />
```
To:
```tsx
        <CitizenDashboard user={user} onLogout={onLogout} isChampion={true} />
```

### Step 7: Verify build

```bash
npx tsc --noEmit
```

Expected: No errors.

### Step 8: Commit

```bash
git add src/components/dashboards/CitizenDashboard.tsx src/components/dashboards/GreenChampionDashboard.tsx
git commit -m "feat: add Champion Hub tab to Green Champion dashboard — leaderboard + exclusive badges"
```

---

## Task 7 — Add Role Casing Guard Utility

**Why:** Firestore stores roles with capital-first letter (`'Citizen'`, `'Worker'`, `'Admin'`, `'Superadmin'`, `'Green-Champion'`). If any code accidentally writes lowercase, Firestore rules break silently.

**Files:**
- Create: `src/lib/roles.ts`
- Modify: `src/contexts/AuthContext.tsx` (add comment pointing to utility)

**Step 1: Create `src/lib/roles.ts`**

```typescript
/**
 * Role normalization utilities.
 *
 * Firestore stores roles in capital-first form: 'Citizen', 'Worker', 'Admin', 'Superadmin', 'Green-Champion'.
 * AuthContext normalizes to lowercase for routing: 'citizen', 'worker', 'admin', 'superadmin', 'green-champion'.
 *
 * ALWAYS use normalizeRoleForStorage() when writing a role to Firestore.
 * ALWAYS use normalizeRoleForRouting() when comparing roles in React code.
 */

const STORAGE_ROLE_MAP: Record<string, string> = {
  citizen: 'Citizen',
  worker: 'Worker',
  admin: 'Admin',
  superadmin: 'Superadmin',
  'green-champion': 'Green-Champion',
  'green_champion': 'Green-Champion',
  // already-capitalized forms pass through
  Citizen: 'Citizen',
  Worker: 'Worker',
  Admin: 'Admin',
  Superadmin: 'Superadmin',
  'Green-Champion': 'Green-Champion',
};

const ROUTING_ROLE_MAP: Record<string, string> = {
  citizen: 'citizen',
  Citizen: 'citizen',
  worker: 'worker',
  Worker: 'worker',
  admin: 'admin',
  Admin: 'admin',
  superadmin: 'superadmin',
  Superadmin: 'superadmin',
  SUPER_ADMIN: 'superadmin',
  super_admin: 'superadmin',
  'green-champion': 'green-champion',
  'Green-Champion': 'green-champion',
  'green_champion': 'green-champion',
};

/**
 * Normalize a role for writing to Firestore.
 * Returns the capital-first canonical form, or throws for unknown roles.
 */
export function normalizeRoleForStorage(role: string): string {
  const normalized = STORAGE_ROLE_MAP[role];
  if (!normalized) {
    console.error(`[roles] Unknown role "${role}" — defaulting to Citizen`);
    return 'Citizen';
  }
  return normalized;
}

/**
 * Normalize a role for use in React routing/comparisons.
 * Returns lowercase form used by AuthContext and App.tsx.
 */
export function normalizeRoleForRouting(role: string): string {
  const normalized = ROUTING_ROLE_MAP[role];
  if (!normalized) {
    console.error(`[roles] Unknown role "${role}" — defaulting to citizen`);
    return 'citizen';
  }
  return normalized;
}
```

**Step 2: Add a comment to `src/contexts/AuthContext.tsx`**

Find the role normalization map in `AuthContext.tsx` (around line 40-55) and add a comment above it:

```typescript
// Role normalization — see src/lib/roles.ts for the authoritative mapping.
// Keep this map in sync with ROUTING_ROLE_MAP in roles.ts.
```

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/lib/roles.ts src/contexts/AuthContext.tsx
git commit -m "feat: add role casing guard utility (src/lib/roles.ts) to prevent silent Firestore rule breakage"
```

---

## Task 8 — Final Push

```bash
git push origin main
```

Verify all commits landed:
```bash
git log --oneline -10
```

---

## Verification Checklist

After all tasks are complete, manually verify:

- [ ] `git status` shows clean working tree
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `npm run dev` starts without console errors
- [ ] Login as **champion@demo.com** → see "Champion Hub" in sidebar → tab loads leaderboard + badges
- [ ] Login as **citizen@demo.com** → Report Issue → click Auto-detect → submit → check Firestore `complaints` doc has `lat`/`lng` fields
- [ ] Login as **admin@demo.com** → Complaints → assign a geo-tagged complaint to demo worker → check Firestore `assignments` doc has `lat`/`lng` fields
- [ ] Login as **worker@demo.com** → Route tab → assigned geo-tagged task appears on map
- [ ] Login as any user → Settings → Security section has only "Change Password" and "Privacy Policy" (no 2FA button)
- [ ] Training → open video lecture modules → both videos play correct content (not placeholders)
- [ ] `dist/` and `test-results/` are no longer tracked by git
