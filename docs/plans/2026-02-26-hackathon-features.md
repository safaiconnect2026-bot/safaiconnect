# Safai Connect Hackathon Feature Pack — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 5 features to Safai Connect: Enhanced Reports (Admin + Superadmin), Complaint Heatmap, Worker Route Optimization, AI Auto-Categorization, and Full Firebase Push Notifications.

**Architecture:** New Vercel serverless functions in `api/`, new React components in `src/components/dashboards/`, and surgical edits to existing dashboards to wire them in. Leaflet (no API key) for maps. Gemini 1.5 Flash for AI. Firebase Admin SDK used only in serverless functions.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind CSS, Leaflet + react-leaflet (maps), leaflet.heat (heatmap), Firebase Messaging (FCM), firebase-admin (serverless only), Gemini 1.5 Flash REST API, Vercel serverless functions.

**Project root:** `D:\HP Shared\All Freelance Projects\safai-main`

---

## Task 1: Install Dependencies + Leaflet CSS + Type Declaration

**Files:**
- Modify: `src/index.css`
- Create: `src/types/leaflet-heat.d.ts`

**Step 1: Install all new packages**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main"
npm install leaflet react-leaflet leaflet.heat firebase-admin
npm install --save-dev @types/leaflet
```

Expected: packages added, no errors.

**Step 2: Add Leaflet CSS import to `src/index.css`**

Open `src/index.css`. At the very top (before any existing content), add:

```css
@import 'leaflet/dist/leaflet.css';
```

**Step 3: Create `src/types/leaflet-heat.d.ts`**

```typescript
import * as L from 'leaflet';

declare module 'leaflet' {
  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: {
      minOpacity?: number;
      maxZoom?: number;
      max?: number;
      radius?: number;
      blur?: number;
      gradient?: Record<string, string>;
    }
  ): Layer;
}
```

**Step 4: Verify build still passes**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main"
npm run build
```

Expected: `✓ built in Xs` — zero TypeScript errors.

**Step 5: Commit**

```bash
git add src/index.css src/types/leaflet-heat.d.ts package.json package-lock.json
git commit -m "chore: install leaflet, react-leaflet, leaflet.heat, firebase-admin deps"
```

---

## Task 2: Save lat/lng on Complaint Creation + Update Seed Script

**Files:**
- Modify: `src/components/dashboards/CitizenDashboard.tsx`
- Modify: `scripts/seed-demo.ts`

**Context:** `CitizenDashboard.tsx` has a `fetchLocation()` function (around line 301) that captures `latitude`/`longitude` as local variables but only saves the text address to `location` state. The `handleSubmitReport` function (around line 382) builds `complaintData` and writes to Firestore. We need to also save `lat` and `lng`.

**Step 1: Add lat/lng state variables in CitizenDashboard**

Find the line (around line 298):
```typescript
const [location, setLocation] = useState('');
const [locationLoading, setLocationLoading] = useState(false);
```

Replace with:
```typescript
const [location, setLocation] = useState('');
const [locationLoading, setLocationLoading] = useState(false);
const [gpsLat, setGpsLat] = useState<number | null>(null);
const [gpsLng, setGpsLng] = useState<number | null>(null);
```

**Step 2: Save lat/lng in fetchLocation after coordinates are captured**

In `fetchLocation`, find where both Capacitor and browser paths converge — after `latitude` and `longitude` are assigned. Add `setGpsLat(latitude); setGpsLng(longitude);` right before the Nominatim reverse geocode call.

Find this exact block in `fetchLocation`:
```typescript
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
```

Add the two setters immediately before that `try {`:
```typescript
      setGpsLat(latitude);
      setGpsLng(longitude);

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
```

**Step 3: Include lat/lng in complaint Firestore write**

Find in `handleSubmitReport` the `complaintData` object:
```typescript
      const complaintData = {
        title: issueType,
        description: description.trim(),
        category: issueType,
        location: location,
        status: 'SUBMITTED',
        citizenId: user.id,
        imageUrl: imageUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
```

Replace with:
```typescript
      const complaintData = {
        title: issueType,
        description: description.trim(),
        category: issueType,
        location: location,
        status: 'SUBMITTED',
        citizenId: user.id,
        imageUrl: imageUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(gpsLat !== null && gpsLng !== null && { lat: gpsLat, lng: gpsLng }),
      };
```

**Step 4: Reset lat/lng on form clear**

Find the form reset block after `await addDoc(...)`:
```typescript
      setIssueType('');
      setDescription('');
      setLocation('');
      setPhotos([]);
```

Add the GPS reset:
```typescript
      setIssueType('');
      setDescription('');
      setLocation('');
      setPhotos([]);
      setGpsLat(null);
      setGpsLng(null);
```

**Step 5: Add lat/lng to seed-demo.ts demo complaints**

Open `scripts/seed-demo.ts`. After the `demoUsers` array (around line 60), find or add a demo complaints section. Add a seeding block at the end of the script (before or replacing the final `console.log`):

```typescript
// Demo complaints with lat/lng for heatmap demo
const demoComplaints = [
  { title: 'Garbage overflow', category: 'Waste Management', location: 'Andheri West, Mumbai', lat: 19.1136, lng: 72.8697, status: 'SUBMITTED' },
  { title: 'Broken streetlight', category: 'Street Lighting', location: 'Bandra East, Mumbai', lat: 19.0596, lng: 72.8295, status: 'ASSIGNED' },
  { title: 'Road pothole', category: 'Road Damage', location: 'Powai, Mumbai', lat: 19.1176, lng: 72.9060, status: 'RESOLVED' },
  { title: 'Drainage blocked', category: 'Drainage/Sewage', location: 'Connaught Place, Delhi', lat: 28.6315, lng: 77.2167, status: 'SUBMITTED' },
  { title: 'Open manhole', category: 'Drainage/Sewage', location: 'South Extension, Delhi', lat: 28.5706, lng: 77.2152, status: 'UNDER_REVIEW' },
  { title: 'Waste dumping', category: 'Waste Management', location: 'MG Road, Bangalore', lat: 12.9750, lng: 77.6081, status: 'ASSIGNED' },
  { title: 'Broken footpath', category: 'Public Property Damage', location: 'Whitefield, Bangalore', lat: 12.9698, lng: 77.7500, status: 'RESOLVED' },
  { title: 'Water pipe leak', category: 'Water Supply', location: 'T. Nagar, Chennai', lat: 13.0418, lng: 80.2341, status: 'SUBMITTED' },
  { title: 'Noise from factory', category: 'Noise Pollution', location: 'Park Street, Kolkata', lat: 22.5553, lng: 88.3512, status: 'RESOLVED' },
  { title: 'Garbage on road', category: 'Waste Management', location: 'Koregaon Park, Pune', lat: 18.5362, lng: 73.8942, status: 'SUBMITTED' },
];

// Seed complaints (optional - run only once)
console.log('Seeding demo complaints...');
for (const complaint of demoComplaints) {
  await db.collection('complaints').add({
    ...complaint,
    citizenId: 'REPLACE_WITH_CITIZEN_UID',
    description: `Demo complaint: ${complaint.title} reported at ${complaint.location}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
