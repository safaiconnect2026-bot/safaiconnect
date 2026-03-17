/**
 * Smoke Test Suite — SafaiConnect
 * ─────────────────────────────────────────────────────────────────────────────
 * Verifies critical application paths are alive before any deeper testing.
 * Run with: npm run test -- --grep @smoke
 * Or: npx playwright test tests/e2e/smoke.spec.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { test, expect } from '@playwright/test';
import { goToLogin, loginAs, logout, DEMO_CREDENTIALS } from '../fixtures/auth';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Application Load
// ─────────────────────────────────────────────────────────────────────────────

test.describe('App Load @smoke', () => {
  test('landing page loads with SafaiConnect branding', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Either landing page or login page — app must render something
    await expect(page.locator('body')).not.toBeEmpty();
    // SafaiConnect name should appear somewhere on the page
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.toLowerCase()).toContain('safai');
  });

  test('login page renders all required fields', async ({ page }) => {
    await goToLogin(page);
    await expect(page.locator('input[placeholder="Enter your email"]')).toBeVisible();
    await expect(page.locator('input[placeholder="••••••••"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('quick-demo section shows all 6 role buttons', async ({ page }) => {
    await goToLogin(page);
    const demoSection = page.locator('.bg-amber-50');
    await expect(demoSection).toBeVisible();

    const expectedLabels = ['Citizen', 'Worker', 'Admin', 'Super Admin', 'Champion', 'Zonal Admin'];
    for (const label of expectedLabels) {
      await expect(
        demoSection.locator('button').filter({
          has: page.locator('span', { hasText: new RegExp(`^${label}$`) }),
        })
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Authentication — Login & Logout
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Authentication @smoke', () => {
  test('invalid credentials show error message', async ({ page }) => {
    await goToLogin(page);
    await page.locator('input[placeholder="Enter your email"]').fill('notauser@demo.com');
    await page.locator('input[placeholder="••••••••"]').fill('WrongPass999');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    // A red error container must appear
    await expect(
      page.locator('.bg-red-50, [class*="bg-red"]').first()
    ).toBeVisible({ timeout: 12_000 });
  });

  test('citizen demo button auto-fills credentials', async ({ page }) => {
    await goToLogin(page);
    await page
      .locator('.bg-amber-50')
      .locator('button')
      .filter({ has: page.locator('span', { hasText: /^Citizen$/ }) })
      .click();
    await expect(
      page.locator('input[placeholder="Enter your email"]')
    ).toHaveValue(DEMO_CREDENTIALS.citizen.email, { timeout: 5_000 });
    await expect(
      page.locator('input[placeholder="••••••••"]')
    ).toHaveValue('Demo@1234', { timeout: 5_000 });
  });

  test('logout modal appears and confirms sign-out', async ({ page }) => {
    await loginAs(page, 'citizen');
    // Sidebar logout button
    await page.getByRole('button', { name: /logout/i }).first().click();
    await expect(page.getByText('Confirm Logout')).toBeVisible({ timeout: 5_000 });
    // Confirm logout
    await page.getByRole('button', { name: /logout/i }).last().click();
    await page.waitForFunction(
      () => !document.body.innerText.includes('Report Issue'),
      { timeout: 15_000 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Role-Based Login — each role reaches its correct dashboard
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Role Login @smoke', () => {
  test('citizen logs in and sees Report Issue', async ({ page }) => {
    await loginAs(page, 'citizen');
    await expect(page.getByText('Report Issue').first()).toBeVisible({ timeout: 15_000 });
  });

  test('worker logs in and sees My Tasks', async ({ page }) => {
    await loginAs(page, 'worker');
    await expect(page.getByText('My Tasks').first()).toBeVisible({ timeout: 15_000 });
  });

  test('admin logs in and sees Dashboard Overview', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page.getByText('Dashboard Overview').first()).toBeVisible({ timeout: 15_000 });
  });

  test('superadmin logs in and sees System Overview', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await expect(page.getByText('System Overview').first()).toBeVisible({ timeout: 15_000 });
  });

  test('green champion logs in and sees champion banner', async ({ page }) => {
    await loginAs(page, 'champion');
    await expect(page.getByText('Green Champion').first()).toBeVisible({ timeout: 15_000 });
  });

  test('zonal admin logs in and sees Zone Overview', async ({ page }) => {
    await loginAs(page, 'zonalAdmin');
    await expect(page.getByText('Zone Overview').first()).toBeVisible({ timeout: 15_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Role Isolation — roles cannot see each other's restricted content
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Role Isolation @smoke', () => {
  test('citizen cannot see Admin-only sidebar tabs', async ({ page }) => {
    await loginAs(page, 'citizen');
    await expect(
      page.getByRole('button', { name: 'Workers', exact: true })
    ).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Work Verification', exact: true })
    ).not.toBeVisible();
  });

  test('worker cannot see Superadmin-only sidebar tabs', async ({ page }) => {
    await loginAs(page, 'worker');
    await expect(
      page.getByRole('button', { name: 'Admin Management', exact: true })
    ).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Inventory Management', exact: true })
    ).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Core Navigation — sidebar tab switching per role
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Core Navigation @smoke', () => {
  test('citizen can navigate to Track Status tab', async ({ page }) => {
    await loginAs(page, 'citizen');
    await page.getByRole('button', { name: 'Track Status', exact: true }).first().click();
    await page.waitForTimeout(1_000);
    await expect(page.getByText(/your reports/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('worker can navigate to Attendance tab', async ({ page }) => {
    await loginAs(page, 'worker');
    await page.getByRole('button', { name: 'Attendance', exact: true }).first().click();
    await page.waitForTimeout(1_000);
    await expect(page.getByText(/attendance/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('admin can navigate to Complaints tab', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.getByRole('button', { name: 'Complaints', exact: true }).first().click();
    await page.waitForTimeout(1_000);
    // Complaints tab should render a list or heading
    await expect(page.getByText(/complaint/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('superadmin can navigate to Admin Management tab', async ({ page }) => {
    await loginAs(page, 'superadmin');
    await page.getByRole('button', { name: 'Admin Management', exact: true }).first().click();
    await page.waitForTimeout(1_000);
    await expect(page.getByText(/admin/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Session Persistence
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Session @smoke', () => {
  test('session persists after page reload', async ({ page }) => {
    await loginAs(page, 'citizen');
    await page.reload();
    await page.waitForFunction(
      () =>
        !document.body.innerText.includes('Loading your dashboard') &&
        !document.body.innerText.includes('Loading your profile'),
      { timeout: 20_000 }
    );
    await expect(page.getByText('Report Issue').first()).toBeVisible({ timeout: 15_000 });
  });
});
