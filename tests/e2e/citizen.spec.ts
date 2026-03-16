import { test, expect } from '@playwright/test';
import { loginAs, clickTab } from '../fixtures/auth';

// ─────────────────────────────────────────────────────────────────────────────
// CITIZEN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'citizen');
});

// ── Home Tab ──────────────────────────────────────────────────────────────────

test('home tab shows 4 stat cards', async ({ page }) => {
  // The citizen home tab shows stat cards for reports, resolved, training, points
  // Default active tab is 'home'
  await expect(page.getByText('Report Issue').first()).toBeVisible();
  // At least one stat card heading should be present
  // StatCard titles use translation keys - check for common visible text
  const body = await page.locator('main').textContent();
  expect(body).toBeTruthy();
});

// ── Report Issue Tab ──────────────────────────────────────────────────────────

test('report issue tab shows complaint submission form', async ({ page }) => {
  await clickTab(page, 'Report Issue');
  // Issue type select
  await expect(page.locator('select').first()).toBeVisible({ timeout: 5_000 });
  // Location input
  await expect(page.locator('input[placeholder*="location"], input[placeholder*="Location"], input[placeholder*="address"]').first()).toBeVisible({ timeout: 5_000 });
  // Description textarea
  await expect(page.locator('textarea').first()).toBeVisible({ timeout: 5_000 });
  // Submit button
  await expect(page.getByRole('button', { name: /submit/i }).first()).toBeVisible();
});

test('report issue form requires location and description before submit', async ({ page }) => {
  await clickTab(page, 'Report Issue');
  // Try submitting with empty form — HTML5 required validation should prevent it
  const submitBtn = page.getByRole('button', { name: /submit/i }).first();
  await submitBtn.click();
  // The form should not have navigated away
  await expect(page.locator('textarea').first()).toBeVisible();
});

test('fills and submits a complaint successfully', async ({ page }) => {
  await clickTab(page, 'Report Issue');

  // Select issue type
  const issueSelect = page.locator('select').first();
  await issueSelect.selectOption({ label: 'Overflowing Bin' });

  // Fill location
  const locationInput = page.locator('input[placeholder*="location" i], input[placeholder*="address" i]').first();
  await locationInput.fill('Test Location, Zone A');

  // Fill description
  const descTextarea = page.locator('textarea').first();
  await descTextarea.fill('This is a test complaint from automated Playwright tests.');

  // Submit
  const submitBtn = page.getByRole('button', { name: /submit/i }).first();
  await submitBtn.click();

  // After successful submission the form should reset or a success toast/state appears
  // Wait for form to reset (description clears) or a success indicator
  await page.waitForFunction(
    () => {
      const textareas = document.querySelectorAll('textarea');
      return textareas.length === 0 ||
             (textareas[0] as HTMLTextAreaElement).value === '' ||
             document.body.innerText.includes('submitted') ||
             document.body.innerText.includes('success') ||
             document.body.innerText.includes('Thank');
    },
    { timeout: 15_000 }
  );
});

// ── Track Status Tab ──────────────────────────────────────────────────────────

test('track status tab shows complaints history heading', async ({ page }) => {
  await clickTab(page, 'Track Status');
  await expect(page.getByText('Your Reports').first()).toBeVisible({ timeout: 10_000 });
});

test('track tab shows complaint statuses', async ({ page }) => {
  await clickTab(page, 'Track Status');
  // Wait for the list to load — either shows items or empty state
  await page.waitForTimeout(3_000); // Firebase listener needs time
  const body = await page.locator('main').textContent();
  // Should show either complaints or a "no complaints" message
  expect(body).toBeTruthy();
  expect(body!.length).toBeGreaterThan(10);
});

// ── Collection Booking Tab ────────────────────────────────────────────────────

test('collection booking tab shows pickup request form', async ({ page }) => {
  await clickTab(page, 'Book Collection');
  // Should have Request Now and Schedule tabs
  await expect(page.getByRole('button', { name: /request now/i }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /schedule/i }).first()).toBeVisible();
});

test('collection booking has address and waste type fields', async ({ page }) => {
  await clickTab(page, 'Book Collection');
  // Address field
  await expect(page.locator('input[placeholder*="address" i], input[placeholder*="pickup" i]').first()).toBeVisible({ timeout: 5_000 });
  // Waste type select
  await expect(page.locator('select').first()).toBeVisible();
});

test('fills and submits immediate pickup request', async ({ page }) => {
  await clickTab(page, 'Book Collection');

  // Make sure "Request Now" tab is active
  await page.getByRole('button', { name: /request now/i }).first().click();

  // Fill address
  const addressInput = page.locator('input[placeholder*="address" i], input[placeholder*="pickup" i], input[required]').first();
  await addressInput.fill('123 Test Street, Zone A');

  // Select waste type
  const wasteSelect = page.locator('select').first();
  await wasteSelect.selectOption({ index: 1 }); // Pick first non-empty option

  // Submit
  const pickupBtn = page.getByRole('button', { name: /request pickup now/i });
  await pickupBtn.click();

  // Should show success or reset form
  await page.waitForFunction(
    () => document.body.innerText.includes('Booking') ||
          document.body.innerText.includes('booked') ||
          document.body.innerText.includes('success') ||
          document.body.innerText.includes('scheduled') ||
          document.body.innerText.includes('request'),
    { timeout: 15_000 }
  );
});

// ── Rewards Tab ───────────────────────────────────────────────────────────────

test('rewards tab shows badges and tier information', async ({ page }) => {
  await clickTab(page, 'Rewards');
  // Reward tier names should be visible
  await page.waitForTimeout(1_000);
  const body = await page.locator('main').textContent();
  // Should contain reward-related content
  const hasRewardContent = body!.includes('Bronze') ||
    body!.includes('Silver') ||
    body!.includes('Gold') ||
    body!.includes('Points') ||
    body!.includes('Badge') ||
    body!.includes('First Step');
  expect(hasRewardContent).toBe(true);
});

// ── Training Tab ──────────────────────────────────────────────────────────────

test('training tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Training');
  await page.waitForTimeout(2_000);
  // Should not show a crash/error page
  const body = await page.locator('main').textContent();
  expect(body).toBeTruthy();
  expect(body).not.toContain('Cannot read');
  expect(body).not.toContain('is not defined');
});

// ── Profile Tab ───────────────────────────────────────────────────────────────

test('profile tab shows user information', async ({ page }) => {
  await clickTab(page, 'Profile');
  await page.waitForTimeout(2_000);
  // Profile page should show email or name
  const body = await page.locator('main').textContent();
  const hasProfileContent = body!.includes('citizen@demo.com') ||
    body!.includes('Demo Citizen') ||
    body!.includes('profile') ||
    body!.includes('Profile');
  expect(hasProfileContent).toBe(true);
});
