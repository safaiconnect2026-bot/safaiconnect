# Safai Connect — Full Rebuild Design
**Date:** 2026-02-26
**Deadline:** 2026-03-10 (Hackathon)
**Approach:** B — Layered Sequential

---

## Goal
Deliver a fully working web app + Android APK for Safai Connect — a municipal waste/cleanliness management platform. Every role is fully functional, all features are activated, build errors are resolved, codebase is clean, and deployment targets Vercel.

---

## Layer 1: Cleanup & Build Foundation

### Remove
- `src/firebase.js` — old duplicate using env vars, never imported
- `@supabase/supabase-js` — zero usage in codebase
- `firebase-admin` — server-only SDK, has no place in a Vite/browser app
- `next-pwa` — ghost dep, project uses `vite-plugin-pwa`

### Fix
- Replace `git-branch-plus` lucide icon (does not exist in installed version) with `GitFork` everywhere used
- Keep `src/lib/firebase.ts` as the single Firebase config (hardcoded is fine for hackathon)
- Add `vercel.json` with SPA rewrite rule

### Add
- `vercel.json`:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```

---

## Layer 2: Roles — Fixed End-to-End

### Role → Dashboard Mapping
| Firestore Role | Dashboard | Core Features |
|---|---|---|
| `Superadmin` | SuperadminDashboard | Overview stats, Admin CRUD, Inventory CRUD, Reports, Training, Settings, Profile |
| `Admin` | AdminDashboard | Complaints (assign/review/delete), Workers, Work Verification, Salary, Training, Settings, Profile |
| `Worker` | WorkerDashboard | My Tasks, Attendance check-in/out, QR, Evidence upload, Training, Profile, Settings |
| `Citizen` | CitizenDashboard | File complaint (photo+GPS), Collection booking, Rewards, Training, Profile, Settings |
| `Green-Champion` | GreenChampionDashboard | Citizen features + champion badge + leaderboard |

### Case Sensitivity Fix
- Firestore always stores: `'Citizen'`, `'Worker'`, `'Admin'`, `'Superadmin'`, `'Green-Champion'`
- `AuthContext` normalises to lowercase for routing — this chain is correct and stays
- **Fix point:** Signup form must write capitalised role. Add `capitaliseRole()` util
- Add `green-champion` case to `App.tsx` `renderDashboard()` switch

### New: GreenChampionDashboard
- Thin wrapper around CitizenDashboard
- Adds: green champion banner, badge display, leaderboard position from `users` collection ordered by `rewardPoints`
- No new Firestore collection needed

---

## Layer 3: Feature Activation

| Feature | Component | Action |
|---|---|---|
| Training completion tracking | `TrainingSystem.tsx` | Wire `training_progress` Firestore collection — write on module complete, read on load |
| Complaint GPS | CitizenDashboard complaint form | Activate `navigator.geolocation` on form open, store `lat/lng` on complaint doc |
| Reward points on resolution | AdminDashboard `ComplaintsTab` | On status → `RESOLVED`, increment `rewardPoints` on citizen's user doc |
| Ratings modal | CitizenDashboard | Trigger rating modal when complaint status becomes `RESOLVED` |
| Collection bookings | CitizenDashboard | Wire booking form → `collection_bookings` collection |
| Attendance geolocation | WorkerDashboard | Activate geolocation permission on check-in, store coords |
| Reports charts | Superadmin `ReportsTab` | Confirm live Firestore data renders; add simple bar/line charts if missing |
| Notifications (demo) | All dashboards | Add `notifications` collection; write on complaint status change; show bell icon with count |

---

## Layer 4: Firestore Schema & Deployment

### New Collections
- `training_progress`: `{ userId, moduleId, completedAt, score }`
- `notifications`: `{ userId, message, read, createdAt, type }`

### Deployment
- Platform: **Vercel**
- Build command: `npm run build`
- Output directory: `dist`
- SPA routing: `vercel.json` rewrite rule
- Firebase config: hardcoded in `src/lib/firebase.ts` (acceptable for hackathon)

### Seed Script
- `scripts/seed.ts` — creates one test user doc per role in Firestore for demo day
- Roles seeded: Superadmin, Admin, Worker, Citizen, Green-Champion

---

## Layer 5: Mobile (Android APK via Capacitor)

### Approach
- Capacitor already configured (`com.safaiconnect.app`, `webDir: dist`)
- After web app build passes: `npm run mobile:build` → syncs dist to Android project
- Open in Android Studio: `npx cap open android`
- Generate signed APK from Android Studio for demo

### Mobile-Specific Section
- Dedicated `MOBILE.md` in project root documenting:
  - Build steps
  - Android Studio requirements
  - How to generate signed APK
  - Capacitor plugin usage (Camera, Geolocation)
- Capacitor plugins already installed: `@capacitor/camera`, `@capacitor/geolocation`
- Add Android permissions to `AndroidManifest.xml`:
  - `CAMERA`
  - `ACCESS_FINE_LOCATION`
  - `ACCESS_COARSE_LOCATION`
  - `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE`

---

## File Structure After Cleanup
```
src/
  lib/firebase.ts          ← single firebase config (keep)
  contexts/AuthContext.tsx ← role normalisation (keep + fix signup write)
  utils/roleUtils.ts       ← NEW: capitaliseRole(), getRoleDashboard()
  components/dashboards/
    SuperadminDashboard.tsx
    AdminDashboard.tsx
    WorkerDashboard.tsx
    CitizenDashboard.tsx
    GreenChampionDashboard.tsx  ← NEW
  ...
docs/plans/                ← this file
MOBILE.md                  ← NEW: dedicated mobile build guide
vercel.json                ← NEW
scripts/seed.ts            ← NEW
```

---

## Success Criteria (Hackathon Demo)
- [ ] `npm run build` completes with zero errors
- [ ] All 5 roles can log in and see their correct dashboard
- [ ] Citizen can file a complaint with photo + GPS
- [ ] Admin can assign complaint to a worker
- [ ] Worker can mark task complete with photo evidence
- [ ] Superadmin sees live stats on overview
- [ ] Training modules are completable and progress is saved
- [ ] Reward points increment on complaint resolution
- [ ] App deploys to Vercel and is publicly accessible
- [ ] Android APK builds and runs on a test device
