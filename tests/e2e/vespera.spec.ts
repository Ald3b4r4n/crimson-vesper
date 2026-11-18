import { expect, test } from '@playwright/test';

test('verifies reworked game menu, 27 custom power icons, 40-min arena HUD, and mobile fullscreen landscape', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 840 });
  await page.goto('/');

  // 1. Reworked Game Splash Menu
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.locator('.title-main')).toHaveText('VESPERA');
  await expect(page.getByTestId('menu-play-btn')).toBeVisible();
  await expect(page.getByTestId('tab-powers')).toBeVisible();
  await expect(page.getByTestId('fullscreen-btn')).toBeVisible();
  await page.screenshot({ path: 'test-results/preview-splash-menu.png' });

  // 2. Redesigned Power Grid & Synergy Matrix (27 custom .webp icons)
  await page.getByTestId('tab-powers').click();
  await expect(page.locator('.synergy-row')).toHaveCount(9);
  await expect(page.locator('.synergy-matrix .power-icon-img')).toHaveCount(27);

  // Ensure all 27 illustrated .webp icons loaded cleanly
  const loadedCount = await page
    .locator('.synergy-matrix .power-icon-img')
    .evaluateAll((imgs) =>
      imgs.filter((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0).length
    );
  expect(loadedCount).toBe(27);
  await page.screenshot({ path: 'test-results/preview-power-grid.png' });

  // Return to Splash, then enter Hero Select -> Stage Select -> Start 40-Min Run
  await page.getByRole('button', { name: '← Menu' }).click();
  await page.getByTestId('menu-play-btn').click();

  await expect(page.getByTestId('hero-card-alaric')).toBeVisible();
  await page.getByTestId('hero-card-alaric').click();
  await page.screenshot({ path: 'test-results/preview-hero-select.png' });

  await page.getByTestId('go-stage-select-btn').click();
  await expect(page.getByTestId('stage-card-forest')).toBeVisible();
  await page.getByTestId('stage-card-forest').click();
  await expect(page.locator('.showcase-footer')).toContainText('40:00');
  await page.screenshot({ path: 'test-results/preview-stage-select.png' });

  await page.getByTestId('start-run-btn').click();

  // 3. Arena HUD, 40:00 Match Clock, Illustrated HUD Power Rack & Pause Modal
  await expect(page.getByTestId('arena-hud')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#phaser-container canvas')).toBeVisible();
  await expect(page.locator('[data-clock-time]')).toContainText('/ 40:00');

  await page.waitForTimeout(600);
  const hudIconLoaded = await page
    .locator('.slots-panel .slot-icon-img')
    .first()
    .evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0);
  expect(hudIconLoaded).toBe(true);

  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(750);
  await page.screenshot({ path: 'test-results/preview-gameplay-forest.png' });
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyW');

  await page.getByTestId('pause-btn').click();
  await expect(page.getByTestId('pause-modal')).toBeVisible();
  await expect(page.locator('[data-quit-btn]')).toHaveText('Sair e retornar ao menu');
  await page.locator('[data-quit-btn]').click();
  await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 5000 });

  // 4. Mobile Portrait (390x844) -> Fullscreen Landscape ("visão de tela deitada")
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('fullscreen-btn').click();
  await expect(page.locator('#game-root')).toHaveClass(/forced-landscape/);
  await page.screenshot({ path: 'test-results/preview-mobile-landscape-menu.png' });

  await page.getByTestId('menu-play-btn').click();
  await page.getByTestId('hero-card-valeria').click();
  await page.getByTestId('go-stage-select-btn').click();
  await page.getByTestId('stage-card-inferno').scrollIntoViewIfNeeded();
  await page.getByTestId('stage-card-inferno').click();
  await page.getByTestId('start-run-btn').click();

  await expect(page.getByTestId('arena-hud')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/preview-gameplay-inferno-mobile.png' });
});
