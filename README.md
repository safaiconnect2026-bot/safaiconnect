# Safai Connect

A full-stack waste management and civic cleanliness platform built with React, TypeScript, and Firebase. Citizens report issues, workers resolve them, and administrators manage operations — all in one system, available as a web app and Android APK.

---

## Features

### Role-Based Dashboards
| Role | Capabilities |
|------|-------------|
| **Superadmin** | Platform-wide overview, admin invitations, training material uploads, inventory management, demo data seeding |
| **Admin** | Worker management, complaint assignment & verification, reports, zone settings, salary records |
| **Worker** | Assigned task queue, GPS-tagged photo evidence submission, attendance check-in/out, salary view, training |
| **Green Champion** | Citizen-facing volunteer portal, complaint escalation, awareness campaigns |
| **Citizen** | File complaints with geo-tagged photos, track status, book waste collection, rate service |

### Core Modules
- **Complaint Management** — Citizens file photo complaints; admins assign to workers; workers submit GPS-tagged before/after evidence; citizens rate resolution
- **Worker Attendance** — Check-in/out with 4-hour minimum shift gate; admins view records
- **Salary Records** — Admins manage monthly salary data; workers view their own records
- **Training System** — Superadmin uploads PDFs/videos to Firebase Storage; workers and citizens complete training modules with progress tracking
- **Inventory Management** — Superadmin manages equipment/supplies stock
- **Collection Bookings** — Citizens schedule waste pickups; workers mark completion
- **Heatmap Analytics** — Leaflet-powered complaint density heatmap for admins
- **Broadcast Notifications** — Admins send push notifications to user segments
- **Admin Invite Pipeline** — Superadmin creates `pending_admins` entries; invited users get admin role applied on first login

### Technical Highlights
- **9 Languages** — English, Hindi, Bengali, Gujarati, Kannada, Marathi, Tamil, Telugu, Urdu (i18next)
- **PWA** — Installable web app with offline-ready service worker (Workbox)
- **Android APK** — Capacitor 8 wrapping the web app (`com.safaiconnect.app`)
- **Firebase** — Auth, Firestore, Storage; role-based security rules
- **Photo uploads** — 5 MB guard, 3-attempt retry with 2s backoff, GPS tagging via Capacitor Geolocation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| Backend / DB | Firebase (Auth, Firestore, Storage) |
| Maps | Leaflet + react-leaflet, leaflet.heat |
| Internationalisation | i18next, react-i18next |
| Mobile | Capacitor 8 (Android) |
| Deployment | Vercel (web) |
| PWA | vite-plugin-pwa, Workbox |

---

## Project Structure

```
src/
├── components/
│   ├── dashboards/
│   │   ├── AdminDashboard.tsx
│   │   ├── CitizenDashboard.tsx
│   │   ├── GreenChampionDashboard.tsx
│   │   ├── SuperadminDashboard.tsx
│   │   ├── WorkerDashboard.tsx
│   │   ├── tabs/          # Admin tabs (Overview, Workers, Complaints, Reports, Inventory, Settings, Salary, TrainingUpload)
│   │   └── admin/         # Admin sub-panels (AdminManagement, Verification)
│   ├── training/          # Training module UI
│   └── common/            # Shared UI components
├── contexts/              # AuthContext, ThemeContext, NotificationContext, ToastContext, LanguageContext
├── lib/                   # Firebase initialisation
├── locales/               # i18n JSON files (en, hi, bn, gu, kn, mr, ta, te, ur)
├── hooks/                 # Custom React hooks
├── types/                 # Shared TypeScript types
└── utils/                 # Utility functions
```

---

## Getting Started

### Prerequisites
- Node.js 22+
- A Firebase project with Auth, Firestore, and Storage enabled

### Installation

```bash
git clone <repo-url>
cd safai-main
npm install
```

### Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password + Google)
3. Enable **Firestore** in production mode
4. Enable **Storage**
5. Copy your Firebase config into `src/lib/firebase.ts`
6. Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules,storage
```

7. Deploy Firestore indexes:

```bash
firebase deploy --only firestore:indexes
```

### Environment / Config

All Firebase credentials live in `src/lib/firebase.ts`. There is no `.env` file required — config is embedded at build time via Vite.

### Run Locally

```bash
npm run dev
```

App runs at `http://localhost:5173`.

---

## User Roles & Access

Roles are stored in Firestore (`users/{uid}.role`) and applied at login via `AuthContext`. The `pending_admins` collection is used for the admin invitation pipeline — Superadmin creates an invite entry and the new admin gets their role on first sign-in.

| Role string (Firestore) | Dashboard |
|-------------------------|-----------|
| `Superadmin` | SuperadminDashboard |
| `Admin` | AdminDashboard |
| `Worker` | WorkerDashboard |
| `Green-champion` | GreenChampionDashboard |
| `Citizen` (default) | CitizenDashboard |

> Citizens are auto-created in Firestore on their first login — no manual setup needed.

---

## Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `users` | All user profiles + roles |
| `complaints` | Citizen-filed complaints |
| `assignments` | Worker task assignments |
| `completion_evidence` | Worker photo/GPS evidence |
| `ratings` | Citizen ratings for resolved complaints |
| `inventory` | Equipment/supplies stock |
| `attendance` | Worker check-in/out records |
| `collection_bookings` | Citizen waste-pickup bookings |
| `salary_records` | Worker salary entries |
| `training` | Training modules |
| `training_materials` | Superadmin-uploaded PDFs/videos |
| `notifications` | Per-user notification entries |
| `pending_admins` | Admin invite pipeline |

---

## Deployment

### Web (Vercel)

The project deploys automatically to Vercel. All routes are rewritten to `index.html` for SPA routing:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

To deploy manually:

```bash
npm run build
vercel --prod
```

### Android APK

See **[MOBILE.md](./MOBILE.md)** for the full Android build guide (Android Studio, Gradle, debug/release APK, adb install).

Quick reference:

```bash
npm run build          # Build web assets
npx cap sync android   # Sync to Android project
npx cap open android   # Open in Android Studio → Build APK
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build (TypeScript + Vite) |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build locally |
| `npm run mobile:build` | Build + sync to Android (`cap sync`) |
| `npm run mobile:android` | Open Android Studio |

---

## Internationalisation

The app supports 9 languages selectable at runtime. Translation files live in `src/locales/*.json`. Language is detected from the browser and can be changed in-app via the Language context.

| Code | Language |
|------|----------|
| `en` | English |
| `hi` | Hindi |
| `bn` | Bengali |
| `gu` | Gujarati |
| `kn` | Kannada |
| `mr` | Marathi |
| `ta` | Tamil |
| `te` | Telugu |
| `ur` | Urdu |

---

## Security

Firestore security rules enforce role-based access at the database level — frontend role checks are UI-only. Key rules:

- Only **Superadmin** can write inventory, training materials, and delete most records
- **Admin** can manage users, assign complaints, manage salary records
- **Workers** can update their own assignments and attendance
- **Citizens** can read public data and create/update their own records

See [`firestore.rules`](./firestore.rules) and [`storage.rules`](./storage.rules) for the full rule set.

---

## Contributing

1. Create a feature branch from `master`
2. Follow the existing TypeScript + Tailwind conventions
3. Keep i18n keys in sync across all 9 locale files
4. Open a PR against `master`
