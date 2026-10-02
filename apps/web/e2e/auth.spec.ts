import { test, expect } from '@playwright/test';

const WORKSPACE = 'default-workspace';

// Auth specs exercise the login form itself — bypass the shared session state.
test.use({ storageState: { cookies: [], origins: [] } });

test('redirects unauthenticated visitors from the app root to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Chào mừng bạn quay lại' })).toBeVisible();
});

test('logs in with the seeded admin demo account and lands on the dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email công việc').fill('admin@example.com');
  await page.getByLabel('Mật khẩu').fill('SalesCopilot@2026!');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/${WORKSPACE}/(dashboard|conversations)`), {
    timeout: 20_000,
  });
  // Workspace shell rendered: top navigation present
  await expect(page.getByRole('link', { name: 'Bán hàng', exact: true })).toBeVisible();
});

test('shows an error message for wrong credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email công việc').fill('admin@example.com');
  await page.getByLabel('Mật khẩu').fill('definitely-wrong-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

  await expect(page.locator('[role="alert"], .text-destructive')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/login/);
});
