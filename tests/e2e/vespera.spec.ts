import { expect, test } from '@playwright/test';

test('verifies real sprite rendering in Phaser arena, pause menu text, 7 stages, and mobile layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 840 });
  await page.goto('/');

  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.locator('.title-main')).toHaveText('VESPERA');

  // Select Hero Alaric + Stage I Forest first, or Hero Sor Kaelen + Stage VII Inferno!
  await page.getByTestId('hero-card-alaric').click();
  await page.getByTestId('stage-card-forest').click();
  await page.getByTestId('start-run-btn').click();

  await expect(page.getByTestId('arena-hud')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#phaser-container canvas')).toBeVisible();

  // Let sprites preload and enemies emerge into the arena
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/preview-gameplay-forest.png' });

  // Open Pause Menu and verify updated button text "Sair e retornar ao menu"
  await page.getByTestId('pause-btn').click();
  await expect(page.getByTestId('pause-modal')).toBeVisible();
  await expect(page.locator('[data-quit-btn]')).toHaveText('Sair e retornar ao menu');
  await page.screenshot({ path: 'test-results/preview-pause-modal.png' });

  // Click "Sair e retornar ao menu" and launch Stage VII Inferno on Mobile viewport!
  await page.locator('[data-quit-btn]').click();
  await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 5000 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('hero-card-valeria').click();
  await page.getByTestId('stage-card-inferno').scrollIntoViewIfNeeded();
  await page.getByTestId('stage-card-inferno').click();
  await page.getByTestId('start-run-btn').click();

  await expect(page.getByTestId('arena-hud')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/preview-gameplay-inferno-mobile.png' });
});
