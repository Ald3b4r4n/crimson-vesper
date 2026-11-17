import { expect, test } from '@playwright/test';

test('renders Vespera title screen, opens grimoire, and launches Phaser arena', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.locator('.title-main')).toHaveText('VESPERA');

  // Open and close Grimório & Lore modal
  await page.getByTestId('open-lore-btn').click();
  await expect(page.getByTestId('lore-modal')).toBeVisible();
  await page.locator('[data-close-lore]').click();
  await expect(page.getByTestId('lore-modal')).toHaveCount(0);

  // Select Seraphina and launch the Phaser 3 WebGL Arena
  await page.getByTestId('hero-card-seraphina').click();
  await page.getByTestId('start-run-btn').click();

  await expect(page.getByTestId('arena-hud')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#phaser-container canvas')).toBeVisible();

  // Pause and verify pause modal
  await page.getByTestId('pause-btn').click();
  await expect(page.getByTestId('pause-modal')).toBeVisible();
});
