import { Page, expect } from '@playwright/test';

/** Password used by seed-demo.ts for all demo accounts */
export const DEMO_PASSWORD = 'Demo@1234';

/**
 * Demo credentials — must match scripts/seed-demo.ts.
 * buttonLabel is the text inside the <span> within the quick-demo button
 * (the button also contains an emoji span before it, so we scope to the
 *  amber demo section and use hasText filtering).
 */
export const DEMO_CREDENTIALS = {
  citizen: {
    email: 'citizen@demo.com',
    password: DEMO_PASSWORD,
    buttonLabel: 'Citizen',
    dashboardMarker: 'Report Issue',
  },
  worker: {
    email: 'worker@demo.com',
    password: DEMO_PASSWORD,
    buttonLabel: 'Worker',
    dashboardMarker: 'My Tasks',
  },
  admin: {
    email: 'admin@demo.com',
    password: DEMO_PASSWORD,
    buttonLabel: 'Admin',
    dashboardMarker: 'Dashboard Overview',
  },
  superadmin: {
    email: 'superadmin@demo.com',
    password: DEMO_PASSWORD,
    buttonLabel: 'Super Admin',
    dashboardMarker: 'System Overview',
  },
  champion: {
    email: 'champion@demo.com',
    password: DEMO_PASSWORD,
    buttonLabel: 'Champion',
    dashboardMarker: 'Green Champion',
  },
  zonalAdmin: {
    email: 'zonaladmin@demo.com',
    password: DEMO_PASSWORD,
    buttonLabel: 'Zonal Admin',
    dashboardMarker: 'Zone Overview',
  },
} as const;

export type DemoRole = keyof typeof DEMO_CREDENTIALS;

/**
 * Navigate to the Login page.
 *
 * Uses addInitScript to set localStorage BEFORE React reads it, avoiding
 * the need for a reload (which hangs due to Firebase Firestore listeners
 * keeping the network indefinitely busy).
 */
export async function goToLogin(page: Page): Promise<void> {
  // addInitScript runs synchronously before any page JS — React will read
  // currentView_safai = 'login' on initial mount and render the login form.
  await page.addInitScript(() => {
    window.localStorage.setItem('currentView_safai', 'login');
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Wait until the email input is visible (login form rendered)
  await page.waitForSelector('input[placeholder="Enter your email"]', {
    state: 'visible',
    timeout: 15_000,
  });
}

/**
 * Full login flow using a quick-demo button.
 *
 * The quick-demo buttons render as:
 *   <button><span>{emoji}</span><span>{role}</span></button>
 * so we scope to the amber demo section (.bg-amber-50) and use
 * .filter({ hasText }) to match by role label text.
 */
export async function loginAs(page: Page, role: DemoRole): Promise<void> {
  await goToLogin(page);

  const creds = DEMO_CREDENTIALS[role];

  // Click the demo button — filter by a span with EXACT label text
  // (prevents "Admin" matching "Super Admin" via substring)
  await page
    .locator('.bg-amber-50')
    .locator('button')
    .filter({ has: page.locator('span', { hasText: new RegExp(`^${creds.buttonLabel}$`) }) })
    .click();

  // Verify credentials were auto-filled in the controlled inputs
  await expect(
    page.locator('input[placeholder="Enter your email"]')
  ).toHaveValue(creds.email, { timeout: 5_000 });

  // Submit login
  await page.getByRole('button', { name: /sign in/i }).first().click();

  // Wait for Firebase to resolve and loading spinners to clear
  await page.waitForFunction(
    () =>
      !document.body.innerText.includes('Loading your dashboard') &&
      !document.body.innerText.includes('Loading your profile'),
    { timeout: 25_000 }
  );

  // Confirm the correct dashboard loaded
  await expect(page.getByText(creds.dashboardMarker).first()).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Log out via the sidebar Logout button + confirmation modal.
 */
export async function logout(page: Page): Promise<void> {
  // The sidebar has one "Logout" button in the footer
  await page.getByRole('button', { name: /logout/i }).first().click();

  // Confirmation modal — click the red "Logout" confirm button
  await expect(page.getByText('Confirm Logout')).toBeVisible({ timeout: 5_000 });
  // The modal's confirm button is the last Logout button on the page
  await page.getByRole('button', { name: /logout/i }).last().click();

  // Should leave the dashboard — wait for dashboard content to disappear
  await page.waitForFunction(
    () =>
      !document.body.innerText.includes('Dashboard Overview') &&
      !document.body.innerText.includes('System Overview') &&
      !document.body.innerText.includes('My Tasks') &&
      !document.body.innerText.includes('Report Issue'),
    { timeout: 15_000 }
  );
}

/**
 * Navigate to a dashboard tab by clicking its sidebar button.
 */
export async function clickTab(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).first().click();
  await page.waitForTimeout(500); // brief wait for tab content to mount
}