console.log('Done seeding complaints.');
```

**Step 6: Build check**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main"
npm run build
```

Expected: `✓ built in Xs` with zero errors.

**Step 7: Commit**

```bash
git add src/components/dashboards/CitizenDashboard.tsx scripts/seed-demo.ts
git commit -m "feat: save lat/lng on complaint creation for heatmap + route optimization"
```

---

## Task 3: AI Auto-Categorization — Vercel Function + CitizenDashboard UI

**Files:**
- Create: `api/categorize.ts`
- Modify: `src/components/dashboards/CitizenDashboard.tsx`

**Step 1: Create `api/categorize.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CategorizeBody {
  description: string;
  language: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
  error?: { message: string };
}

const CATEGORIES = [
  'Waste Management',
  'Road Damage',
  'Street Lighting',
  'Drainage/Sewage',
  'Public Property Damage',
  'Water Supply',
  'Noise Pollution',
  'Other',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { description, language } = req.body as CategorizeBody;
  if (!description || description.trim().length < 5) {
    return res.status(400).json({ error: 'Description too short' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const prompt = `You are a municipal complaint classifier for an Indian city management app.
Given the complaint description below (may be in ${language} language), respond with ONLY valid JSON and nothing else.
JSON format: { "category": "<category>", "confidence": <0.0-1.0>, "reason": "<5 words max>" }
Valid categories: ${CATEGORIES.join(', ')}
Complaint: "${description.trim()}"`;

  try {
    const gcpRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
      }),
    });

    const data = (await gcpRes.json()) as GeminiResponse;
    if (!gcpRes.ok || data.error) {
      console.error('[categorize] Gemini error:', data.error);
      return res.status(500).json({ error: data.error?.message ?? 'Gemini request failed' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    // Strip markdown code fences if present
    const clean = text.replace(/```json?|```/g, '').trim();
    const parsed = JSON.parse(clean) as { category: string; confidence: number; reason: string };

    // Validate category is one of the known ones
    if (!CATEGORIES.includes(parsed.category)) parsed.category = 'Other';
    parsed.confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5));

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[categorize] Error:', err);
    return res.status(500).json({ error: 'Categorization failed' });
  }
}
```

**Step 2: Add AI suggestion state to CitizenDashboard**

In `CitizenDashboard.tsx`, find the state declarations block (around line 95-106). After the `const { isListening, startStop: toggleMic, error: speechError }` line, add:

```typescript
  // AI category suggestion
  const aiDismissedForRef = React.useRef<string>('');
  const [aiSuggestion, setAiSuggestion] = useState<{ category: string; confidence: number } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
```

**Step 3: Add AI suggestion useEffect**

After the existing useEffects (around line 146), add:

```typescript
  // AI auto-categorization: debounce 1.5s after description reaches 20 chars
  React.useEffect(() => {
    if (description.length < 20 || description === aiDismissedForRef.current) {
      setAiSuggestion(null);
      return;
    }
    setAiSuggestion(null);
    const timer = setTimeout(async () => {
      setAiLoading(true);
      try {
        const res = await fetch('/api/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, language }),
        });
        if (res.ok) {
          const data = await res.json() as { category: string; confidence: number };
          setAiSuggestion(data);
        }
      } catch { /* fail silently — AI is non-blocking */ }
      setAiLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [description, language]);
```

**Step 4: Add AI suggestion chip UI in the complaint form JSX**

In the JSX, find the description textarea. It has a mic button overlay and likely looks like:
```tsx
<textarea
  ...
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  ...
/>
```

After the closing tag of the textarea's container div (the div that wraps the textarea + mic button), add:

```tsx
{/* AI category suggestion chip */}
{(aiLoading || aiSuggestion) && (
  <div className="flex items-center gap-2 mt-2 flex-wrap">
    {aiLoading && (
      <span className="flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-full px-3 py-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        AI analysing...
      </span>
    )}
    {aiSuggestion && !aiLoading && (
      <>
        <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-3 py-1 font-medium">
          ✨ Suggested: {aiSuggestion.category} · {Math.round(aiSuggestion.confidence * 100)}%
        </span>
        <button
          type="button"
          onClick={() => { setIssueType(aiSuggestion.category); setAiSuggestion(null); }}
          className="text-xs bg-purple-600 text-white rounded-full px-3 py-1 hover:bg-purple-700 transition-colors"
        >
          Use this
        </button>
        <button
          type="button"
          onClick={() => { aiDismissedForRef.current = description; setAiSuggestion(null); }}
          className="text-xs text-gray-500 hover:text-gray-700 rounded-full px-2 py-1"
        >
          ✕
        </button>
      </>
    )}
  </div>
)}
```

Note: `Loader2` is already imported in CitizenDashboard.

**Step 5: Build check**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main"
npm run build
```

Expected: `✓ built in Xs` zero errors.

**Step 6: Commit**

```bash
git add api/categorize.ts src/components/dashboards/CitizenDashboard.tsx
git commit -m "feat: add AI auto-categorization via Gemini 1.5 Flash with suggestion chip UI"
```

---

## Task 4: Enhanced ReportsTab — Trend Chart + Worker Leaderboard + Print

**Files:**
- Modify: `src/components/dashboards/tabs/ReportsTab.tsx`

**Context:** ReportsTab already has weekly bar chart, category breakdown, zone table, CSV export. We're adding: 6-month trend line chart (SVG), worker performance rankings (Firestore query), print button.

**Step 1: Add new imports to ReportsTab**

At the top of `ReportsTab.tsx`, add to the existing Firebase imports line:
```typescript
import { collection, query, onSnapshot, orderBy, getDocs, doc, getDoc, where } from 'firebase/firestore';
```
(replace the existing firebase/firestore import)

Add to lucide imports:
```typescript
import { ..., Printer, Trophy, Star } from 'lucide-react';
```
(add Printer, Trophy, Star to the existing lucide-react import)

**Step 2: Add MonthStat interface and WorkerPerf interface**

After the existing `CategoryStat` interface (around line 50), add:

```typescript
interface MonthStat {
  label: string;
  submitted: number;
  resolved: number;
}

