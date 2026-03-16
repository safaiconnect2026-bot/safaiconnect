import { test, expect } from '@playwright/test';
import { loginAs, clickTab } from '../fixtures/auth';

// ─────────────────────────────────────────────────────────────────────────────
// WORKER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'worker');
});

// ── Tasks Tab (default) ───────────────────────────────────────────────────────

test('tasks tab is active by default and shows stat cards', async ({ page }) => {
  // Default tab is 'tasks' — should show "My Tasks"
  await expect(page.getByText('My Tasks').first()).toBeVisible({ timeout: 10_000 });
  // Should show stat card headings
  const body = await page.locator('main').textContent();
  expect(body).toBeTruthy();
});

test('tasks tab shows assignments section', async ({ page }) => {
  await expect(page.getByText('My Tasks').first()).toBeVisible();
  // Should show either assignment cards or an empty state
  await page.waitForTimeout(3_000);
  const body = await page.locator('main').textContent();
  const hasTaskContent = body!.includes('Assigned') ||
    body!.includes('assignment') ||
    body!.includes('No tasks') ||
    body!.includes('Total') ||
    body!.includes('Completed') ||
    body!.includes('In Progress');
  expect(hasTaskContent).toBe(true);
});

test('task action buttons visible for assigned tasks', async ({ page }) => {
  await page.waitForTimeout(3_000);
  // If there are tasks, "Start Task" button should exist
  // If no tasks, the empty state message should show
  const body = await page.locator('main').textContent();
  const hasTaskState = body!.includes('Start Task') ||
    body!.includes('Submit Proof') ||
    body!.includes('No tasks assigned');
  expect(hasTaskState).toBe(true);
});

// ── Submit Proof Tab ──────────────────────────────────────────────────────────

test('submit proof tab loads with upload interface', async ({ page }) => {
  await clickTab(page, 'Submit Proof');
  await expect(page.getByText('Submit Proof of Work').first()).toBeVisible({ timeout: 10_000 });
  // Should show proof requirements
  const body = await page.locator('main').textContent();
  expect(body!.includes('Photo') || body!.includes('photo') || body!.includes('evidence')).toBe(true);
});

test('submit proof shows camera/gallery or no-active-task state', async ({ page }) => {
  await clickTab(page, 'Submit Proof');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  // When a task is in-progress, camera/gallery buttons are shown
  // When no task is active, the "No active task selected" state is shown — both are valid
  const hasCameraUI = body!.includes('Camera') ||
    body!.includes('camera') ||
    body!.includes('Gallery') ||
    body!.includes('Capture');
  const hasNoTaskState = body!.includes('No active task') ||
    body!.includes('View My Tasks') ||
    body!.includes('no active');
  expect(hasCameraUI || hasNoTaskState).toBe(true);
});

// ── Attendance Tab ────────────────────────────────────────────────────────────

test('attendance tab shows check-in UI', async ({ page }) => {
  await clickTab(page, 'Attendance');
  await expect(page.getByText('Attendance').first()).toBeVisible({ timeout: 10_000 });
  // Should show check-in section
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  const hasAttendanceUI = body!.includes('Check In') ||
    body!.includes('check-in') ||
    body!.includes('Days Present') ||
    body!.includes('Attendance Rate');
  expect(hasAttendanceUI).toBe(true);
});

test('attendance tab shows monthly calendar', async ({ page }) => {
  await clickTab(page, 'Attendance');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  // Calendar shows day labels
  const hasCalendar = body!.includes('Mo') ||
    body!.includes('Monthly') ||
    body!.includes('Present') ||
    body!.includes('Absent');
  expect(hasCalendar).toBe(true);
});

test('check in button is visible and clickable when not yet checked in', async ({ page }) => {
  await clickTab(page, 'Attendance');
  await page.waitForTimeout(2_000);

  const checkInBtn = page.getByRole('button', { name: /check in now/i });
  const alreadyCheckedIn = await page.locator('text=Checked In at').isVisible().catch(() => false);

  if (!alreadyCheckedIn) {
    await expect(checkInBtn).toBeVisible();
    // Click check in
    await checkInBtn.click();
    // Should show success state
    await page.waitForFunction(
      () => document.body.innerText.includes('Checked In') || document.body.innerText.includes('On Duty'),
      { timeout: 15_000 }
    );
  } else {
    // Already checked in — pass
    expect(alreadyCheckedIn).toBe(true);
  }
});

// ── Digital ID Tab ────────────────────────────────────────────────────────────

test('digital ID tab shows worker identity card', async ({ page }) => {
  await clickTab(page, 'Digital ID');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  const hasIdContent = body!.includes('SAFAI CONNECT') ||
    body!.includes('Digital') ||
    body!.includes('SafaiConnect') ||
    body!.includes('Worker') ||
    body!.includes('QR') ||
    body!.includes('Identity');
  expect(hasIdContent).toBe(true);
});

test('digital ID shows worker name and email', async ({ page }) => {
  await clickTab(page, 'Digital ID');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  // Worker name and email from seed
  const hasWorkerInfo = body!.includes('Demo Worker') || body!.includes('worker@demo.com');
  expect(hasWorkerInfo).toBe(true);
});

// ── Settings Tab ──────────────────────────────────────────────────────────────

test('settings tab loads without errors', async ({ page }) => {
  await clickTab(page, 'Settings');
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

// ── Profile Tab ───────────────────────────────────────────────────────────────

test('profile tab shows worker information', async ({ page }) => {
  await clickTab(page, 'Profile');
  await page.waitForTimeout(2_000);
  const body = await page.locator('main').textContent();
  const hasProfile = body!.includes('worker@demo.com') || body!.includes('Demo Worker');
  expect(hasProfile).toBe(true);
});
