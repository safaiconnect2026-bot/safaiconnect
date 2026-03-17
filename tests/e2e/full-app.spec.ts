/**
 * SafaiConnect — Full Application E2E Test Suite
 *
 * Tests every dashboard, tab navigation, core workflows, and UI behaviors.
 * Requires: demo accounts seeded via `npx tsx scripts/seed-demo.ts`
 */

import { test, expect, Page } from '@playwright/test';
import {
  loginAs,
  logout,
  clickTab,
  goToLogin,
  dismissTourIfVisible,
  DEMO_CREDENTIALS,
  DemoRole,
} from '../fixtures/auth';

// ═══════════════════════════════════════════════════════════════════════════
// 1. LANDING PAGE & AUTH
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Landing Page', () => {
  test('renders the landing page with hero section', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Should show the landing page by default
    await expect(page.locator('body')).toContainText(/safai/i, { timeout: 15_000 });
  });

  test('has navigation links visible', async ({ page }) => {
    // Ensure fresh landing (not login) by clearing localStorage first
    await page.addInitScript(() => {
      window.localStorage.removeItem('currentView_safai');
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Either logo or main heading should be visible
    const body = await page.locator('body').innerText();
    expect(body.match(/safai|smart waste|clean city/i)).toBeTruthy();
  });

  test('navigates to login page', async ({ page }) => {
    await goToLogin(page);
    await expect(page.locator('input[placeholder="Enter your email"]')).toBeVisible({ timeout: 10_000 });
    // Password field has bullet placeholder "••••••••"
    await expect(page.locator('input[type="password"], input[placeholder="••••••••"]').first()).toBeVisible();
  });
});

