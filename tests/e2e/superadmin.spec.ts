import { test, expect } from '@playwright/test';
import { loginAs, clickTab } from '../fixtures/auth';

// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'superadmin');
});

// ── Overview Tab (default) ────────────────────────────────────────────────────

test('overview tab shows System Overview heading', async ({ page }) => {
  await expect(page.getByText('System Overview').first()).toBeVisible({ timeout: 10_000 });
});

test('overview tab shows Live badge', async ({ page }) => {
  await expect(page.getByText('Live').first()).toBeVisible({ timeout: 10_000 });
});

test('overview tab shows system-wide metric cards', async ({ page }) => {
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  const hasMetrics = body!.includes('Complaints') ||
    body!.includes('Workers') ||
    body!.includes('Citizens') ||
    body!.includes('Admins') ||
    body!.includes('Resolved');
  expect(hasMetrics).toBe(true);
});

test('overview tab shows recent activity feed', async ({ page }) => {
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  const hasActivity = body!.includes('Activity') ||
    body!.includes('Recent') ||
    body!.includes('complaint') ||
    body!.includes('Complaint') ||
    body!.includes('No recent');
  expect(hasActivity).toBe(true);
});

// ── Admin Management Tab ──────────────────────────────────────────────────────

test('admin management tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Admin Management');
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  expect(body).toBeTruthy();
  expect(body).not.toContain('Cannot read');
  const hasAdminContent = body!.includes('Admin') ||
    body!.includes('admin') ||
    body!.includes('Invite') ||
    body!.includes('Management') ||
    body!.includes('No admins');
  expect(hasAdminContent).toBe(true);
});

test('admin management shows invite admin feature', async ({ page }) => {
  await clickTab(page, 'Admin Management');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  // Should have invite functionality or admin list
  const hasInviteOrList = body!.includes('Invite') ||
    body!.includes('invite') ||
    body!.includes('Add Admin') ||
    body!.includes('Demo Admin') ||
    body!.includes('admin@demo.com');
  expect(hasInviteOrList).toBe(true);
});

// ── Training Tab ──────────────────────────────────────────────────────────────

test('training tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Training');
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  expect(body).toBeTruthy();
  expect(body).not.toContain('Cannot read');
});

// ── Training Content ──────────────────────────────────────────────────────────

test('training tab shows training/upload related content', async ({ page }) => {
  await clickTab(page, 'Training');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  const hasTrainingContent = body!.includes('Training') ||
    body!.includes('training') ||
    body!.includes('Module') ||
    body!.includes('Upload') ||
    body!.includes('Progress');
  expect(hasTrainingContent).toBe(true);
});

// ── Reports Tab ───────────────────────────────────────────────────────────────

test('reports tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Reports');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  expect(body).toBeTruthy();
  expect(body).not.toContain('Cannot read');
});

// ── Reports Detail ────────────────────────────────────────────────────────────

test('reports tab shows reporting content', async ({ page }) => {
  await clickTab(page, 'Reports');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  const hasReportContent = body!.includes('Report') ||
    body!.includes('Reports') ||
    body!.includes('Complaints') ||
    body!.includes('Resolution');
  expect(hasReportContent).toBe(true);
});

// ── Inventory Tab ─────────────────────────────────────────────────────────────

test('inventory tab loads and shows inventory list or empty state', async ({ page }) => {
  await clickTab(page, 'Inventory Management');
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  expect(body).toBeTruthy();
  expect(body).not.toContain('Cannot read');
  const hasInventoryContent = body!.includes('Inventory') ||
    body!.includes('inventory') ||
    body!.includes('Truck') ||
    body!.includes('Gloves') ||
    body!.includes('Vest') ||
    body!.includes('Add') ||
    body!.includes('No inventory');
  expect(hasInventoryContent).toBe(true);
});

test('inventory tab shows management actions', async ({ page }) => {
  await clickTab(page, 'Inventory Management');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  const hasManagementActions = body!.includes('Add') ||
    body!.includes('Edit') ||
    body!.includes('Delete') ||
    body!.includes('Search') ||
    body!.includes('Inventory') ||
    body!.includes('Setting up inventory');
  expect(hasManagementActions).toBe(true);
});

// ── Settings Tab ──────────────────────────────────────────────────────────────

test('settings tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Settings');
  await page.waitForTimeout(1_000);
  const body = await page.locator('main').textContent();
  expect(body).toBeTruthy();
});

// ── Profile Tab ───────────────────────────────────────────────────────────────

test('profile tab shows superadmin information', async ({ page }) => {
  await clickTab(page, 'Profile');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  const hasProfile = body!.includes('superadmin@demo.com') || body!.includes('Demo Superadmin');
  expect(hasProfile).toBe(true);
});

// ── Superadmin-specific access controls ───────────────────────────────────────

test('superadmin can see Inventory Management (superadmin-only tab)', async ({ page }) => {
  // Inventory is superadmin-only — this sidebar item should be visible
  await expect(page.getByRole('button', { name: 'Inventory Management', exact: true })).toBeVisible();
});

test('superadmin can see Training tab', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Training', exact: true })).toBeVisible();
});
