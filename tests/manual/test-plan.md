# Safai Connect — Manual QA Test Plan
**Version:** 1.1  **Date:** 2026-03-04
**Testers:** Run this before any demo, release, or major PR merge
**Demo credentials:** All accounts use password `Demo1234!`

---

## Pre-Test Setup
- [ ] Run `npx tsx scripts/seed-demo.ts` to ensure all demo accounts exist
- [ ] Open browser in Incognito / Private mode (clean session)
- [ ] Open browser DevTools → Console tab (watch for errors during testing)
- [ ] Navigate to `http://localhost:5173` (or the deployed Vercel URL)

---

## 1. Login & Authentication

### 1.1 Landing Page
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 1 | Open app root URL | Landing page loads with SafaiConnect branding | |
| 2 | Click "Get Started" button | Navigates to Login page | |

### 1.2 Login Form
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 3 | Observe login form | Email field, password field, Sign In button visible | |
| 4 | Observe quick-demo section | 5 buttons: Citizen, Worker, Admin, Super Admin, Champion | |
| 5 | Click "Citizen" quick-demo button | Email fills: citizen@demo.com, Password fills: Demo1234! | |
| 6 | Click "Worker" quick-demo button | Email fills: worker@demo.com | |
| 7 | Click "Admin" quick-demo button | Email fills: admin@demo.com | |
| 8 | Click "Super Admin" quick-demo button | Email fills: superadmin@demo.com | |
| 9 | Click "Champion" quick-demo button | Email fills: champion@demo.com | |
| 10 | Enter wrong password → Sign In | Red error message appears | |
| 11 | Clear and re-enter correct credentials | No error | |

### 1.3 Role Routing
| # | Role | Email | Expected Dashboard | Pass/Fail |
|---|------|-------|-------------------|-----------|
| 12 | Citizen | citizen@demo.com | CitizenDashboard, "Report Issue" in sidebar | |
| 13 | Worker | worker@demo.com | WorkerDashboard, "My Tasks" in sidebar | |
| 14 | Admin | admin@demo.com | AdminDashboard, "Dashboard Overview" heading | |
| 15 | Superadmin | superadmin@demo.com | SuperadminDashboard, "System Overview" heading | |
| 16 | Champion | champion@demo.com | Green "Green Champion" banner visible + CitizenDashboard | |

### 1.4 Logout
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 17 | Login as any user → click sidebar "Logout" | Confirmation modal appears with "Confirm Logout" | |
| 18 | Click "Cancel" | Modal closes, user still logged in | |
| 19 | Click "Logout" again → confirm | Navigates away from dashboard | |
| 20 | Reload app | Session is cleared, landing/login page shown | |

### 1.5 Session Persistence
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 21 | Login → reload page | Still logged in, correct dashboard shown | |
| 22 | Login → close tab → open same URL | Stays logged in (localStorage persistence) | |

---

## 2. Citizen Dashboard

Login as **citizen@demo.com / Demo1234!** for all tests in this section.

### 2.1 Home Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 23 | Default tab opens | Home tab is active, stat cards visible | |
| 24 | Observe stat cards | Shows Reports Submitted, Resolved, Training %, Points | |

### 2.2 Report Issue Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 25 | Click "Report Issue" sidebar item | Report form loads with Issue Type selector | |
| 26 | Change Issue Type dropdown | Options: Overflowing Bin, Missed Collection, Illegal Dumping, Damaged Bin, Other | |
| 27 | Try submitting empty form | Browser/form validation prevents submit | |
| 28 | Fill Location field | "Auto-detect" button appears | |
| 29 | Fill Description textarea | Text accepted | |
| 30 | Click microphone icon | Toggles voice input (shows listening state) | |
| 31 | Upload a photo via Gallery | Photo thumbnail appears with camera icon | |
| 32 | **AI Feature:** After first photo upload | AI suggestion chip appears showing category + confidence% | |
| 33 | Click "Apply" on AI suggestion | Issue type + description fields auto-filled | |
| 34 | Click "Submit" (complete form) | Success state, form resets | |
| 35 | Navigate to Track Status | Newly submitted complaint appears in list | |

### 2.3 Track Status Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 36 | Click "Track Status" | "Your Reports" heading visible | |
| 37 | Observe complaint list | Seeded complaints shown with status badges | |
| 38 | Find a RESOLVED complaint | "Rate Final Work" button visible | |
| 39 | Click "Rate Final Work" | Rating modal opens with 1-5 scale | |
| 40 | Submit rating | Rating saved, modal closes | |

### 2.4 Collection Booking Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 41 | Click "Book Collection" | "Request Now" and "Schedule" tabs visible | |
| 42 | Click "Request Now" | Immediate pickup form shown | |
| 43 | Fill address, select waste type | Form accepts input | |
| 44 | Submit "Request Pickup Now" | Booking created, appears in "Your Bookings" | |
| 45 | Click "Schedule in Advance" | Date + time picker appear | |
| 46 | Fill all fields and schedule | Scheduled booking appears in list | |

