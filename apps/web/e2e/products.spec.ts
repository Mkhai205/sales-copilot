import { test, expect } from '@playwright/test';

const WORKSPACE = 'default-workspace';

test('creates a product through the product dialog and lists it', async ({ page }) => {
  const productName = `PW-E2E Bút bi Xiaoji ${Date.now()}`;
  const sku = `PWE2E-${Date.now().toString(36).toUpperCase()}`;

  await page.goto(`/${WORKSPACE}/products`);
  await page.getByRole('button', { name: 'Thêm sản phẩm' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Tạo Sản Phẩm Mới' })).toBeVisible();

  await dialog.locator('#prod-name').fill(productName);
  await dialog.locator('#prod-sku').fill(sku);
  await dialog.locator('#prod-base-price').fill('12000');

  await dialog.getByRole('button', { name: 'Tạo sản phẩm' }).click();

  // Dialog closes and the new product shows up in the catalog table
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText(productName).first()).toBeVisible({ timeout: 15_000 });
});