interface WorkerPerf {
  workerId: string;
  name: string;
  tasksCompleted: number;
  avgRating: number;
}
```

**Step 3: Add LineChart SVG component**

After the existing `HBarChart` component (around line 109), add:

```typescript
const LineChart: React.FC<{ data: MonthStat[] }> = ({ data }) => {
  const W = 460, H = 120, padL = 8, padB = 22;
  const maxVal = Math.max(...data.map(d => d.submitted), 1);
  const xStep = (W - padL) / Math.max(data.length - 1, 1);
  const toY = (v: number) => H - (v / maxVal) * H;
  const toX = (i: number) => padL + i * xStep;

  const submittedPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.submitted).toFixed(1)}`).join(' ');
  const resolvedPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.resolved).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W + 10} ${H + padB + 18}`} className="w-full" style={{ maxHeight: 180 }}>
      {/* Legend */}
      <circle cx={padL} cy={-5} r={4} fill="#3b82f6" />
      <text x={padL + 8} y={-1} fontSize={9} fill="#6b7280">Submitted</text>
      <circle cx={padL + 75} cy={-5} r={4} fill="#10b981" />
      <text x={padL + 83} y={-1} fontSize={9} fill="#6b7280">Resolved</text>
      {/* Grid */}
      {[0, 0.5, 1].map((f, i) => (
        <line key={i} x1={padL} x2={W} y1={H * (1 - f)} y2={H * (1 - f)} stroke="#f3f4f6" strokeWidth="1" />
      ))}
      {/* Submitted line */}
      <path d={submittedPath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Resolved line */}
      <path d={resolvedPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(d.submitted)} r={3.5} fill="#3b82f6" />
          <circle cx={toX(i)} cy={toY(d.resolved)} r={3.5} fill="#10b981" />
          <text x={toX(i)} y={H + padB - 2} textAnchor="middle" fontSize={9} fill="#9ca3af">{d.label}</text>
        </g>
      ))}
    </svg>
  );
};
```

**Step 4: Add workerPerf state and monthlyData inside ReportsTab component**

Inside `ReportsTab` component, after the existing state declarations (around line 122), add:

```typescript
  const [workerPerf, setWorkerPerf] = useState<WorkerPerf[]>([]);
  const [workerPerfLoading, setWorkerPerfLoading] = useState(true);
```

Add worker performance useEffect after the existing complaints useEffect (around line 148):

```typescript
  // Fetch worker performance: assignments completed + user names + ratings
  useEffect(() => {
    let cancelled = false;
    async function fetchWorkerPerf() {
      try {
        const [assignSnap, ratingSnap] = await Promise.all([
          getDocs(query(collection(db, 'assignments'), where('workerStatus', '==', 'COMPLETED'))),
          getDocs(collection(db, 'ratings')),
        ]);
        if (cancelled) return;

        const countMap: Record<string, number> = {};
        assignSnap.forEach(d => {
          const wId = d.data().workerId as string;
          if (wId) countMap[wId] = (countMap[wId] || 0) + 1;
        });

        const ratingMap: Record<string, { sum: number; count: number }> = {};
        ratingSnap.forEach(d => {
          const { workerId, rating } = d.data();
          if (workerId && rating) {
            if (!ratingMap[workerId]) ratingMap[workerId] = { sum: 0, count: 0 };
            ratingMap[workerId].sum += Number(rating);
            ratingMap[workerId].count++;
          }
        });

        const workerIds = Object.keys(countMap);
        if (!workerIds.length) { setWorkerPerf([]); setWorkerPerfLoading(false); return; }

        const userDocs = await Promise.all(workerIds.map(id => getDoc(doc(db, 'users', id))));
        if (cancelled) return;

        const results: WorkerPerf[] = workerIds.map((wId, i) => {
          const rd = ratingMap[wId];
          return {
            workerId: wId,
            name: (userDocs[i].data()?.name as string) ?? 'Worker',
            tasksCompleted: countMap[wId],
            avgRating: rd ? rd.sum / rd.count : 0,
          };
        });
        results.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
        setWorkerPerf(results.slice(0, 10));
      } catch (err) {
        console.warn('[ReportsTab] Worker perf fetch failed:', err);
      } finally {
        if (!cancelled) setWorkerPerfLoading(false);
      }
    }
    fetchWorkerPerf();
    return () => { cancelled = true; };
  }, [complaints.length]); // re-fetch when complaint count changes as proxy for data refresh
```

**Step 5: Add monthlyData useMemo**

After `categoryMax` useMemo (around line 235), add:

```typescript
  // 6-month trend data
  const monthlyData: MonthStat[] = useMemo(() => {
    const months: MonthStat[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push({ label: d.toLocaleString('default', { month: 'short' }), submitted: 0, resolved: 0 });
    }
    complaints.forEach(c => {
      const ts = c.createdAt;
      if (!ts) return;
      try {
        const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(ts).getTime();
        const date = new Date(ms);
        const monthsAgo = (new Date().getFullYear() - date.getFullYear()) * 12 + new Date().getMonth() - date.getMonth();
        if (monthsAgo >= 0 && monthsAgo <= 5) {
          months[5 - monthsAgo].submitted++;
          if (c.status === 'RESOLVED') months[5 - monthsAgo].resolved++;
        }
      } catch { /* skip */ }
    });
    return months;
  }, [complaints]);
```

**Step 6: Add print handler**

After `handleExportCSV` function, add:

```typescript
  const handlePrint = () => {
    window.print();
  };
```

**Step 7: Add print button to header in JSX**

In the JSX header section, find the existing Export CSV button. After it, add:

```tsx
<button
  onClick={handlePrint}
  className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700 bg-white shadow-sm transition-colors"
