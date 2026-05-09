import { test, expect } from '@playwright/test';

test.describe('Chrome smoke: login → dashboard (no bounce to /login)', () => {
  test('admin can sign in and remains on dashboard', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/login');

    await page.locator('#login-user').fill('admin');
    await page.locator('#login-pass').fill('Admin@123');

    await page.getByRole('button', { name: /sign in to dashboard/i }).click();

    await expect(page).toHaveURL(/\/dashboard(?:\/|$)/, { timeout: 45_000 });

    await page.waitForTimeout(3500);
    await expect(page).not.toHaveURL(/\/login/);

    const token = await page.evaluate(() => localStorage.getItem('billing.accessToken'));
    expect(token, 'access token should be persisted after login').toBeTruthy();
    expect(token!.length).toBeGreaterThan(20);

    await expect(page.getByRole('heading', { name: /billing dashboard/i })).toBeVisible({ timeout: 15_000 });
  });

  test('unauthenticated /dashboard redirects to login', async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      localStorage.removeItem('billing.accessToken');
      localStorage.removeItem('billing.refreshToken');
      localStorage.removeItem('billing.tenantId');
      localStorage.removeItem('billing.organizationId');
    });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
