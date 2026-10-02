import { test, expect } from '@playwright/test';

const WORKSPACE = 'default-workspace';

test('conversations list renders and a conversation can be opened', async ({ page }) => {
  // assignment=all so the list is not limited to the admin's own conversations
  await page.goto(`/${WORKSPACE}/conversations?assignment=all`);

  // The inbox list shell is present (exact: sidebar filter links share the name)
  await expect(page.getByRole('link', { name: 'Hội thoại', exact: true })).toBeVisible();

  // Conversation cards are Next Links into the thread; open the first one
  // (the workspace is seeded with demo conversations)
  const firstCard = page.locator('a[href*="/conversations/"]').first();
  await expect(firstCard).toBeVisible({ timeout: 15_000 });
  await firstCard.click();

  await expect(page).toHaveURL(new RegExp(`/${WORKSPACE}/conversations/[0-9a-f-]{36}`), {
    timeout: 15_000,
  });
});