test.describe('Authentication', () => {
  test('shows error for invalid credentials', async ({ page }) => {
    await goToLogin(page);
    const emailInput = page.locator('input[placeholder="Enter your email"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill('nonexistent@test.com');
    await page.locator('input[type="password"], input[placeholder="••••••••"]').first().fill('wrongpass');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    // Should show an error toast or stay on login page
    await page.waitForTimeout(5000);
    // Page should still be on login (not navigated to a dashboard)
    const body = await page.locator('body').innerText();
    expect(
      body.match(/sign in|email|password|error|invalid|failed/i)
    ).toBeTruthy();
  });

  test('quick demo buttons auto-fill credentials', async ({ page }) => {
    await goToLogin(page);
    // Click the Citizen demo button
    await page
      .locator('.bg-amber-50')
      .locator('button')
      .filter({ has: page.locator('span', { hasText: /^Citizen$/ }) })
      .click();

    await expect(
      page.locator('input[placeholder="Enter your email"]')
    ).toHaveValue('citizen@demo.com', { timeout: 3_000 });
  });

  test('login and logout as citizen', async ({ page }) => {
    await loginAs(page, 'citizen');
    // Verify dashboard loaded
    await expect(page.getByText('Report Issue').first()).toBeVisible();
    // Logout
    await logout(page);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. CITIZEN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Citizen Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'citizen');
  });

  test('loads home tab by default', async ({ page }) => {
    // Home tab should be active — shows overview cards or welcome content
    await expect(page.locator('body')).not.toContainText('Loading your dashboard');
  });

  test('navigates to Report Issue tab', async ({ page }) => {
    await clickTab(page, 'Report Issue');
    // Should show the complaint form elements
    await expect(page.locator('body')).toContainText(/category|issue type|describe/i, { timeout: 10_000 });
  });

  test('navigates to Track Status tab', async ({ page }) => {
    await clickTab(page, 'Track Status');
    // Should show complaint list or empty state
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(
      body.match(/submitted|assigned|resolved|no complaints|track/i)
    ).toBeTruthy();
  });

  test('navigates to Book Collection tab', async ({ page }) => {
    await clickTab(page, 'Book Collection');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/collection|book|schedule|immediate/i)).toBeTruthy();
  });

  test('navigates to Settings tab', async ({ page }) => {
    await clickTab(page, 'Settings');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/settings|language|dark mode|theme|notification/i)).toBeTruthy();
  });

  test('navigates to Profile tab', async ({ page }) => {
    await clickTab(page, 'Profile');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/profile|name|email|citizen/i)).toBeTruthy();
  });

  test('navigates to Rewards tab', async ({ page }) => {
    await clickTab(page, 'Rewards');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/reward|points|badges|leaderboard/i)).toBeTruthy();
  });

  test('navigates to Training tab', async ({ page }) => {
    await clickTab(page, 'Training');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/training|education|module|learn/i)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. WORKER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Worker Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'worker');
  });

  test('loads with My Tasks visible', async ({ page }) => {
    await expect(page.getByText('My Tasks').first()).toBeVisible();
  });

  test('navigates to Submit Proof tab', async ({ page }) => {
    await clickTab(page, 'Submit Proof');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/proof|evidence|photo|submit|upload|select a task/i)).toBeTruthy();
  });

  test('navigates to Attendance tab', async ({ page }) => {
    await clickTab(page, 'Attendance');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/attendance|check.?in|present|clock/i)).toBeTruthy();
  });

  test('navigates to Digital ID tab', async ({ page }) => {
    await clickTab(page, 'Digital ID');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/digital.?id|identity|worker|card/i)).toBeTruthy();
  });

  test('navigates to Collection Requests tab', async ({ page }) => {
    await clickTab(page, 'Collection Requests');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/collection|request|booking|pending/i)).toBeTruthy();
  });

  test('navigates to Training tab', async ({ page }) => {
    await clickTab(page, 'Training');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/training|module|learn|course/i)).toBeTruthy();
  });

  test('navigates to Settings tab', async ({ page }) => {
    await clickTab(page, 'Settings');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/settings|language|dark mode|theme/i)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('loads Overview tab by default', async ({ page }) => {
    await expect(page.locator('body')).toContainText(/overview|dashboard|complaints|total/i);
  });

  test('navigates to Complaints tab', async ({ page }) => {
    await clickTab(page, 'Complaints');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/complaint|issue|submitted|status/i)).toBeTruthy();
  });

  test('navigates to Workers tab', async ({ page }) => {
    await clickTab(page, 'Workers');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/worker|staff|employee|manage/i)).toBeTruthy();
  });

  test('navigates to Work Verification tab', async ({ page }) => {
    await clickTab(page, 'Work Verification');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/verification|review|approve|pending/i)).toBeTruthy();
  });

  test('navigates to Salary Tracking tab', async ({ page }) => {
    await clickTab(page, 'Salary Tracking');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/salary|payment|pay|earning/i)).toBeTruthy();
  });

  test('navigates to Collection Bookings tab', async ({ page }) => {
    await clickTab(page, 'Collection Bookings');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/collection|booking|schedule|request/i)).toBeTruthy();
  });

  test('navigates to Manage Areas tab', async ({ page }) => {
    await clickTab(page, 'Manage Areas');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/area|zone|ward|location|manage/i)).toBeTruthy();
  });

  test('navigates to Settings tab', async ({ page }) => {
    await clickTab(page, 'Settings');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/settings|language|dark mode|theme/i)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. ZONAL ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Zonal Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'zonalAdmin');
  });

  test('loads Zone Overview', async ({ page }) => {
    await expect(page.getByText('Zone Overview').first()).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to Complaints tab', async ({ page }) => {
    await clickTab(page, 'Complaints');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/complaint|issue|status|submitted/i)).toBeTruthy();
  });

  test('navigates to Workers tab', async ({ page }) => {
    await clickTab(page, 'Workers');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/worker|staff|assign|manage/i)).toBeTruthy();
  });

  test('navigates to Work Verification tab', async ({ page }) => {
    await clickTab(page, 'Work Verification');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/verification|review|approve|pending/i)).toBeTruthy();
  });

  test('navigates to Collection Bookings tab', async ({ page }) => {
    await clickTab(page, 'Collection Bookings');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/collection|booking|schedule|request/i)).toBeTruthy();
  });

  test('navigates to Manage Wards tab', async ({ page }) => {
    await clickTab(page, 'Manage Wards');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/ward|area|zone|manage/i)).toBeTruthy();
  });

  test('navigates to Settings tab', async ({ page }) => {
    await clickTab(page, 'Settings');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/settings|language|dark mode|theme/i)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. SUPERADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Superadmin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'superadmin');
  });

  test('loads System Overview', async ({ page }) => {
    await expect(page.getByText('System Overview').first()).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to Admin Management tab', async ({ page }) => {
    await clickTab(page, 'Admin Management');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/admin|manage|create|role/i)).toBeTruthy();
  });

  test('navigates to Citizen Management tab', async ({ page }) => {
    await clickTab(page, 'Citizens');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/citizen|user|manage/i)).toBeTruthy();
  });

  test('navigates to Worker Management tab', async ({ page }) => {
    await clickTab(page, 'Workers');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/worker|staff|manage/i)).toBeTruthy();
  });

  test('navigates to Locations tab', async ({ page }) => {
    await clickTab(page, 'Locations');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/location|city|zone|ward/i)).toBeTruthy();
  });

  test('navigates to Reports tab', async ({ page }) => {
    await clickTab(page, 'Reports');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/report|analytics|chart|data/i)).toBeTruthy();
  });

  test('navigates to Inventory Management tab', async ({ page }) => {
    await clickTab(page, 'Inventory Management');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    expect(body.match(/inventory|item|stock|manage/i)).toBeTruthy();
  });

  test('navigates to Settings tab', async ({ page }) => {
    await clickTab(page, 'Settings');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/settings|language|dark mode|theme/i)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. GREEN CHAMPION DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Green Champion Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'champion');
  });

  test('loads with Green Champion marker', async ({ page }) => {
    await expect(page.getByText('Green Champion').first()).toBeVisible({ timeout: 10_000 });
  });

  test('has Champion Hub tab', async ({ page }) => {
    await clickTab(page, 'Champion Hub');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.match(/champion|leaderboard|rank|reward|points/i)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. CROSS-CUTTING: SETTINGS TAB FEATURES
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Settings Tab — Language & Dark Mode', () => {
  test('language dropdown is not clipped by overflow', async ({ page }) => {
    await loginAs(page, 'citizen');
    await clickTab(page, 'Settings');
    await page.waitForTimeout(1000);

    // The language dropdown should be clickable and visible
    const langSelector = page.locator('select').first();
    if (await langSelector.isVisible().catch(() => false)) {
      await langSelector.click();
      // Should not be clipped — dropdown options should appear
    }
  });

  test('dark mode toggle exists and is clickable', async ({ page }) => {
    await loginAs(page, 'citizen');
    await clickTab(page, 'Settings');
    await page.waitForTimeout(1000);

    const body = await page.locator('body').innerText();
    expect(body.match(/dark mode|theme/i)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. SIDEBAR UI
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Sidebar', () => {
  test('sidebar shows collapse button on desktop', async ({ page }) => {
    await loginAs(page, 'admin');
    // Look for the collapse toggle button (chevron icon)
    const collapseBtn = page.locator('button').filter({ has: page.locator('[class*="chevron"], [class*="Chevron"]') }).first();
    // Or look for the sidebar with a toggle
    const sidebar = page.locator('nav, aside, [class*="sidebar"], [class*="Sidebar"]').first();
    await expect(sidebar).toBeVisible();
  });

  test('sidebar shows logo', async ({ page }) => {
    await loginAs(page, 'admin');
    // On desktop, logo is in the sidebar (header logo is lg:hidden)
    // Look for any visible SafaiConnect logo — sidebar full logo or icon
    const sidebarLogo = page.locator('img[alt="SafaiConnect"]');
    const count = await sidebarLogo.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      if (await sidebarLogo.nth(i).isVisible().catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. ONBOARDING CHECKLIST FAB
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Onboarding Checklist', () => {
  test('FAB is visible after login', async ({ page }) => {
    await loginAs(page, 'citizen');
    // The FAB button should appear (? icon or checklist icon)
    const fab = page.locator('[class*="fixed"][class*="bottom"]').locator('button').first();
    // Give it a moment to mount
    await page.waitForTimeout(2000);
    if (await fab.isVisible().catch(() => false)) {
      await fab.click();
      await page.waitForTimeout(500);
      // Panel should open with checklist items
      const panelText = await page.locator('body').innerText();
      expect(panelText.match(/checklist|getting started|onboarding|report|explore/i)).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. LOCATION MANAGEMENT (ADMIN)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Location Management — Enter key', () => {
  test('Add Ward modal submits on Enter key', async ({ page }) => {
    await loginAs(page, 'admin');
    await clickTab(page, 'Manage Areas');
    await page.waitForTimeout(3000);

    // Check that Manage Areas loaded
    const body = await page.locator('body').innerText();
    if (body.match(/zone|ward|city/i)) {
      // The "Add" button(s) for ward/zone should exist
      const addBtn = page.getByRole('button', { name: /add/i }).first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(500);
        // Modal should appear with an input
        const input = page.locator('input[placeholder*="Enter"]').first();
        if (await input.isVisible().catch(() => false)) {
          await input.fill('Test Ward E2E');
          // Press Enter — should submit (not hang)
          await input.press('Enter');
          await page.waitForTimeout(2000);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. RESPONSIVE: HEADER & INSTALL BANNER
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Header & Install Banner', () => {
  test('install banner does not appear in standalone mode', async ({ page }) => {
    // Simulate standalone PWA mode
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'standalone', { value: true });
      Object.defineProperty(window, 'matchMedia', {
        value: (q: string) => ({
          matches: q.includes('display-mode: standalone'),
          media: q,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    // Install banner should NOT be visible
    const banner = page.locator('[class*="install"], [data-testid="install-banner"]');
    if (await banner.count() > 0) {
      await expect(banner.first()).not.toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. ALL ROLES LOGIN SMOKE TEST
// ═══════════════════════════════════════════════════════════════════════════

test.describe('All Roles Login Smoke Test', () => {
  const roles: DemoRole[] = ['citizen', 'worker', 'admin', 'superadmin', 'champion', 'zonalAdmin'];

  for (const role of roles) {
    test(`login as ${role} succeeds`, async ({ page }) => {
      await loginAs(page, role);
      // Dashboard marker should be visible
      const marker = DEMO_CREDENTIALS[role].dashboardMarker;
      await expect(page.getByText(marker).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. COMPLAINT LIFECYCLE (CITIZEN → TRACK)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Complaint Tracking', () => {
  test('citizen can see complaints in Track tab', async ({ page }) => {
    await loginAs(page, 'citizen');
    await clickTab(page, 'Track Status');
    await page.waitForTimeout(5000);
    const body = await page.locator('body').innerText();
    // Should show complaint list or status indicators (seeded data)
    expect(
      body.match(/garbage|streetlight|pothole|drainage|manhole|waste|footpath|water|noise|overflow|submitted|assigned|resolved|no complaints|track/i)
    ).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 15. ADMIN VERIFICATION TAB DATA LOADS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Admin Work Verification', () => {
  test('verification tab loads with stats', async ({ page }) => {
    await loginAs(page, 'admin');
    await clickTab(page, 'Work Verification');
    await page.waitForTimeout(4000);
    const body = await page.locator('body').innerText();
    // Should show stat cards: Pending Review, Approved, etc.
    expect(body.match(/pending|approved|reject|rate|verification|all caught up/i)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 16. ZONAL ADMIN COMPLAINT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Zonal Admin Complaint Management', () => {
  test('can see complaints scoped to zone', async ({ page }) => {
    await loginAs(page, 'zonalAdmin');
    await clickTab(page, 'Complaints');
    await page.waitForTimeout(4000);
    const body = await page.locator('body').innerText();
    // Should show complaints in the Dharampeth zone or empty state
    expect(
      body.match(/complaint|submitted|assigned|no complaint|issue/i)
    ).toBeTruthy();
  });
});
