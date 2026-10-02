import { test, expect } from '@playwright/test';

const WORKSPACE = 'default-workspace';

test('conversations section renders the inbox list shell', async ({ page }) => {
  await page.goto(`/${WORKSPACE}/conversations`);
  await expect(page).toHaveURL(new RegExp(`/${WORKSPACE}/conversations`));
  // Workspace navigation present (exact: header nav + sidebar filter share the name)
  await expect(page.getByRole('link', { name: 'Hội thoại', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bán hàng', exact: true })).toBeVisible();
});

test('orders section lists the seeded demo order', async ({ page }) => {
  await page.goto(`/${WORKSPACE}/orders`);
  await expect(page.getByRole('link', { name: 'Đơn hàng', exact: true })).toBeVisible();
  // The table shows the display id only — assert on the seeded order's product
  await expect(page.getByText('Chuột Không Dây Logitech MX Master 3S').first()).toBeVisible({
    timeout: 15_000,
  });
});

test('products section lists the seeded demo catalog', async ({ page }) => {
  await page.goto(`/${WORKSPACE}/products`);
  await expect(page.getByText('Tai nghe Bluetooth Sony WH-1000XM5 Chống Ồn').first()).toBeVisible({
    timeout: 15_000,
  });
});

test('inventory section lists seeded variants', async ({ page }) => {
  await page.goto(`/${WORKSPACE}/inventory`);
  await expect(page.getByRole('link', { name: 'Tồn kho' })).toBeVisible();
  await expect(page.getByText('Màu Đen (Black)').first()).toBeVisible({ timeout: 15_000 });
});

test('settings section renders', async ({ page }) => {
  await page.goto(`/${WORKSPACE}/settings`);
  await expect(page).toHaveURL(new RegExp(`/${WORKSPACE}/settings`));
  await expect(page.getByRole('link', { name: 'Cài đặt' })).toBeVisible();
});
