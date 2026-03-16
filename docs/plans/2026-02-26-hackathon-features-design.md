# Safai Connect — Hackathon Feature Pack Design

**Date:** 2026-02-26
**Deadline:** 2026-03-10
**Approved by:** User

---

## Overview

Five features to take Safai Connect from functional to impressive for the hackathon demo:

1. **Enhanced Reports** — Worker leaderboard, 6-month trend, PDF print, reports in AdminDashboard
2. **Complaint Heatmap** — Leaflet map with heat layer driven by real complaint lat/lng
3. **Worker Route Optimization** — Visual proximity-sorted task map in WorkerDashboard
4. **AI Auto-Categorization** — Gemini 1.5 Flash suggests complaint category from description
5. **Firebase Push Notifications (FCM Full)** — Real push to browser + Android for all events + admin broadcasts

---

## Feature 1: Enhanced Reports

### What changes

**ReportsTab (`src/components/dashboards/tabs/ReportsTab.tsx`)** — 3 additions:

1. **6-month trend line chart** — SVG path (no library), queries complaints grouped by calendar month for the last 6 months. Two lines: submitted vs resolved. Shows improvement trend.

2. **Worker Performance Rankings card** — Reads `assignments` (workerStatus == 'COMPLETED'), groups by `workerId`, joins `users` (name), joins `ratings` (avg stars). Renders a leaderboard: rank, avatar initials, name, tasks done, avg rating stars, progress bar.

3. **PDF/Print export** — `window.print()` button. A `@media print` CSS class on the report container hides nav/sidebar and prints the charts cleanly. Zero dependencies.

**AdminDashboard (`src/components/dashboards/AdminDashboard.tsx`)** — Import and render `<ReportsTab />` in a new "reports" tab. One import + one sidebar item + one case in `renderContent()`.

### Data sources
- Complaints: existing `complaints` collection
- Worker performance: `assignments` (workerId, workerStatus, completedAt) + `users` (name) + `ratings` (rating 1-5)

---

## Feature 2: Complaint Heatmap

### Libraries
```
npm install leaflet react-leaflet react-leaflet-heat @types/leaflet
```
No API key. No billing. Pure open source.

### Data flow

**Step A — Save lat/lng on complaint creation**
In `CitizenDashboard.tsx`, the complaint form already captures GPS coordinates for the address lookup. Add `lat` and `lng` number fields to the Firestore write in `handleSubmitReport`.

**Firestore complaint document** (new fields):
```
lat?: number   // e.g. 18.5204
lng?: number   // e.g. 73.8567
```

**Step B — HeatmapTab component**
New file: `src/components/dashboards/HeatmapTab.tsx`

- Queries all complaints, filters to those with `lat` + `lng`
- Builds heatmap points: `[lat, lng, intensity]` where intensity is status-weighted (SUBMITTED=0.5, ASSIGNED=0.7, RESOLVED=0.2)
- Renders `<MapContainer center={[20.5, 78.9]} zoom={5}>` (India centred)
- Uses `<TileLayer>` from OpenStreetMap (free)
- Uses `<HeatmapLayer>` from react-leaflet-heat
- Top filters: period (7d/30d/all) + category dropdown

**Step C — Wire into dashboards**
Add HeatmapTab to SuperadminDashboard and AdminDashboard sidebars.

**Step D — Seed script update**
Update `scripts/seed-demo.ts` to include `lat`/`lng` on demo complaints near Mumbai, Delhi, Bangalore, Chennai, Kolkata — so the heatmap has data on day one.

### Leaflet CSS
Add to `src/index.css`:
```css
@import 'leaflet/dist/leaflet.css';
```
Fix default marker icon path issue (known react-leaflet quirk):
```typescript
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: ..., iconUrl: ..., shadowUrl: ... });
```

---

## Feature 3: Worker Route Optimization

### Approach
No routing API. Haversine distance sort + Leaflet visual map. Impressive visually, zero API cost.

### New tab: "Route" in WorkerDashboard

**New file: `src/components/dashboards/WorkerRouteTab.tsx`**

1. Get worker's current position via `@capacitor/geolocation` (already installed)
2. Tasks already have `location` text. After lat/lng is saved on complaints, tasks have `lat`/`lng` too.
3. Sort tasks by Haversine distance from worker's position (nearest first)
4. Render `<MapContainer>` with:
   - Worker marker: green pulsing circle at current position
   - Task markers: numbered (1, 2, 3…) divIcon, coloured by status (yellow=pending, green=completed)
   - Dashed `<Polyline>` connecting worker → task1 → task2 → … (the optimized route visual)
5. Below map: re-ordered task list showing `📍 0.8 km · Waste Overflow · ASSIGNED`

**Haversine helper** (pure TS, no library):
```typescript
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

**Fallback:** If worker denies location permission, show tasks in assignment order (no map, just the list).

---

## Feature 4: AI Auto-Categorization

### New Vercel function: `api/categorize.ts`

Accepts POST `{ description: string, language: string }`.
Calls Gemini 1.5 Flash (`gemini-1.5-flash-latest`) via REST:
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=GEMINI_API_KEY
```

Prompt (system + user):
```
You are a municipal complaint classifier for an Indian city app.
Given the complaint description, respond with ONLY valid JSON:
{ "category": "<one of the fixed categories>", "confidence": <0.0-1.0>, "reason": "<10 words max>" }

Fixed categories: Waste Management, Road Damage, Street Lighting, Drainage/Sewage, Public Property Damage, Water Supply, Noise Pollution, Other

Description: "<user text>"
```