>
  <Printer className="w-4 h-4" />
  <span className="text-sm">Print</span>
</button>
```

**Step 8: Add 6-month trend chart section in JSX**

After the "Charts Row" div (the grid with weekly volume + category breakdown), add a new section:

```tsx
{/* 6-Month Trend */}
<div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
  <div className="flex items-center gap-2 mb-5">
    <TrendingUp className="w-5 h-5 text-purple-500" />
    <h3 className="text-lg font-bold text-gray-900">6-Month Complaint Trend</h3>
  </div>
  {loading ? (
    <div className="flex items-center justify-center h-44"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
  ) : (
    <LineChart data={monthlyData} />
  )}
</div>
```

**Step 9: Add worker performance rankings section in JSX**

After the 6-month trend section, add:

```tsx
{/* Worker Performance Rankings */}
<div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
  <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
    <div className="flex items-center gap-2">
      <Trophy className="w-5 h-5 text-amber-500" />
      <h3 className="text-lg font-bold text-gray-900">Worker Performance Rankings</h3>
    </div>
    {workerPerfLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
  </div>
  {!workerPerfLoading && workerPerf.length === 0 ? (
    <div className="p-10 text-center text-gray-400">
      <Trophy className="w-10 h-10 mx-auto mb-2 text-gray-200" />
      <p className="text-sm">No completed tasks yet</p>
    </div>
  ) : (
    <div className="divide-y divide-gray-100">
      {workerPerf.map((w, i) => (
        <div key={w.workerId} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
            i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-500'
          }`}>{i + 1}</span>
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-sm flex-shrink-0">
            {w.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{w.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-3 h-3 ${s <= Math.round(w.avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
              ))}
              {w.avgRating > 0 && <span className="text-xs text-gray-400 ml-1">{w.avgRating.toFixed(1)}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-gray-900">{w.tasksCompleted}</p>
            <p className="text-xs text-gray-400">tasks</p>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

**Step 10: Add `@media print` CSS to `src/index.css`**

At the end of `src/index.css`, add:

```css
@media print {
  nav, aside, header, .no-print { display: none !important; }
  body { background: white !important; }
  .print-area { box-shadow: none !important; border: none !important; }
}
```

**Step 11: Build check**

```bash
npm run build
```

Expected: `✓ built in Xs` zero errors.

**Step 12: Commit**

```bash
git add src/components/dashboards/tabs/ReportsTab.tsx src/index.css
git commit -m "feat: enhance ReportsTab with 6-month trend chart, worker leaderboard, print button"
```

---

## Task 5: Add Reports Tab to AdminDashboard

**Files:**
- Modify: `src/components/dashboards/AdminDashboard.tsx`

**Context:** AdminDashboard currently has tabs: overview, complaints, workers, verification, training, salary, settings, profile. ReportsTab is only in SuperadminDashboard. We add it to Admin too.

**Step 1: Add ReportsTab import**

In `AdminDashboard.tsx`, after the existing imports, add:
```typescript
import ReportsTab from './tabs/ReportsTab';
```

Also add `FileText` to the lucide-react import:
```typescript
import { ..., FileText } from 'lucide-react';
```

**Step 2: Add Reports sidebar item**

In the `sidebarItems` array, add after the salary item (before settings):
```typescript
{ icon: <FileText className="w-5 h-5" />, label: 'Reports', active: activeTab === 'reports', onClick: () => setActiveTab('reports') },
```

**Step 3: Add Reports case to renderContent**

In `renderContent` switch, add before the `default` case:
```typescript
case 'reports': return <ReportsTab />;
```

**Step 4: Build check + commit**

```bash
npm run build
git add src/components/dashboards/AdminDashboard.tsx
git commit -m "feat: add Reports tab to AdminDashboard"
```

---

## Task 6: Create HeatmapTab Component

**Files:**
- Create: `src/components/dashboards/HeatmapTab.tsx`

**Step 1: Create `src/components/dashboards/HeatmapTab.tsx`**

```typescript
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Map, Loader2, Filter } from 'lucide-react';

// Fix Leaflet default marker icon URLs broken by Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number;
}

// Inner component that uses useMap() hook
const HeatmapLayer: React.FC<{ points: HeatPoint[] }> = ({ points }) => {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (layerRef.current) map.removeLayer(layerRef.current);
    if (!points.length) return;

    const heatData: [number, number, number][] = points.map(p => [p.lat, p.lng, p.intensity]);
    const heat = (L as unknown as { heatLayer: (pts: [number, number, number][], opts: object) => L.Layer })
      .heatLayer(heatData, { radius: 30, blur: 20, maxZoom: 17, max: 1.0 });
    heat.addTo(map);
    layerRef.current = heat;

    // Auto-fit bounds to data
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }

    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [map, points]);

  return null;
};

// Status intensity weights
const INTENSITY: Record<string, number> = {
  SUBMITTED: 0.5,
  UNDER_REVIEW: 0.65,
  ASSIGNED: 0.8,
  RESOLVED: 0.2,
};

const PERIODS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'All time', days: 0 },
];

const CATEGORIES = ['All', 'Waste Management', 'Road Damage', 'Street Lighting', 'Drainage/Sewage', 'Public Property Damage', 'Water Supply', 'Noise Pollution', 'Other'];

interface RawComplaint {
  id: string;
  lat?: number;
  lng?: number;
  status?: string;
  category?: string;
  createdAt?: unknown;
}