### 2.5 Rewards Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 47 | Click "Rewards" | Points, tier, and badges section loads | |
| 48 | Check tier display | Citizen (50 pts) → Bronze tier 🥉 | |
| 49 | Observe badges | First Step, Active Reporter, Super Citizen etc. visible | |
| 50 | Unlocked badges | Filled/colored if earned (First Step should be unlocked) | |

### 2.6 Training Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 51 | Click "Training" | Training module list loads | |
| 52 | Open a module | Module content displays | |

---

## 3. Worker Dashboard

Login as **worker@demo.com / Demo1234!**

### 3.1 Tasks Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 53 | Dashboard loads | "My Tasks" heading, stat cards visible | |
| 54 | Check stat cards | Total Assigned, Completed, In Progress, Performance | |
| 55 | Find assigned task | "Start Task" button visible | |
| 56 | Click "Start Task" | Task status → In Progress, "Submit Proof" button appears | |
| 57 | Click "Submit Proof" | Navigates to Submit Proof tab | |

### 3.2 Submit Proof Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 58 | Click "Submit Proof" | "Submit Proof of Work" heading visible | |
| 59 | View current task section | Active task details shown (if in-progress task exists) | |
| 60 | View photo requirements | "Clear view of cleaned area", GPS location enabled etc. | |
| 61 | Upload a proof photo | Photo appears in proof photos grid | |
| 62 | Click "Submit Verification" | Proof submitted to Firestore | |

### 3.3 Attendance Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 63 | Click "Attendance" | Attendance heading, month name, stat cards visible | |
| 64 | Check-in stat cards | Days Present, Attendance Rate, Today's Status | |
| 65 | Today's status card | Shows current check-in status | |
| 66 | Click "Check In Now" | Success: "Checked In at HH:MM" shown | |
| 67 | Check Out button | Available 6+ hours after check-in (or grayed out) | |
| 68 | Monthly calendar | Calendar grid shows Present/Absent/Today colours | |
| 69 | Recent Attendance Log | Last 7-10 days shown with check-in/out times | |

### 3.4 Digital ID Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 70 | Click "Digital ID" | Digital ID card renders with worker info | |
| 71 | Check card content | SAFAI CONNECT branding, worker name, zone, "Active" status | |
| 72 | QR code visible | QR code rendered on the card | |
| 73 | "Save ID Card" button | Saves/downloads the ID card | |

### 3.5 Salary Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 74 | Click "Salary" | Salary records shown (or "No records" if none seeded) | |

---

## 4. Admin Dashboard

Login as **admin@demo.com / Demo1234!**

### 4.1 Overview Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 75 | Dashboard loads | "Dashboard Overview" heading, "System Live" badge | |
| 76 | Stat cards | Total Complaints, Pending Review, Resolved, Active Workers | |
| 77 | Priority Actions panel | Shows SUBMITTED complaints (up to 5) | |
| 78 | "Review" button per complaint | Clickable | |
| 79 | "Manage All →" button | Navigates to Complaints tab | |
| 80 | City Vitals panel | Resolution Rate, Pending Load, In Progress bars | |
| 81 | Quick nav pills | Workers, Citizens, Verify, Payroll — all navigate correctly | |

### 4.2 Complaints Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 82 | Click "Complaints" | Complaint list loads with filter options | |
| 83 | Status filter | Filter by SUBMITTED, UNDER_REVIEW, ASSIGNED, RESOLVED | |
| 84 | Click a complaint | Detail view / action panel opens | |
| 85 | Assign complaint to worker | Worker selection → status changes to ASSIGNED | |
| 86 | Update status manually | Status updated in Firestore in real-time | |

### 4.3 Workers Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 87 | Click "Workers" | Worker list loads, Demo Worker visible | |
| 88 | Worker cards show zone | "Zone A" for Demo Worker | |
| 89 | View worker detail | Click on worker → profile/stats appear | |

### 4.4 Work Verification Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 90 | Click "Work Verification" | Verification queue loads | |
| 91 | Pending items visible | Proof submissions awaiting admin approval | |
| 92 | Approve proof | Status changes to RESOLVED | |
| 93 | Reject proof | Status changes back, worker notified | |

### 4.5 Salary Tracking Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 94 | Click "Salary Tracking" | Worker salary records visible | |
| 95 | Create salary record | Add record for Demo Worker | |

### 4.6 Other Tabs
| # | Tab | Expected | Pass/Fail |
|---|-----|----------|-----------|
| 96 | Training | Training system loads | |
| 97 | Reports | Report charts/tables load | |
| 98 | Heatmap | Map renders with seeded complaint dots | |
| 99 | Broadcast | Broadcast panel loads with send interface | |

---

## 5. Superadmin Dashboard

Login as **superadmin@demo.com / Demo1234!**

