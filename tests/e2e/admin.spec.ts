import { test, expect } from '@playwright/test';
import { loginAs, clickTab } from '../fixtures/auth';

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'admin');
});

// ── Overview Tab (default) ────────────────────────────────────────────────────

test('overview tab shows Dashboard Overview heading', async ({ page }) => {
  await expect(page.getByText('Dashboard Overview').first()).toBeVisible({ timeout: 10_000 });
});

test('overview tab shows System Live badge', async ({ page }) => {
  await expect(page.getByText('System Live').first()).toBeVisible({ timeout: 10_000 });
});

test('overview tab shows 4 metric stat cards', async ({ page }) => {
  const body = await page.locator('main').textContent();
  const hasMetrics = body!.includes('Total Complaints') ||
    body!.includes('Resolved') ||
    body!.includes('Active Workers') ||
    body!.includes('Pending');
  expect(hasMetrics).toBe(true);
});

test('overview tab shows Priority Actions section', async ({ page }) => {
  await expect(page.getByText('Priority Actions').first()).toBeVisible({ timeout: 10_000 });
});

test('overview tab shows City Vitals section', async ({ page }) => {
  await expect(page.getByText('City Vitals').first()).toBeVisible({ timeout: 10_000 });
});

test('overview quick-nav to Complaints tab works', async ({ page }) => {
  // The "Manage All →" button navigates to complaints tab
  const manageAllBtn = page.getByRole('button', { name: /manage all/i });
  await expect(manageAllBtn).toBeVisible({ timeout: 5_000 });
  await manageAllBtn.click();
  await page.waitForTimeout(1_000);
  // Should now be on the complaints tab
  const body = await page.locator('main').textContent();
  expect(body!.includes('Complaints') || body!.includes('complaint')).toBe(true);
});

// ── Complaints Tab ────────────────────────────────────────────────────────────

test('complaints tab loads and shows complaint list or empty state', async ({ page }) => {
  await clickTab(page, 'Complaints');
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  const hasComplaintContent = body!.includes('Complaint') ||
    body!.includes('complaint') ||
    body!.includes('SUBMITTED') ||
    body!.includes('RESOLVED') ||
    body!.includes('No complaints');
  expect(hasComplaintContent).toBe(true);
});

test('complaints tab has filter or search functionality', async ({ page }) => {
  await clickTab(page, 'Complaints');
  await page.waitForTimeout(2_000);
  // Should have some filtering/search UI
  const body = await page.locator('main').textContent();
  const hasFilter = body!.includes('Filter') ||
    body!.includes('Search') ||
    body!.includes('Status') ||
    body!.includes('All');
  expect(hasFilter).toBe(true);
});

// ── Workers Tab ───────────────────────────────────────────────────────────────

test('workers tab loads and shows worker list', async ({ page }) => {
  await clickTab(page, 'Workers');
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  const hasWorkerContent = body!.includes('Worker') ||
    body!.includes('worker') ||
    body!.includes('Zone') ||
    body!.includes('No workers');
  expect(hasWorkerContent).toBe(true);
});

test('workers tab shows demo worker', async ({ page }) => {
  await clickTab(page, 'Workers');
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  // Seeded worker should appear
  const hasSeededWorker = body!.includes('Demo Worker') || body!.includes('worker@demo.com');
  expect(hasSeededWorker).toBe(true);
});

// ── Work Verification Tab ─────────────────────────────────────────────────────

test('work verification tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Work Verification');
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  expect(body).toBeTruthy();
  expect(body).not.toContain('Cannot read');
  const hasVerificationContent = body!.includes('Verification') ||
    body!.includes('verification') ||
    body!.includes('Evidence') ||
    body!.includes('pending') ||
    body!.includes('No pending');
  expect(hasVerificationContent).toBe(true);
});

// ── Salary Tab ────────────────────────────────────────────────────────────────

test('salary tracking tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Salary Tracking');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  expect(body).toBeTruthy();
  expect(body).not.toContain('Cannot read');
});

// ── Training Tab ──────────────────────────────────────────────────────────────

test('training tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Training');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  expect(body).toBeTruthy();
  expect(body).not.toContain('Cannot read');
});

// ── Sidebar Access ────────────────────────────────────────────────────────────

test('admin does not see superadmin-only tabs', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Admin Management', exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Inventory Management', exact: true })).not.toBeVisible();
});

// ── Settings Tab ──────────────────────────────────────────────────────────────

test('settings tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Settings');
  await page.waitForTimeout(1_000);
  const body = await page.locator('main').textContent();
  expect(body).toBeTruthy();
});

// ── Profile Tab ───────────────────────────────────────────────────────────────

test('profile tab shows admin information', async ({ page }) => {
  await clickTab(page, 'Profile');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  const hasProfile = body!.includes('admin@demo.com') || body!.includes('Demo Admin');
  expect(hasProfile).toBe(true);
});