const HeatmapTab: React.FC = () => {
  const [complaints, setComplaints] = useState<RawComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodIdx, setPeriodIdx] = useState(1);
  const [category, setCategory] = useState('All');

  useEffect(() => {
    const q = query(collection(db, 'complaints'));
    const unsub = onSnapshot(q, snap => {
      const docs: RawComplaint[] = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() } as RawComplaint));
      setComplaints(docs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const heatPoints = useMemo((): HeatPoint[] => {
    const period = PERIODS[periodIdx];
    const cutoff = period.days > 0 ? Date.now() - period.days * 86400_000 : 0;

    return complaints
      .filter(c => {
        if (c.lat == null || c.lng == null) return false;
        if (category !== 'All' && c.category !== category) return false;
        if (cutoff > 0 && c.createdAt) {
          try {
            const ts = c.createdAt as { toMillis?: () => number };
            const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(c.createdAt as string).getTime();
            if (ms < cutoff) return false;
          } catch { return false; }
        }
        return true;
      })
      .map(c => ({
        lat: c.lat!,
        lng: c.lng!,
        intensity: INTENSITY[c.status ?? 'SUBMITTED'] ?? 0.5,
      }));
  }, [complaints, periodIdx, category]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Map className="w-7 h-7 text-emerald-500" />
            Complaint Heatmap
          </h2>
          <p className="text-gray-500 text-sm">Visualise complaint density across the city</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={periodIdx}
            onChange={e => setPeriodIdx(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {PERIODS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
          </select>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-4 text-xs flex-wrap">
        {[
          { color: 'bg-blue-500', label: `${heatPoints.length} mapped complaints` },
          { color: 'bg-gray-300', label: `${complaints.length - heatPoints.length} without GPS (not shown)` },
        ].map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1">
            <span className={`w-2 h-2 rounded-full ${item.color}`} />
            {item.label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96 bg-white rounded-2xl border border-gray-200">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
        </div>
      ) : heatPoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 bg-white rounded-2xl border border-gray-200 text-gray-400">
          <Map className="w-16 h-16 mb-3 text-gray-200" />
          <p className="font-semibold">No location data available</p>
          <p className="text-sm mt-1">Submit complaints with GPS enabled to see the heatmap</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 520 }}>
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <HeatmapLayer points={heatPoints} />
          </MapContainer>
        </div>
      )}

      {/* Heat legend */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">Heat Intensity Guide</p>
        <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
          {Object.entries(INTENSITY).map(([status, val]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(${120 - val * 120}, 80%, 50%)` }} />
              {status} ({Math.round(val * 100)}%)
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeatmapTab;
```

**Step 2: Build check**

```bash
npm run build
```

Expected: `✓ built in Xs` — zero TypeScript errors.

**Step 3: Commit**

```bash
git add src/components/dashboards/HeatmapTab.tsx
git commit -m "feat: add HeatmapTab component with Leaflet + leaflet.heat and period/category filters"
```

---

## Task 7: Wire HeatmapTab into SuperadminDashboard and AdminDashboard

**Files:**
- Modify: `src/components/dashboards/SuperadminDashboard.tsx`
- Modify: `src/components/dashboards/AdminDashboard.tsx`

**Step 1: Update SuperadminDashboard**

Add import at the top (after existing dashboard imports):
```typescript
import HeatmapTab from './HeatmapTab';
```

Add `Map` to lucide imports:
```typescript
import { ..., Map } from 'lucide-react';
```

In `sidebarItems`, add after the reports item (before inventory):
```typescript
{ icon: <Map className="w-5 h-5" />, label: 'Heatmap', active: activeTab === 'heatmap', onClick: () => setActiveTab('heatmap') },
```

In `renderContent` switch, add before `default`:
```typescript
case 'heatmap': return <HeatmapTab />;
```

**Step 2: Update AdminDashboard**

Add import after the ReportsTab import added in Task 5:
```typescript
import HeatmapTab from './HeatmapTab';
```

Add `Map` to lucide imports.

In `sidebarItems`, add after the Reports item (before settings):
```typescript
{ icon: <Map className="w-5 h-5" />, label: 'Heatmap', active: activeTab === 'heatmap', onClick: () => setActiveTab('heatmap') },
```

In `renderContent` switch, add before `default`:
```typescript
case 'heatmap': return <HeatmapTab />;
```

**Step 3: Build check + commit**

```bash
npm run build
git add src/components/dashboards/SuperadminDashboard.tsx src/components/dashboards/AdminDashboard.tsx
git commit -m "feat: wire HeatmapTab into SuperadminDashboard and AdminDashboard"
```

---

## Task 8: Create WorkerRouteTab Component

**Files:**
- Modify: `src/components/dashboards/WorkerDashboard.tsx` (add lat/lng to EnrichedTask)
- Create: `src/components/dashboards/WorkerRouteTab.tsx`

**Step 1: Update EnrichedTask in WorkerDashboard.tsx**

Find the `EnrichedTask` interface (around line 28):
```typescript
interface EnrichedTask {
  assignmentId: string;
  complaintId: string;
  workerStatus: string;
  assignedAt: any;
  completedAt?: any;
  // Complaint data
  title: string;
  category: string;
  location: string;
  complaintStatus: string;
}
```

Replace with:
```typescript
interface EnrichedTask {
  assignmentId: string;
  complaintId: string;
  workerStatus: string;
  assignedAt: any;
  completedAt?: any;
  // Complaint data
  title: string;
  category: string;
  location: string;
  complaintStatus: string;
  lat?: number;
  lng?: number;
}
```

**Step 2: Also read lat/lng when building EnrichedTask**

Find the block (around line 82) where `fetchedTasks.push({...})` is called:
```typescript
            fetchedTasks.push({
              assignmentId: docSnap.id,
              complaintId: assignmentData.complaintId,
              workerStatus: assignmentData.workerStatus,
              assignedAt: assignmentData.assignedAt,
              completedAt: assignmentData.completedAt,
              title: complaintData.title || complaintData.category,
              category: complaintData.category,
              location: complaintData.location,
              complaintStatus: complaintData.status
            });
```

Replace with:
```typescript
            fetchedTasks.push({
              assignmentId: docSnap.id,
              complaintId: assignmentData.complaintId,
              workerStatus: assignmentData.workerStatus,
              assignedAt: assignmentData.assignedAt,
              completedAt: assignmentData.completedAt,
              title: complaintData.title || complaintData.category,
              category: complaintData.category,
              location: complaintData.location,
              complaintStatus: complaintData.status,
              lat: complaintData.lat as number | undefined,
              lng: complaintData.lng as number | undefined,
            });
```

**Step 3: Add Route tab to WorkerDashboard sidebar and renderContent**

In `sidebarItems`, after the `my_tasks` item, add:
```typescript
{ icon: <MapPin className="w-5 h-5" />, label: 'Route', active: activeTab === 'route', onClick: () => setActiveTab('route') },
```

(MapPin is already imported in WorkerDashboard)

In `renderContent` switch, before `case 'proof':`, add:
```typescript
      case 'route': return <WorkerRouteTab tasks={tasks} />;
```

Add the import at the top:
```typescript
import WorkerRouteTab from './WorkerRouteTab';
```

**Step 4: Create `src/components/dashboards/WorkerRouteTab.tsx`**

```typescript
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Loader2, AlertTriangle } from 'lucide-react';

// Leaflet icon fix (same as HeatmapTab)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Task {
  assignmentId: string;
  title: string;
  category: string;
  location: string;
  workerStatus: string;
  lat?: number;
  lng?: number;
}

interface WorkerRouteTabProps {
  tasks: Task[];
}

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Creates a numbered divIcon for tasks
function createNumberedIcon(num: number, color: string) {
  return L.divIcon({
    html: `<div style="background:${color};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${num}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Fit map to route bounds
const FitBounds: React.FC<{ positions: [number, number][] }> = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 14 });
    } else if (positions.length === 1) {
      map.setView(positions[0], 14);
    }
  }, [map, positions]);
  return null;
};

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  COMPLETED: '#10b981',
};

