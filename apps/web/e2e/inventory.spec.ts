import { test, expect } from '@playwright/test';

const WORKSPACE = 'default-workspace';

test('adjusts stock of a seeded variant through the adjustment dialog', async ({ page }) => {
  await page.goto(`/${WORKSPACE}/inventory`);

  // Pick the seeded variant row and open its adjustment dialog
  const row = page.getByText('Màu Đen (Black)').first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Chỉnh kho' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: /Điều Chỉnh Tồn Kho/i })).toBeVisible();

  // Stock-in flow: business type, quantity, reason — submit
  await dialog.getByRole('button', { name: 'Nhập hàng' }).click();
  await dialog.locator('#adj-qty').fill('5');
  await dialog.getByPlaceholder('Ghi rõ lý do nhập/xuất kho...').fill('PW-E2E nhập hàng kiểm thử');

  await dialog.getByRole('button', { name: 'Xác nhận điều chỉnh' }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
});