### 5.1 Overview Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 100 | Dashboard loads | "System Overview" heading, "Live" badge | |
| 101 | System-wide stats | Total Complaints, Resolved, Active Workers, Admins, Citizens | |
| 102 | Recent activity feed | Last 5 complaints listed | |
| 103 | Worker/Admin/Citizen counts match seeded data | 1 worker, 1 admin, 1 citizen expected | |

### 5.2 Admin Management Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 104 | Click "Admin Management" | Admin list + invite interface loads | |
| 105 | Demo Admin visible | admin@demo.com in the list | |
| 106 | Invite new admin | Enter email → invitation sent | |

### 5.3 Inventory Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 107 | Click "Inventory Management" | Inventory list loads | |
| 108 | Seeded items visible | Trucks (12), Gloves (500), Vests (200) if seed-data was run | |
| 109 | Add new item | Fill name, quantity, unit, zone → save | |
| 110 | Item appears in list | New item visible after save | |
| 111 | Edit item quantity | Update quantity → saved | |
| 112 | Delete item | Confirm deletion → item removed | |

### 5.4 Upload Training Tab
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 113 | Click "Upload Training" | Upload interface loads | |
| 114 | Upload a training file | File accepted, upload progress shown | |
| 115 | Material appears in Training list | Uploaded material visible | |

---

## 6. Green Champion Dashboard

Login as **champion@demo.com / Demo1234!**

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 116 | Login | Green banner appears at top: "Green Champion", "Demo Champion" | |
| 117 | "Active Champion" badge | Visible in banner | |
| 118 | Leaderboard rank | "#N Leaderboard" shows (needs rewardPoints index) | |
| 119 | Citizen features available | Report Issue, Track Status, Rewards, Book Collection all work | |
| 120 | Rewards tab | Shows 200 points (Silver tier 🥈) | |
| 121 | Submit a complaint | Works same as citizen | |
| 122 | Worker-only tabs NOT visible | No "My Tasks", "Attendance", "Digital ID" | |
| 123 | Admin-only tabs NOT visible | No "Work Verification", "Salary Tracking", "Inventory Management" | |

---

## 7. AI Features

### 7.1 Photo Analysis (OpenAI GPT-4o Vision)
**Requires OPENAI_API_KEY in Vercel environment variables**

| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 124 | Login as Citizen → Report Issue tab | Form loads | |
| 125 | Upload any photo (e.g. garbage photo) | AI chip appears: "📸 AI Photo Analysis" | |
| 126 | AI chip shows category | e.g. "Waste Management" | |
| 127 | AI chip shows confidence % | e.g. "87% confident" | |
| 128 | Click "Apply" | Issue Type dropdown and Description filled automatically | |
| 129 | Dismiss AI suggestion | Chip hidden, form fields keep manual values | |
| 130 | Upload photo that is NOT a civic issue | AI returns "Other" with low confidence | |

### 7.2 AI Error Handling
| # | Step | Expected | Pass/Fail |
|---|------|----------|-----------|
| 131 | Disable API key on server → upload photo | Graceful error, form still usable | |
| 132 | Upload corrupted image file | No crash, AI suggestion skipped or error shown | |

---

## 8. Cross-Browser / Responsive

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 133 | Open on mobile viewport (375px) | Hamburger menu visible, sidebar hidden | |
| 134 | Tap hamburger → sidebar opens | Sidebar slides in | |
| 135 | Tap overlay → sidebar closes | Sidebar closes | |
| 136 | All forms usable on mobile | No overflow, inputs focusable | |
| 137 | Rotate to landscape | Layout adjusts, no broken overflow | |

---

## 9. Real-Time Updates

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 138 | Open Admin in Tab A, Citizen in Tab B | Both logged in simultaneously | |
| 139 | Citizen submits new complaint | Admin overview counter increments in real time | |
| 140 | Admin changes complaint status | Citizen track tab shows updated status | |

---

## 10. Error Scenarios

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 141 | Go offline → try to submit complaint | Graceful error, no crash | |
| 142 | Invalid email on login | Error message shown | |
| 143 | Navigate directly to / while logged out | Landing page, not dashboard | |

---

## Post-Test Checklist

- [ ] No console errors in DevTools
- [ ] No Firebase permission-denied errors
- [ ] All 5 role logins work
- [ ] Role isolation confirmed (Citizen can't see Admin tabs)
- [ ] AI photo analysis works end-to-end
- [ ] Real-time updates work across sessions
- [ ] Mobile layout usable

---

## Bug Report Template

```
## Bug #N — [Short title]
**Date:** YYYY-MM-DD
**Tester:** [Name]
**Test case:** #[number] from this plan
**Role/Email:** [role] / [email]
**Steps to reproduce:**
1.
2.
3.
**Expected:**
**Actual:**
**Console errors:**
**Screenshot/video:** [attach]
**Severity:** Critical / High / Medium / Low
```