const WorkerRouteTab: React.FC<WorkerRouteTabProps> = ({ tasks }) => {
  const [workerPos, setWorkerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [locError, setLocError] = useState<string | null>(null);

  // Get worker's current GPS position
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError('Geolocation not supported in this browser.');
      setLocLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setWorkerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
      },
      () => {
        setLocError('Location access denied. Showing tasks without distance sorting.');
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Tasks with lat/lng, sorted by distance from worker
  const mappableTasks = useMemo(() => {
    const withCoords = tasks.filter(t => t.lat != null && t.lng != null && t.workerStatus !== 'COMPLETED');
    if (!workerPos) return withCoords;
    return [...withCoords].sort((a, b) =>
      haversineKm(workerPos.lat, workerPos.lng, a.lat!, a.lng!) -
      haversineKm(workerPos.lat, workerPos.lng, b.lat!, b.lng!)
    );
  }, [tasks, workerPos]);

  // Polyline: worker → task1 → task2 → ...
  const routePositions = useMemo((): [number, number][] => {
    const pts: [number, number][] = [];
    if (workerPos) pts.push([workerPos.lat, workerPos.lng]);
    mappableTasks.forEach(t => pts.push([t.lat!, t.lng!]));
    return pts;
  }, [workerPos, mappableTasks]);

  const tasksWithoutCoords = tasks.filter(t => (t.lat == null || t.lng == null) && t.workerStatus !== 'COMPLETED');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Navigation className="w-7 h-7 text-emerald-500" />
          Optimized Route
        </h2>
        <p className="text-gray-500 text-sm">Tasks sorted by distance — nearest first</p>
      </div>

      {locError && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {locError}
        </div>
      )}

      {locLoading ? (
        <div className="flex items-center justify-center h-96 bg-white rounded-2xl border border-gray-200">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Getting your location...</p>
          </div>
        </div>
      ) : mappableTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-gray-200 text-gray-400">
          <MapPin className="w-14 h-14 mb-3 text-gray-200" />
          <p className="font-semibold">No mapped tasks available</p>
          <p className="text-sm mt-1">Tasks need GPS coordinates to appear on the route map</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 480 }}>
          <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds positions={routePositions} />

            {/* Worker position */}
            {workerPos && (
              <CircleMarker
                center={[workerPos.lat, workerPos.lng]}
                radius={10}
                pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.9 }}
              >
                <Popup>📍 Your Location</Popup>
              </CircleMarker>
            )}

            {/* Task markers */}
            {mappableTasks.map((task, i) => (
              <Marker
                key={task.assignmentId}
                position={[task.lat!, task.lng!]}
                icon={createNumberedIcon(i + 1, STATUS_COLORS[task.workerStatus] ?? '#6b7280')}
              >
                <Popup>
                  <strong>{i + 1}. {task.title}</strong><br />
                  <span className="text-xs text-gray-500">{task.location}</span><br />
                  {workerPos && (
                    <span className="text-xs font-medium text-blue-600">
                      📍 {haversineKm(workerPos.lat, workerPos.lng, task.lat!, task.lng!).toFixed(1)} km away
                    </span>
                  )}
                </Popup>
              </Marker>
            ))}

            {/* Route polyline */}
            {routePositions.length > 1 && (
              <Polyline
                positions={routePositions}
                pathOptions={{ color: '#10b981', weight: 3, dashArray: '8, 8', opacity: 0.7 }}
              />
            )}
          </MapContainer>
        </div>
      )}

      {/* Ordered task list */}
      {mappableTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-gray-900">Route Order</h3>
          {mappableTasks.map((task, i) => (
            <div key={task.assignmentId} className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: STATUS_COLORS[task.workerStatus] ?? '#6b7280' }}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{task.title}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{task.location}</span>
                </p>
              </div>
              {workerPos && task.lat && task.lng && (
                <span className="text-xs font-semibold text-blue-600 flex-shrink-0">
                  {haversineKm(workerPos.lat, workerPos.lng, task.lat, task.lng).toFixed(1)} km
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tasks without coords warning */}
      {tasksWithoutCoords.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <strong>{tasksWithoutCoords.length} task(s)</strong> are not shown on the map because they don't have GPS coordinates.
          These will appear once citizens submit complaints with location enabled.
        </div>
      )}
    </div>
  );
};

export default WorkerRouteTab;
```

**Step 5: Build check**

```bash
npm run build
```

Expected: `✓ built in Xs` zero errors.

**Step 6: Commit**

```bash
git add src/components/dashboards/WorkerDashboard.tsx src/components/dashboards/WorkerRouteTab.tsx
git commit -m "feat: add WorkerRouteTab with Leaflet map, Haversine proximity sort, and route polyline"
```

---

## Task 9: FCM Setup — Service Worker + fcm.ts + Firebase config update

**Files:**
- Create: `public/firebase-messaging-sw.js`
- Create: `src/lib/fcm.ts`
- Modify: `src/lib/firebase.ts`

**Step 1: Create `public/firebase-messaging-sw.js`**

```javascript
// Firebase Messaging Service Worker
// Handles background push notifications when app is not in focus
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBQJyhPX6KKabrtyZIIFApJnbuvaGx9xv0",
  authDomain: "safaiconnect.firebaseapp.com",
  projectId: "safaiconnect",
  storageBucket: "safaiconnect.firebasestorage.app",
  messagingSenderId: "646493037655",
  appId: "1:646493037655:web:8bd824355c6b2ea2082f12",
});

const messaging = firebase.messaging();

