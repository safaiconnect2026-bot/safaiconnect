# Sprint 3 — Auth Pipeline, Bug Fixes & Features

**Date:** 2026-03-03
**Branch:** `claude/sprint-3`
**Approved by:** User (2026-03-03)

---

## Scope

### Group 1: Auth & Signup Pipeline
- Remove Admin/Superadmin from public signup role selector
- Existing user hits signup → auto-sign-in and redirect to dashboard (no re-registration)
- Fix Superadmin "Add Admin" pipeline (createUserWithEmailAndPassword + setDoc + sendPasswordResetEmail)

### Group 2: Critical Bug Fixes (Trello "To Do")
1. Profile not editing on any dashboard — wire updateDoc in ProfilePage
2. Dark mode toggle does nothing — connect to ThemeContext/localStorage
3. Change password not working — wire updatePassword Firebase Auth
4. Scrap Collection booking button stuck loading — fix state reset after addDoc
5. Training progress resets + logout on reload — persist progress to Firestore
6. Firebase Storage timeout on Report Issue uploads — retry logic + file size guard
7. Bypass redundant login after worker signup — auto sign-in after successful signup

### Group 3: Features
1. Worker Salary Tab — salary records table in WorkerDashboard
2. Admin Salary Tracking — all-workers salary table in AdminDashboard
3. Training Data Upload (Superadmin) — upload PDFs/videos to Storage, write to `training` collection
4. Unique IDs for users — ensure citizenID/workerID generated on creation

### Skipped
- Cloudinary Integration (Firebase Storage sufficient, large migration)
- Smoke testing / mobile testing (manual QA)

---

## Architecture & Data Flow

### Auth Pipeline
- `SignupPage.tsx`: Remove `admin` and `superadmin` `<option>` elements
- `SignupPage.tsx` email flow: After `createUserWithEmailAndPassword`, check if Firestore doc exists. If yes → skip setDoc, call `signInWithEmailAndPassword` silently, let AuthContext route to dashboard
- `SignupPage.tsx` Google flow: In `getRedirectResult` useEffect, if doc exists → skip setDoc, let AuthContext handle routing
- `SuperadminDashboard` Admin Management Tab: Fix `handleAddAdmin` — use Firebase Auth REST API (`createUserWithEmailAndPassword`) or write a callable Cloud Function alternative. Since no Admin SDK available client-side, use `createUserWithEmailAndPassword` then immediately `sendPasswordResetEmail`, then `signOut` the newly created user, then restore the superadmin session

### Profile Editing
- `ProfilePage.tsx`: The "Save" button currently calls no Firestore write. Wire `updateDoc(doc(db, 'users', user.id), { name, phone, address, ... })` on submit
- Also update Firebase Auth displayName via `updateProfile(currentUser, { displayName: name })`

### Dark Mode
- `SettingsTab.tsx`: The toggle updates local state only. Wire it to `document.documentElement.classList.toggle('dark')` and persist to `localStorage('theme')`
- On app mount in `App.tsx` or `main.tsx`: read `localStorage('theme')` and apply class

### Change Password
- `ProfilePage.tsx` or dedicated password section: collect `currentPassword` + `newPassword`, call `reauthenticateWithCredential(currentUser, EmailAuthProvider.credential(email, currentPassword))` then `updatePassword(currentUser, newPassword)`

### Scrap Collection Booking
- `CitizenDashboard.tsx` booking section: After `addDoc` resolves, set `isBooking = false` and show success. The loading state is never reset on success.

### Training Progress
- Currently stored in component state only. Persist completed module IDs to `users/{uid}.completedTraining` array via `updateDoc` with `arrayUnion`. On mount, read from Firestore snapshot.

### Firebase Storage Timeout
- `CitizenDashboard.tsx` Report Issue upload: Wrap `uploadBytes` in retry logic (max 3 attempts, 2s backoff). Add 10MB file size check before upload attempt.

### Salary — Worker Tab
- New `SalaryTab` component inside `WorkerDashboard.tsx`
- Query: `salary_records` where `workerId == user.id` orderBy `createdAt desc`
- Display: month, baseSalary, overtime, deductions, netSalary, status (Paid/Pending/Overdue)
- StatCards: total earned YTD, last payment date, next payment due

### Salary — Admin Tab
- `SalaryTab` in AdminDashboard
- Query: all `salary_records` (admin can read all per Firestore rules)
- Group by worker, show status badges, allow admin to mark as Paid

### Training Upload (Superadmin)
- In `SuperadminDashboard` Training tab: Add "Upload Material" button
- File input (PDF, MP4, max 50MB) → upload to `training-materials/{filename}` in Storage
- On success: `addDoc` to `training` collection with `{ title, fileUrl, type, uploadedBy, createdAt }`
- Display list of uploaded materials with download links

### Unique IDs
- `AuthContext.tsx` auto-create block: Ensure `citizenID: 'CIT-' + uid.slice(-6).toUpperCase()` is set
- `SignupPage.tsx` email flow: Already sets `citizenID` — verify it uses uid not random

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/SignupPage.tsx` | Remove admin/superadmin options; existing-user auto-signin |
| `src/components/common/ProfilePage.tsx` | Wire updateDoc + updateProfile + change password |
| `src/components/dashboards/tabs/SettingsTab.tsx` | Wire dark mode to DOM + localStorage |
| `src/components/dashboards/CitizenDashboard.tsx` | Fix booking loading state; fix Storage upload retry |
| `src/components/dashboards/WorkerDashboard.tsx` | Add Salary tab |
| `src/components/dashboards/AdminDashboard.tsx` | Add Salary tab |
| `src/components/dashboards/SuperadminDashboard.tsx` | Fix Add Admin pipeline |
| `src/components/training/TrainingSystem.tsx` | Persist progress to Firestore |
| `src/contexts/AuthContext.tsx` | Ensure citizenID set on auto-create |
| `src/App.tsx` | Read theme from localStorage on mount |

---

## Task Order

1. SignupPage — remove admin/superadmin options + existing-user auto-signin
2. ProfilePage — wire save (updateDoc + updateProfile) + change password
3. SettingsTab — wire dark mode toggle
4. CitizenDashboard — fix booking stuck loading + Storage upload retry
5. TrainingSystem — persist progress to Firestore
6. WorkerDashboard — add Salary tab
7. AdminDashboard — add Salary tracking tab
8. SuperadminDashboard — fix Add Admin pipeline
9. Training Upload — Superadmin training materials upload
10. AuthContext + App.tsx — unique IDs + theme persistence on mount
