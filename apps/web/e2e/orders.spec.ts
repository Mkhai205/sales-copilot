import { test, expect } from '@playwright/test';

const WORKSPACE = 'default-workspace';

test('opens the orders list and shows the seeded order', async ({ page }) => {
  await page.goto(`/${WORKSPACE}/orders`);

  await expect(page.getByRole('link', { name: 'Đơn hàng', exact: true })).toBeVisible();

  // The table renders the display id only — assert on the seeded product line
  const seededOrderRow = page.getByText('Chuột Không Dây Logitech MX Master 3S').first();
  await expect(seededOrderRow).toBeVisible({ timeout: 15_000 });
});