// Handle background messages (app not in foreground)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Safai Connect';
  const body = payload.notification?.body ?? '';
  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: payload.data ?? {},
  });
});
```

**Step 2: Add Firebase Messaging export to `src/lib/firebase.ts`**

Read the existing `src/lib/firebase.ts`. At the bottom, add:

```typescript
import { getMessaging } from 'firebase/messaging';

// Firebase Messaging (FCM) — only initialise in browser context
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
```

**Step 3: Create `src/lib/fcm.ts`**

```typescript
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { messaging, db } from './firebase';

/**
 * Request browser notification permission, get FCM token, save to Firestore.
 * Call once per login session.
 */
export async function requestAndSaveFCMToken(userId: string): Promise<string | null> {
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('[FCM] Notification permission denied.');
      return null;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
    if (!vapidKey) {
      console.warn('[FCM] VITE_FIREBASE_VAPID_KEY not set — skipping FCM token request.');
      return null;
    }

    const token = await getToken(messaging, { vapidKey });
    if (token) {
      await updateDoc(doc(db, 'users', userId), { fcmToken: token });
      console.info('[FCM] Token saved for user', userId);
    }
    return token ?? null;
  } catch (err) {
    console.warn('[FCM] Token request failed:', err);
    return null;
  }
}

/**
 * Listen for foreground push messages (app is open).
 * Returns an unsubscribe function.
 */
export function setupForegroundMessageListener(
  onNotification: (title: string, body: string) => void
): () => void {
  if (!messaging) return () => {};
  try {
    return onMessage(messaging, payload => {
      const title = payload.notification?.title ?? 'Safai Connect';
      const body = payload.notification?.body ?? '';
      onNotification(title, body);
    });
  } catch (err) {
    console.warn('[FCM] Foreground listener failed:', err);
    return () => {};
  }
}

/**
 * Send a push notification via our /api/notify serverless proxy.
 * tokens: FCM token strings to send to.
 */