Returns `{ category, confidence, reason }`.
Env var: `GEMINI_API_KEY`

### UI in CitizenDashboard

- After description has ≥ 20 chars, debounce 1.5s, call `/api/categorize`
- Show animated chip below textarea: `✨ AI Suggestion: Waste Management · 94%`
- Two buttons: `[Use this]` (sets category dropdown) and `[✕]` (dismiss)
- Spinner during API call (replace chip text with loading dots)
- Never blocks form submission — user can always choose manually

---

## Feature 5: Firebase Push Notifications (Full FCM)

### Architecture

```
User action → Firestore write → client calls api/notify.ts → FCM → device push
```

No Cloud Functions needed. The client that performs the Firestore write also fires the `api/notify.ts` call.

### Files

**`public/firebase-messaging-sw.js`** — Firebase background message handler service worker:
```javascript
importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-messaging-compat.js');
firebase.initializeApp({ ... same config ... });
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon-192x192.png'
  });
});
```

**`src/lib/fcm.ts`** — Token management:
```typescript
export async function requestAndSaveFCMToken(userId: string): Promise<void>
// Gets permission → getToken(messaging, { vapidKey }) → saves to users/{uid}.fcmToken
```

**`api/notify.ts`** — Vercel serverless function:
- Accepts `{ tokens: string[], title: string, body: string, data?: Record<string,string> }`
- Uses `firebase-admin` Messaging to send multicast push
- Env var: `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON stringified service account key)

**`src/contexts/AuthContext.tsx`** — After login success, call `requestAndSaveFCMToken(uid)`.

**Triggers** (added to existing components):
| Event | Component | Target |
|-------|-----------|--------|
| Task assigned to worker | `ComplaintsTab.tsx` | Worker's FCM token |
| Complaint resolved | `VerificationTab.tsx` | Citizen's FCM token |
| Admin broadcasts | New `BroadcastPanel.tsx` | All citizens / all workers / everyone |

**`src/components/admin/BroadcastPanel.tsx`** — New UI panel in AdminDashboard:
- Title input + body textarea
- Audience selector: Citizens / Workers / All
- Send button → fetches matching FCM tokens from `users` collection → calls `api/notify.ts`
- Mounted as a card in AdminDashboard overview or as a new sidebar tab

### vite-plugin-pwa config update
The existing PWA SW (`sw.js`) and Firebase messaging SW (`firebase-messaging-sw.js`) must co-exist. Solution: set `injectManifest` mode in vite-plugin-pwa config, merge both SW files, or use `additionalManifestEntries` to avoid caching the messaging SW.

### Manual steps (user does these):
1. Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate VAPID key → add `VITE_FIREBASE_VAPID_KEY` to `.env`
2. Firebase Console → Project Settings → Service Accounts → Generate new private key → download JSON → add as `FIREBASE_SERVICE_ACCOUNT_JSON` env var in Vercel (stringify the JSON)
3. Re-install firebase-admin: `npm install firebase-admin`

---

## Implementation Order (recommended)

Given the dependency chain (lat/lng needed for heatmap + routes):

1. **Lat/lng on complaints** (30 min) — unblocks heatmap + routes
2. **AI categorization** (2h) — independent, quick win
3. **Enhanced Reports** (3h) — low risk, high visibility
4. **FCM** (5h) — most complex, do in one focused session
5. **Heatmap** (3h) — depends on lat/lng + react-leaflet install
6. **Route optimization** (3h) — depends on heatmap (same library, same lat/lng)
7. **Seed script update** (1h) — add lat/lng to demo data

**Total estimate:** ~18 hours over ~12 days. Achievable.

---

## New Files Summary

| File | Purpose |
|------|---------|
| `api/categorize.ts` | Gemini AI category suggestion |
| `api/notify.ts` | FCM push sender |
| `src/lib/fcm.ts` | Token request + save |
| `src/components/dashboards/HeatmapTab.tsx` | Leaflet heatmap |
| `src/components/dashboards/WorkerRouteTab.tsx` | Leaflet route map |
| `src/components/admin/BroadcastPanel.tsx` | Admin push broadcast UI |
| `public/firebase-messaging-sw.js` | FCM background message SW |

## Modified Files Summary

| File | Change |
|------|--------|
| `src/components/dashboards/CitizenDashboard.tsx` | Save lat/lng on submit + AI suggestion UI |
| `src/components/dashboards/tabs/ReportsTab.tsx` | + trend chart + worker rankings + print |
| `src/components/dashboards/AdminDashboard.tsx` | + Reports tab + Heatmap tab + Broadcast panel |
| `src/components/dashboards/SuperadminDashboard.tsx` | + Heatmap tab |
| `src/components/dashboards/WorkerDashboard.tsx` | + Route tab |
| `src/components/dashboards/admin/ComplaintsTab.tsx` | Notify worker after assign |
| `src/components/dashboards/admin/VerificationTab.tsx` | Notify citizen after resolve |
| `src/contexts/AuthContext.tsx` | Request + save FCM token post-login |
| `src/index.css` | Import leaflet CSS |
| `package.json` | + leaflet, react-leaflet, react-leaflet-heat, @types/leaflet, firebase-admin |
| `scripts/seed-demo.ts` | + lat/lng on demo complaints |
| `vite.config.ts` | Update PWA config for FCM SW co-existence |
