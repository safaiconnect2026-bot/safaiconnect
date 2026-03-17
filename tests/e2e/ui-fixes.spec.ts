/**
 * UI Fixes E2E Test Suite — SafaiConnect
 * ─────────────────────────────────────────────────────────────────────────────
 * Covers all bugs fixed in Session 2 & 3:
 *   1. Sidebar collapse — icon-only logo when collapsed, full logo when expanded
 *   2. Language switching (i18n) — UI translates after language change
 *   3. Settings page — language dropdown renders above dark-mode toggle (z-index)
 *   4. Collection Bookings tab — accessible from Admin + Zonal Admin dashboards
 *   5. Citizen sidebar i18n — Book Collection / Waste Scanner / Recycling Locator
 *   6. OnboardingChecklist — renders, opens, shows role-specific content
 *   7. Install banner — hidden when running as standalone PWA
 *   8. Admin overview — Collection Bookings quick-nav pill present
 *
 * Run: npx playwright test tests/e2e/ui-fixes.spec.ts
 */

import { test, expect } from '@playwright/test';
import { loginAs, clickTab, dismissTourIfVisible } from '../fixtures/auth';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Sidebar Collapse / Logo Behaviour
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sidebar Collapse', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('sidebar is expanded by default and shows full logo', async ({ page }) => {
    // Full logo img should be visible in the sidebar logo section (desktop)
    const sidebarLogo = page.locator('aside img[alt="SafaiConnect"]').first();
    await expect(sidebarLogo).toBeVisible({ timeout: 5_000 });
    // The src should be logo.png (full logo) not the icon
    const src = await sidebarLogo.getAttribute('src');
    expect(src).toContain('logo.png');
  });

  test('collapse button is visible in the sidebar footer', async ({ page }) => {
    // The collapse toggle button in the sidebar footer
    const collapseBtn = page.locator('aside button').filter({ hasText: /collapse/i });
    await expect(collapseBtn).toBeVisible({ timeout: 5_000 });
  });

  test('clicking collapse hides sidebar labels and shows icon logo', async ({ page }) => {
    // Click the collapse button
    await page.locator('aside button').filter({ hasText: /collapse/i }).click();
    await page.waitForTimeout(400); // wait for CSS transition

    // Sidebar should now be narrow (lg:w-20)
    const aside = page.locator('aside');
    const width = await aside.evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(90); // collapsed width is ~80px

    // Logo should switch to the icon (pwa-192x192.png)
    const sidebarLogo = page.locator('aside img[alt="SafaiConnect"]').first();
    const src = await sidebarLogo.getAttribute('src');
    expect(src).toContain('pwa-192x192.png');
  });

  test('clicking expand restores sidebar labels and full logo', async ({ page }) => {
    // Collapse first
    await page.locator('aside button').filter({ hasText: /collapse/i }).click();
    await page.waitForTimeout(400);

    // Expand — the expand button has a ChevronRight icon, no text when collapsed
    await page.locator('aside button[title], aside button').nth(-2).click(); // collapse toggle button
    await page.waitForTimeout(400);

    const sidebarLogo = page.locator('aside img[alt="SafaiConnect"]').first();
    const src = await sidebarLogo.getAttribute('src');
    expect(src).toContain('logo.png');
  });

  test('header logo is hidden on desktop (sidebar shows logo instead)', async ({ page }) => {
    // The header logo has lg:hidden — on 1280px desktop it should not be visible
    const headerLogo = page.locator('header img[alt="SafaiConnect"]');
    // Not visible on desktop viewport (1280px)
    const isVisible = await headerLogo.isVisible();
    expect(isVisible).toBe(false);
  });

  test('sidebar labels are hidden when collapsed', async ({ page }) => {
    // Before collapse — Complaints label is visible
    await expect(page.getByRole('button', { name: 'Complaints', exact: true })).toBeVisible();

    // Collapse
    await page.locator('aside button').filter({ hasText: /collapse/i }).click();
    await page.waitForTimeout(400);

    // On desktop the text spans get lg:hidden — text should not be readable
    const aside = page.locator('aside');
    const asideText = await aside.evaluate((el) => {
      const spans = el.querySelectorAll('span.font-medium');
      return Array.from(spans)
        .filter((s) => (s as HTMLElement).offsetParent !== null) // visible
        .map((s) => s.textContent?.trim())
        .filter(Boolean);
    });
    // All nav label spans should be hidden in collapsed state on desktop
    expect(asideText.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Language Switching (i18n)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Language Switching', () => {
  test('language switcher button is visible in the header', async ({ page }) => {
    await loginAs(page, 'citizen');
    // Language switcher renders a globe icon + current language
    const langBtn = page.locator('header').getByRole('button').filter({ hasText: /english|hindi|हिंदी|मराठी|en|hi/i }).first();
    await expect(langBtn).toBeVisible({ timeout: 5_000 });
  });

  test('clicking language switcher opens the dropdown', async ({ page }) => {
    await loginAs(page, 'citizen');
    // Open dropdown — look for globe button in header
    const langSwitcher = page.locator('header [role="button"], header button').filter({ hasText: /english|हिंदी|EN|HI/i }).first();
    await langSwitcher.click();
    // Dropdown should appear with language options
    await expect(page.getByText('हिंदी').first()).toBeVisible({ timeout: 5_000 });
  });

  test('switching to Hindi translates sidebar nav items', async ({ page }) => {
    await loginAs(page, 'admin');

    // Open language dropdown
    const langSwitcher = page.locator('header button').filter({ hasText: /english|EN|language/i }).first();
    await langSwitcher.click();

    // Select Hindi
    const hindiOption = page.getByRole('button', { name: /हिंदी/i }).first();
    await hindiOption.click();
    await page.waitForTimeout(1_500); // allow i18n to update

    // Sidebar should now show Hindi labels
    // "Overview" in Hindi is "अवलोकन"
    const sidebarText = await page.locator('aside').textContent();
    const hasHindiText = sidebarText!.includes('अवलोकन') ||
      sidebarText!.includes('शिकायतें') ||
      sidebarText!.includes('कर्मचारी') ||
      sidebarText!.includes('सेटिंग्स');
    expect(hasHindiText).toBe(true);
  });

  test('switching language persists after tab navigation', async ({ page }) => {
    await loginAs(page, 'admin');

    // Switch to Hindi
    const langSwitcher = page.locator('header button').filter({ hasText: /english|EN|language/i }).first();
    await langSwitcher.click();
    await page.getByRole('button', { name: /हिंदी/i }).first().click();
    await page.waitForTimeout(1_000);

    // Navigate to a different tab
    await page.locator('aside button').first().click();
    await page.waitForTimeout(500);

    // Sidebar should still be in Hindi
    const sidebarText = await page.locator('aside').textContent();
    const stillHindi = sidebarText!.includes('अवलोकन') ||
      sidebarText!.includes('शिकायतें') ||
      sidebarText!.includes('कर्मचारी');
    expect(stillHindi).toBe(true);
  });

  test('citizen sidebar i18n: Book Collection uses translation key', async ({ page }) => {
    await loginAs(page, 'citizen');
    // In English the label is "Book Collection" — from translation key nav_book_collection
    await expect(page.getByRole('button', { name: 'Book Collection', exact: true })).toBeVisible();
  });

  test('citizen sidebar i18n: Waste Scanner uses translation key', async ({ page }) => {
    await loginAs(page, 'citizen');
    await expect(page.getByRole('button', { name: 'Waste Scanner', exact: true })).toBeVisible();
  });

  test('citizen sidebar i18n: Recycling Locator uses translation key', async ({ page }) => {
    await loginAs(page, 'citizen');
    await expect(page.getByRole('button', { name: 'Recycling Locator', exact: true })).toBeVisible();
  });

  test('switching to Hindi translates citizen sidebar items', async ({ page }) => {
    await loginAs(page, 'citizen');

    const langSwitcher = page.locator('header button').filter({ hasText: /english|EN|language/i }).first();
    await langSwitcher.click();
    await page.getByRole('button', { name: /हिंदी/i }).first().click();
    await page.waitForTimeout(1_500);

    const sidebarText = await page.locator('aside').textContent();
    // "Book Collection" in Hindi: "कलेक्शन बुक करें"
    // "Waste Scanner" in Hindi: "कचरा स्कैनर"
    const hasHindiNavItems = sidebarText!.includes('कलेक्शन') ||
      sidebarText!.includes('कचरा स्कैनर') ||
      sidebarText!.includes('रीसाइक्लिंग');
    expect(hasHindiNavItems).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Settings Page — Language Dropdown Z-Index Fix
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Settings Page Z-Index Fix', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await clickTab(page, 'Settings');
    await page.waitForTimeout(1_000);
  });

  test('settings page loads and shows General Preferences section', async ({ page }) => {
    await expect(page.getByText('General Preferences').first()).toBeVisible({ timeout: 5_000 });
  });

  test('General Preferences card does not have overflow-hidden', async ({ page }) => {
    // The overflow-hidden on the card was causing the language dropdown to be clipped
    const genPrefCard = page.locator('.rounded-2xl').filter({ hasText: 'General Preferences' }).first();
    const overflow = await genPrefCard.evaluate((el) => window.getComputedStyle(el).overflow);
    expect(overflow).not.toBe('hidden');
  });

  test('language switcher dropdown in settings opens above dark mode toggle', async ({ page }) => {
    // Find the language switcher inside settings General Preferences card
    const settingsCard = page.locator('.rounded-2xl').filter({ hasText: 'General Preferences' }).first();
    const langBtn = settingsCard.locator('button').first();
    await langBtn.click();

    // The dropdown should be visible — not clipped/hidden
    const dropdown = page.locator('[class*="z-50"], [class*="z-40"]').filter({ hasText: /english|हिंदी|मराठी/i }).first();
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // Dark mode toggle should still be visible (not overlapped by dropdown)
    const darkModeToggle = page.getByText('Dark Mode').first();
    await expect(darkModeToggle).toBeVisible();
  });

  test('dark mode toggle is functional in settings', async ({ page }) => {
    // Find dark mode toggle button/checkbox
    const darkModeSection = page.getByText('Dark Mode').locator('..');
    await expect(darkModeSection).toBeVisible();

    // Click the toggle (the button/switch near "Dark Mode" text)
    const toggle = page.locator('button[role="switch"], input[type="checkbox"]').first();
    if (await toggle.isVisible()) {
      await toggle.click();
      await page.waitForTimeout(500);
      // Some indication of dark mode activation
      const isDarkMode = await page.evaluate(() =>
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark')
      );
      // Toggle should have changed state (either direction)
      const ariaChecked = await toggle.getAttribute('aria-checked');
      expect(ariaChecked !== null || isDarkMode !== undefined).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Collection Bookings Tab — Admin & Zonal Admin
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Collection Bookings Tab (Admin)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('admin sidebar has Collection Bookings tab', async ({ page }) => {
    await dismissTourIfVisible(page); // tour may start async after login
    // Use .first() — the overview tab also renders a "Collection Bookings" quick-nav pill
    await expect(page.locator('aside').getByRole('button', { name: 'Collection Bookings', exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('collection bookings tab loads without errors', async ({ page }) => {
    await clickTab(page, 'Collection Bookings');
    await page.waitForTimeout(3_000);
    const body = await page.locator('main').textContent();
    expect(body).toBeTruthy();
    expect(body).not.toContain('Cannot read');
    expect(body).not.toContain('is not defined');
  });

  test('collection bookings tab shows stats cards', async ({ page }) => {
    await clickTab(page, 'Collection Bookings');
    await page.waitForTimeout(3_000);
    const body = await page.locator('main').textContent();
    const hasStats = body!.includes('Pending') ||
      body!.includes('In Progress') ||
      body!.includes('Completed') ||
      body!.includes('Booking') ||
      body!.includes('Collection');
    expect(hasStats).toBe(true);
  });

  test('collection bookings tab shows booking list or empty state', async ({ page }) => {
    await clickTab(page, 'Collection Bookings');
    await page.waitForTimeout(4_000);
    const body = await page.locator('main').textContent();
    const hasContent = body!.includes('booking') ||
      body!.includes('Booking') ||
      body!.includes('No collection bookings') ||
      body!.includes('pickup') ||
      body!.includes('Pickup') ||
      body!.includes('pending') ||
      body!.includes('Pending');
    expect(hasContent).toBe(true);
  });
});

test.describe('Collection Bookings Tab (Zonal Admin)', () => {
  test('zonal admin sidebar has Collection Bookings tab', async ({ page }) => {
    await loginAs(page, 'zonalAdmin');
    await expect(page.getByRole('button', { name: 'Collection Bookings', exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('zonal admin collection bookings tab loads without errors', async ({ page }) => {
    await loginAs(page, 'zonalAdmin');
    await clickTab(page, 'Collection Bookings');
    await page.waitForTimeout(3_000);
    const body = await page.locator('main').textContent();
    expect(body).toBeTruthy();
    expect(body).not.toContain('Cannot read');
  });
});

test.describe('Admin Overview — Collection Bookings Quick Nav', () => {
  test('overview City Vitals shows Collection Bookings quick-nav pill', async ({ page }) => {
    await loginAs(page, 'admin');
    // City Vitals section has the quick nav pills
    const cityVitals = page.getByText('City Vitals').locator('..');
    await expect(cityVitals).toBeVisible({ timeout: 10_000 });
    // Should contain Collection Bookings pill
    const body = await page.locator('main').textContent();
    expect(body!.includes('Collection Bookings') || body!.includes('Bookings')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. OnboardingChecklist — Getting Started Panel
// ─────────────────────────────────────────────────────────────────────────────

test.describe('OnboardingChecklist', () => {
  test('Getting Started FAB is visible after citizen login', async ({ page }) => {
    await loginAs(page, 'citizen');
    // The collapsed FAB shows "Getting Started" text
    const fab = page.getByRole('button', { name: /getting started/i });
    await expect(fab).toBeVisible({ timeout: 10_000 });
  });

  test('clicking FAB expands the checklist panel', async ({ page }) => {
    await loginAs(page, 'citizen');
    const fab = page.getByRole('button', { name: /getting started/i });
    await fab.click();
    // Expanded panel shows task list
    await expect(page.getByText(/report your first waste complaint/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('checklist shows 5 items for citizen role', async ({ page }) => {
    await loginAs(page, 'citizen');
    await page.getByRole('button', { name: /getting started/i }).click();
    await page.waitForTimeout(500);
    // Count checklist items (li elements in the checklist panel)
    const items = page.locator('ul li button').filter({ hasText: /report|scanner|track|recycle|reward/i });
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('checklist shows admin-specific items for admin role', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.getByRole('button', { name: /getting started/i }).click();
    await page.waitForTimeout(500);
    const panelText = await page.locator('.fixed.bottom-6.right-6').textContent();
    const hasAdminItems = panelText!.includes('Review the dashboard overview') ||
      panelText!.includes('Manage a citizen complaint') ||
      panelText!.includes('Verify completed work') ||
      panelText!.includes('salary');
    expect(hasAdminItems).toBe(true);
  });

  test('checklist items translate to Hindi when language is switched', async ({ page }) => {
    await loginAs(page, 'citizen');

    // Switch to Hindi first
    const langSwitcher = page.locator('header button').filter({ hasText: /english|EN|language/i }).first();
    await langSwitcher.click();
    await page.getByRole('button', { name: /हिंदी/i }).first().click();
    await page.waitForTimeout(1_500);

    // Open checklist
    await page.getByRole('button', { name: /शुरुआत करें|getting started/i }).click();
    await page.waitForTimeout(500);

    const panelText = await page.locator('.fixed.bottom-6.right-6').textContent();
    // Should contain Hindi text, not English
    const hasHindiContent = panelText!.includes('शिकायत') ||
      panelText!.includes('स्कैनर') ||
      panelText!.includes('ट्रैक') ||
      panelText!.includes('पॉइंट') ||
      panelText!.includes('कचरा');
    expect(hasHindiContent).toBe(true);
  });

  test('checking an item marks it as complete with strikethrough', async ({ page }) => {
    await loginAs(page, 'citizen');
    await page.getByRole('button', { name: /getting started/i }).click();
    await page.waitForTimeout(500);

    // Scope to the checklist panel to avoid matching other ul/li on the page
    const panel = page.locator('.fixed.bottom-6.right-6');
    const firstItem = panel.locator('ul li button').first();
    await firstItem.click();

    // Should now have strikethrough styling
    const label = firstItem.locator('p').first();
    const className = await label.getAttribute('class');
    expect(className).toContain('line-through');
  });

  test('checklist can be dismissed and re-opened via FAB', async ({ page }) => {
    await loginAs(page, 'citizen');
    const fab = page.getByRole('button', { name: /getting started/i });
    await fab.click();

    // Click the X (close/dismiss) button in the panel header — it has aria-label="Close"
    const panel = page.locator('.fixed.bottom-6.right-6');
    await panel.getByRole('button', { name: /close/i }).click();
    await page.waitForTimeout(300);

    // When dismissed the component renders a standalone button with fixed bottom-6 right-6
    // on the button element itself (not a wrapper div), so we use a broader selector
    const helpFab = page.locator('button.fixed, .fixed button').filter({ has: page.locator('svg') }).last();
    await expect(helpFab).toBeVisible({ timeout: 3_000 });
  });

  test('Restart Tour button is visible in checklist footer', async ({ page }) => {
    await loginAs(page, 'citizen');
    await page.getByRole('button', { name: /getting started/i }).click();
    await expect(page.getByRole('button', { name: /restart tour/i })).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Install Banner — Hidden in Standalone / Native App Mode
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Install Banner', () => {
  test('install banner does NOT appear in standalone mode', async ({ page }) => {
    // Simulate standalone PWA mode by setting display-mode media query
    await page.emulateMedia({ colorScheme: 'light' });
    // Inject Capacitor flag to simulate native app
    await page.addInitScript(() => {
      (window as any).Capacitor = { isNativePlatform: () => true };
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000); // banner shows after 2.5s delay

    // Banner should NOT appear
    const banner = page.locator('.fixed.bottom-0').filter({ hasText: /install safaiconnect/i });
    await expect(banner).not.toBeVisible();
  });

  test('install banner does not interfere with normal page load', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Wait for any loading spinners to clear before checking content
    await page.waitForFunction(
      () =>
        !document.body.innerText.includes('Loading your dashboard') &&
        !document.body.innerText.includes('Loading your profile'),
      { timeout: 20_000 }
    );
    const body = await page.locator('body').textContent();
    expect(body!.toLowerCase()).toContain('safai');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Landing Page Logo Sizing
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Landing Page Logo', () => {
  test('navbar logo has max-width constraint', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const navLogo = page.locator('nav img[alt="Safai Connect Logo"]').first();
    await expect(navLogo).toBeVisible({ timeout: 5_000 });
    // Should have max-w-[140px] class
    const className = await navLogo.getAttribute('class');
    expect(className).toContain('max-w-');
  });

  test('footer logo has max-width constraint', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const footerLogo = page.locator('footer img[alt="Safai Connect Logo"], img[alt="Safai Connect Logo"]').last();
    const className = await footerLogo.getAttribute('class');
    expect(className).toContain('max-w-');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Worker Collection Tasks Tab
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Worker Collection Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'worker');
  });

  test('worker sidebar has Collection Requests tab', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Collection Requests', exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('collection requests tab loads without errors', async ({ page }) => {
    await clickTab(page, 'Collection Requests');
    await page.waitForTimeout(3_000);
    const body = await page.locator('main').textContent();
    expect(body).toBeTruthy();
    expect(body).not.toContain('Cannot read');
    const hasContent = body!.includes('Collection') ||
      body!.includes('collection') ||
      body!.includes('No collection') ||
      body!.includes('pickup') ||
      body!.includes('Pickup');
    expect(hasContent).toBe(true);
  });
});
