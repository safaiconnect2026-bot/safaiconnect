import { test, expect } from '@playwright/test';
import { loginAs, goToLogin, logout, DEMO_CREDENTIALS, DemoRole } from '../fixtures/auth';

// ─────────────────────────────────────────────────────────────────────────────
// AUTH — Login, Role Routing, and Logout
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login Page', () => {
  test('shows login form with email + password fields', async ({ page }) => {
    await goToLogin(page);
    await expect(page.locator('input[placeholder="Enter your email"]')).toBeVisible();
    await expect(page.locator('input[placeholder="••••••••"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('shows quick-demo buttons for all 5 roles', async ({ page }) => {
    await goToLogin(page);
    const roles = ['Citizen', 'Worker', 'Admin', 'Super Admin', 'Champion'];
    for (const role of roles) {
      // Match by exact span text to avoid "Admin" matching "Super Admin"
      await expect(
        page.locator('.bg-amber-50').locator('button').filter({
          has: page.locator('span', { hasText: new RegExp(`^${role}$`) }),
        })
      ).toBeVisible();
    }
  });

  test('shows error message on wrong password', async ({ page }) => {
    await goToLogin(page);
    await page.locator('input[placeholder="Enter your email"]').fill('citizen@demo.com');
    await page.locator('input[placeholder="••••••••"]').fill('WrongPassword123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    // Firebase Auth error should appear in the red error box
    await expect(page.locator('.bg-red-50, [class*="bg-red"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('quick-demo button auto-fills citizen credentials', async ({ page }) => {
    await goToLogin(page);
    await page.locator('.bg-amber-50').locator('button').filter({ hasText: 'Citizen' }).click();
    await expect(page.locator('input[placeholder="Enter your email"]')).toHaveValue('citizen@demo.com');
    await expect(page.locator('input[placeholder="••••••••"]')).toHaveValue('Demo@1234');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Role Routing — each role must land on the correct dashboard
// ─────────────────────────────────────────────────────────────────────────────

const roleRoutingCases: Array<{ role: DemoRole; marker: string; description: string }> = [
  {
    role: 'citizen',
    marker: 'Report Issue',
    description: 'Citizen → CitizenDashboard with Report Issue sidebar item',
  },
  {
    role: 'worker',
    marker: 'My Tasks',
    description: 'Worker → WorkerDashboard with My Tasks sidebar item',
  },
  {
    role: 'admin',
    marker: 'Dashboard Overview',
    description: 'Admin → AdminDashboard with Dashboard Overview heading',
  },
  {
    role: 'superadmin',
    marker: 'System Overview',
    description: 'Superadmin → SuperadminDashboard with System Overview heading',
  },
  {
    role: 'champion',
    marker: 'Green Champion',
    description: 'GreenChampion → GreenChampionDashboard with green banner',
  },
];

for (const { role, marker, description } of roleRoutingCases) {
  test(`role routing: ${description}`, async ({ page }) => {
    await loginAs(page, role);
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 15_000 });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-role isolation — citizen must NOT see admin/worker dashboard elements
// ─────────────────────────────────────────────────────────────────────────────

test('citizen does not see admin-only sidebar items', async ({ page }) => {
  await loginAs(page, 'citizen');
  // Workers tab is only in Admin/Superadmin dashboards
  await expect(page.getByRole('button', { name: 'Workers', exact: true })).not.toBeVisible();
  // Work Verification only in Admin
  await expect(page.getByRole('button', { name: 'Work Verification', exact: true })).not.toBeVisible();
});

test('worker does not see superadmin sidebar items', async ({ page }) => {
  await loginAs(page, 'worker');
  await expect(page.getByRole('button', { name: 'Admin Management', exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Inventory Management', exact: true })).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────

test('logout shows confirmation modal and returns to root', async ({ page }) => {
  await loginAs(page, 'citizen');

  // Click sidebar Logout button
  await page.getByRole('button', { name: 'Logout' }).first().click();

  // Modal should appear
  await expect(page.getByText('Confirm Logout')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Are you sure you want to log out')).toBeVisible();

  // Confirm logout
  await page.getByRole('button', { name: 'Logout' }).last().click();

  // Should leave the dashboard
  await page.waitForFunction(
    () => !document.body.innerText.includes('Report Issue'),
    { timeout: 15_000 }
  );
});

test('cancel button dismisses logout modal without logging out', async ({ page }) => {
  await loginAs(page, 'citizen');
  await page.getByRole('button', { name: 'Logout' }).first().click();
  await expect(page.getByText('Confirm Logout')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  // Modal should close; user should still be on the dashboard
  await expect(page.getByText('Confirm Logout')).not.toBeVisible();
  await expect(page.getByText('Report Issue')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// Session persistence — after reload, stays logged in
// ─────────────────────────────────────────────────────────────────────────────

test('session persists across page reload', async ({ page }) => {
  await loginAs(page, 'citizen');
  await page.reload();
  // Wait for Firebase to restore session
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading your dashboard') &&
          !document.body.innerText.includes('Loading your profile'),
    { timeout: 20_000 }
  );
  await expect(page.getByText('Report Issue').first()).toBeVisible({ timeout: 15_000 });
});
