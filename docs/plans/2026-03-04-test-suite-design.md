# Test Suite Design — Safai Connect
**Date:** 2026-03-04
**Author:** Claude (via brainstorming skill)
**Approach:** Playwright E2E (Option A) + Structured Manual Test Plan (Option C)

---

## 1. Why Playwright

The project is Firebase-Auth + Firestore heavy with role-based routing. Previous bugs (wrong redirects, champion not logging in, Vercel build failures) were all integration/E2E issues that unit tests with mocks would miss. Playwright runs in a real Chromium browser against the live Firebase project — it tests exactly what a real user experiences.

---

## 2. Architecture

```
safai-main/
├── playwright.config.ts          ← Playwright config (baseURL, browser, timeouts)
├── tests/
│   ├── fixtures/
│   │   └── auth.ts               ← Shared credentials + loginAs() helper
│   ├── e2e/
│   │   ├── auth.spec.ts          ← Login + routing for all 5 roles, logout
│   │   ├── citizen.spec.ts       ← Complaint submit, photo AI, collection booking
│   │   ├── worker.spec.ts        ← Tasks tab, attendance check-in, digital ID
│   │   ├── admin.spec.ts         ← Overview, complaints mgmt, workers, verification
│   │   ├── superadmin.spec.ts    ← System overview, admin mgmt, inventory
│   │   ├── champion.spec.ts      ← Green banner, leaderboard rank, citizen features
│   │   └── ai.spec.ts            ← /api/analyze-photo endpoint (OpenAI GPT-4o Vision)
│   └── manual/
│       └── test-plan.md          ← Option C: step-by-step QA checklist
└── docs/plans/
    └── 2026-03-04-test-suite-design.md   ← This file
```

---

## 3. Spec Coverage

| Spec | Test Scenarios |
|------|---------------|
| **auth** | Login × 5 roles → correct dashboard; wrong password error; logout via confirm modal |
| **citizen** | Home stats render; submit complaint; navigate Report→Track; collection booking |
| **worker** | Tasks tab stat cards; attendance check-in UI; digital ID tab |
| **admin** | Dashboard Overview heading; Complaints tab; Workers tab; Verification tab |
| **superadmin** | System Overview heading; Admin Management tab; Inventory tab |
| **champion** | Green Champion banner; Active Champion badge; CitizenDashboard features visible |
| **ai** | POST /api/analyze-photo → `{category,severity,description,confidence}` (OpenAI GPT-4o Vision, gated on `OPENAI_API_KEY`) |

---

## 4. Configuration Decisions

- **Browser:** Chromium only (fastest, covers Chrome + Edge, no extra install)
- **Workers:** 1 sequential (Firebase auth rate-limiting prevention)
- **Base URL:** `http://localhost:5173` (Vite dev server; auto-started by Playwright)
- **Timeout:** 15s per action, 30s per test
- **Screenshots:** on failure only
- **AI tests:** gated behind `OPENAI_API_KEY` env var — skipped gracefully if missing
- **Retries:** 0 locally, 1 on CI

---

## 5. Demo Credentials

All seeded by `npx tsx scripts/seed-demo.ts` with password `Demo1234!`:

| Role | Email |
|------|-------|
| Superadmin | superadmin@demo.com |
| Admin | admin@demo.com |
| Worker | worker@demo.com |
| Citizen | citizen@demo.com |
| Green Champion | champion@demo.com |

---

## 6. Running the Suite

```bash
# Install (first time)
npm install --save-dev @playwright/test
npx playwright install chromium

# Run all E2E tests
npx playwright test

# Run specific spec
npx playwright test tests/e2e/auth.spec.ts

# Run with visible browser (headed mode)
npx playwright test --headed

# View HTML report after run
npx playwright show-report

# Run AI endpoint tests (requires OpenAI API key)
OPENAI_API_KEY=... npx playwright test tests/e2e/ai.spec.ts
```

---

## 7. Known Constraints

- Tests require live Firebase — they create/read real Firestore data
- Complaint submission tests write real data to the `complaints` collection
- Auth tests use real Firebase Authentication with demo accounts
- If `npm run dev` port 5173 is already occupied, set `VITE_PORT` env var and update `playwright.config.ts`
