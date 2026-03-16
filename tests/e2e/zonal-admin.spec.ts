import { test, expect } from '@playwright/test';
import { loginAs, clickTab } from '../fixtures/auth';

// ─────────────────────────────────────────────────────────────────────────────
// ZONAL ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'zonalAdmin');
});

// ── Overview Tab (default) ────────────────────────────────────────────────────

test('overview tab shows Zone Overview heading', async ({ page }) => {
  await expect(page.getByText('Zone Overview').first()).toBeVisible({ timeout: 10_000 });
});

test('overview tab shows zone stat cards', async ({ page }) => {
  const body = await page.locator('main').textContent();
  const hasMetrics = body!.includes('Complaints') ||
    body!.includes('Workers') ||
    body!.includes('Resolved') ||
    body!.includes('Pending');
  expect(hasMetrics).toBe(true);
});

// ── Complaints Tab ────────────────────────────────────────────────────────────

test('complaints tab loads zone-scoped complaints', async ({ page }) => {
  await clickTab(page, 'Complaints');
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  const hasContent = body!.includes('Complaint') ||
    body!.includes('complaint') ||
    body!.includes('No complaints') ||
    body!.includes('SUBMITTED') ||
    body!.includes('RESOLVED');
  expect(hasContent).toBe(true);
});

// ── Workers Tab ───────────────────────────────────────────────────────────────

test('workers tab loads zone workers', async ({ page }) => {
  await clickTab(page, 'Workers');
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  const hasContent = body!.includes('Worker') ||
    body!.includes('worker') ||
    body!.includes('No workers') ||
    body!.includes('Zone');
  expect(hasContent).toBe(true);
});

// ── Work Verification Tab ─────────────────────────────────────────────────────

test('work verification tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Work Verification');
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  const valid = body!.includes('Verification') ||
    body!.includes('verification') ||
    body!.includes('No pending') ||
    body!.includes('Completed') ||
    body!.includes('Approve') ||
    body!.includes('Reject');
  expect(valid).toBe(true);
});

// ── Manage Wards Tab ──────────────────────────────────────────────────────────

test('manage wards tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Manage Wards');
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  const valid = body!.includes('Ward') ||
    body!.includes('ward') ||
    body!.includes('Zone') ||
    body!.includes('City') ||
    body!.includes('Area');
  expect(valid).toBe(true);
});

// ── Settings Tab ──────────────────────────────────────────────────────────────

test('settings tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Settings');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  const valid = body!.includes('Settings') ||
    body!.includes('settings') ||
    body!.includes('Notification') ||
    body!.includes('Language') ||
    body!.includes('Theme');
  expect(valid).toBe(true);
});

// ── Profile Tab ───────────────────────────────────────────────────────────────

test('profile tab shows zonal admin information', async ({ page }) => {
  await clickTab(page, 'Profile');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  const hasProfile = body!.includes('Demo Zonal Admin') ||
    body!.includes('zonaladmin@demo.com') ||
    body!.includes('Zonal') ||
    body!.includes('Profile');
  expect(hasProfile).toBe(true);
});

// ── Access Control ────────────────────────────────────────────────────────────

test('zonal admin does not see superadmin-only tabs', async ({ page }) => {
  const body = await page.locator('aside, nav').textContent();
  const hasSuperadminTabs = body!.includes('Admin Management') ||
    body!.includes('Inventory') ||
    body!.includes('Reports');
  expect(hasSuperadminTabs).toBe(false);
});