export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const validTokens = tokens.filter(Boolean);
  if (!validTokens.length) return;
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: validTokens, title, body, data: data ?? {} }),
    });
  } catch (err) {
    console.warn('[FCM] sendPushNotification failed:', err);
  }
}
```

**Step 4: Build check**

```bash
npm run build
```

Expected: `✓ built in Xs` zero errors.

**Step 5: Commit**

```bash
git add public/firebase-messaging-sw.js src/lib/fcm.ts src/lib/firebase.ts
git commit -m "feat: add FCM service worker, fcm.ts helper, and Firebase Messaging export"
```

---

## Task 10: Create `api/notify.ts` Vercel Serverless Function

**Files:**
- Create: `api/notify.ts`

**Step 1: Create `api/notify.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface NotifyBody {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tokens, title, body, data } = req.body as NotifyBody;
  if (!tokens?.length || !title || !body) {
    return res.status(400).json({ error: 'Missing tokens, title, or body' });
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    return res.status(500).json({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON not configured' });
  }

  try {
    // Lazy dynamic import of firebase-admin to prevent Vite bundling it
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    if (!getApps().length) {
      initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
    }

    const messaging = getMessaging();

    // Send in batches of 500 (FCM multicast limit)
    let totalSuccess = 0, totalFailure = 0;
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: data ?? {},
        webpush: {
          notification: {
            title,
            body,
            icon: '/pwa-192x192.png',
          },
        },
      });
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
    }

    return res.status(200).json({ successCount: totalSuccess, failureCount: totalFailure });
  } catch (err) {
    console.error('[notify] Error:', err);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
```

**Step 2: Build check**

```bash
npm run build
```

Expected: `✓ built in Xs` zero errors.

**Step 3: Commit**

```bash
git add api/notify.ts
git commit -m "feat: add api/notify.ts Vercel function for FCM multicast push notifications"
```

---

## Task 11: Wire FCM Token Request into AuthContext

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

**Context:** AuthContext's `useEffect` listens to `onAuthStateChanged`. When a user logs in (`if (user)`), we call `requestAndSaveFCMToken` once.

**Step 1: Add import to AuthContext**

After the existing imports in `AuthContext.tsx`, add:
```typescript
import { requestAndSaveFCMToken } from '../lib/fcm';
```

**Step 2: Call requestAndSaveFCMToken after user authenticated**

In the `onAuthStateChanged` callback, inside `if (user) {`, after the line `setLoading(true);`, add:

```typescript
            // Request FCM token once per session (silently — never blocks auth flow)
            requestAndSaveFCMToken(user.uid).catch(console.warn);
```

**Step 3: Build check + commit**

```bash
npm run build
git add src/contexts/AuthContext.tsx
git commit -m "feat: request and save FCM token in AuthContext on user login"
```

---

## Task 12: Send FCM Push on Complaint Assigned and Resolved

**Files:**
- Modify: `src/components/dashboards/admin/ComplaintsTab.tsx`
- Modify: `src/components/dashboards/admin/VerificationTab.tsx`

**Context:** ComplaintsTab already fires an in-app notification when a worker is assigned (via `addNotification`). VerificationTab fires an in-app notification when resolved. We ADD FCM push to both, fetching the target user's `fcmToken` from Firestore.

**Step 1: Update ComplaintsTab to also send FCM push on assignment**

In `ComplaintsTab.tsx`, add import:
```typescript
import { sendPushNotification } from '../../../lib/fcm';
import { getDoc, doc } from 'firebase/firestore';
```
(add `getDoc` and `doc` to existing firebase/firestore import if not already there)

In `handleAssignWorkers`, after the existing `addNotification` loop (around line 230), add:

```typescript
            // Also send FCM push to each assigned worker
            for (const wId of selectedWorkerIds) {
              try {
                const userSnap = await getDoc(doc(db, 'users', wId));
                const fcmToken = userSnap.data()?.fcmToken as string | undefined;
                if (fcmToken) {
                  await sendPushNotification(
                    [fcmToken],
                    '🗂️ New Task Assigned',
                    `You have been assigned: ${assignedComplaint?.title ?? 'a new complaint'}`,
                    { complaintId: selectedComplaintId ?? '' }
                  );
                }
              } catch { /* FCM push is non-critical */ }
            }
```

**Step 2: Update VerificationTab to send FCM push on resolution**

In `VerificationTab.tsx`, add:
```typescript
import { sendPushNotification } from '../../../lib/fcm';
```

In `VerificationTab.tsx`, find the `handleApprove` (or equivalent resolution) function where `addNotification` is called after RESOLVED. After the existing `addNotification` call for the citizen, add:

```typescript
              // FCM push to citizen
              try {
                const citizenSnap = await getDoc(doc(db, 'users', entry.citizenId));
                const fcmToken = citizenSnap.data()?.fcmToken as string | undefined;
                if (fcmToken) {
                  await sendPushNotification(
                    [fcmToken],
                    '✅ Complaint Resolved',
                    `Your complaint "${entry.complaintTitle}" has been resolved! +10 reward points`,
                    { complaintId: entry.complaintId }
                  );
                }
              } catch { /* FCM push is non-critical */ }
```

Note: If `getDoc`/`doc` are not already imported in VerificationTab, add them to the firestore import line.

**Step 3: Build check + commit**

```bash
npm run build
git add src/components/dashboards/admin/ComplaintsTab.tsx src/components/dashboards/admin/VerificationTab.tsx
git commit -m "feat: send FCM push notifications on complaint assignment and resolution"
```

---

## Task 13: BroadcastPanel — Admin City-Wide Broadcasts

**Files:**
- Create: `src/components/admin/BroadcastPanel.tsx`
- Modify: `src/components/dashboards/AdminDashboard.tsx`

**Step 1: Create directory and file `src/components/admin/BroadcastPanel.tsx`**

```typescript
import React, { useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { sendPushNotification } from '../../lib/fcm';
import { Megaphone, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

type Audience = 'Citizens' | 'Workers' | 'All';

const BroadcastPanel: React.FC = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('All');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: number; fail: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Please enter both title and message.');
      return;
    }
    setSending(true);
    setResult(null);
    setError(null);

    try {
      // Fetch FCM tokens for the selected audience
      let q;
      if (audience === 'Citizens') {
        q = query(collection(db, 'users'), where('role', 'in', ['Citizen', 'citizen', 'Green-Champion', 'green-champion']));
      } else if (audience === 'Workers') {
        q = query(collection(db, 'users'), where('role', 'in', ['Worker', 'worker']));
      } else {
        q = query(collection(db, 'users'));
      }

      const snap = await getDocs(q);
      const tokens: string[] = [];
      snap.forEach(d => {
        const token = d.data().fcmToken as string | undefined;
        if (token) tokens.push(token);
      });

      if (!tokens.length) {
        setError(`No registered devices found for audience: ${audience}. Users must log in with notification permission granted.`);
        setSending(false);
        return;
      }

      await sendPushNotification(tokens, title.trim(), body.trim(), { broadcast: 'true', audience });
      setResult({ success: tokens.length, fail: 0 });
      setTitle('');
      setBody('');
    } catch (err) {
      console.error('[BroadcastPanel] Error:', err);
      setError('Failed to send broadcast. Check your FIREBASE_SERVICE_ACCOUNT_JSON Vercel env var.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-bold text-gray-900">City-Wide Broadcast</h3>
      </div>
      <p className="text-sm text-gray-500">Send a push notification to all registered devices instantly.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
          <div className="flex gap-2 flex-wrap">
            {(['All', 'Citizens', 'Workers'] as Audience[]).map(a => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  audience === a
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notification Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
            placeholder="e.g. City Cleanup Drive Tomorrow"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="e.g. Join us Saturday 9am at City Park for the annual cleanliness drive."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {result && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Broadcast sent to <strong>{result.success} device(s)</strong> successfully!
          </div>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !title.trim() || !body.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
          {sending ? 'Sending...' : `Send to ${audience}`}
        </button>
      </div>
    </div>
  );
};

export default BroadcastPanel;
```

**Step 2: Add BroadcastPanel to AdminDashboard**

In `AdminDashboard.tsx`:

Add import:
```typescript
import BroadcastPanel from '../admin/BroadcastPanel';
```

Add `Megaphone` to lucide imports.

In `sidebarItems`, add after the Heatmap item (before settings):
```typescript
{ icon: <Megaphone className="w-5 h-5" />, label: 'Broadcast', active: activeTab === 'broadcast', onClick: () => setActiveTab('broadcast') },
```

In `renderContent` switch, add before `default`:
```typescript
case 'broadcast': return <BroadcastPanel />;
```

**Step 3: Final build check**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main"
npm run build
```

Expected: `✓ built in Xs` — zero TypeScript errors.

**Step 4: Final commit**

```bash
git add src/components/admin/BroadcastPanel.tsx src/components/dashboards/AdminDashboard.tsx
git commit -m "feat: add BroadcastPanel for admin city-wide FCM push notifications"
```

---

## Manual Steps After Implementation (User Must Do)

### Env vars to add in Vercel dashboard + local `.env`:
```
GEMINI_API_KEY=your_gemini_key          # Google AI Studio → Get API key (free)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  # Firebase Console → Project Settings → Service Accounts → Generate
VITE_FIREBASE_VAPID_KEY=your_vapid_key  # Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate
```

### Firebase Console steps:
1. **Gemini API key:** console.cloud.google.com → APIs & Services → Enable "Generative Language API" → Create API key → restrict to Generative Language API
2. **VAPID key:** Firebase Console → Project Settings → Cloud Messaging → Web configuration → Web Push certificates → Generate key pair
3. **Service account JSON:** Firebase Console → Project Settings → Service Accounts → Node.js → Generate new private key → download JSON → copy entire JSON and stringify it for `FIREBASE_SERVICE_ACCOUNT_JSON`

### Deploy:
```bash
vercel --prod
```

---

## Summary of All New Files

| File | Purpose |
|------|---------|
| `src/types/leaflet-heat.d.ts` | TypeScript types for leaflet.heat |
| `api/categorize.ts` | Gemini AI complaint category suggestion |
| `api/notify.ts` | FCM multicast push via Firebase Admin |
| `src/lib/fcm.ts` | Token management + push helper |
| `public/firebase-messaging-sw.js` | FCM background message service worker |
| `src/components/dashboards/HeatmapTab.tsx` | Leaflet heatmap of complaints |
| `src/components/dashboards/WorkerRouteTab.tsx` | Leaflet route map + Haversine sort |
| `src/components/admin/BroadcastPanel.tsx` | Admin city-wide broadcast UI |
