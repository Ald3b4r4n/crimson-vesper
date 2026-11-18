import { expect, test } from '@playwright/test';

test('desktop & mobile hub: verifies illustrated portraits, 7 stages, powers codex, lore, and arena launch', async ({
  page,
}) => {
  // Test on Mobile Portrait viewport (iPhone 14 size: 390x844) to validate mobile responsiveness!
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.locator('.title-main')).toHaveText('VESPERA');
  await page.screenshot({ path: 'test-results/preview-mobile-intro.png' });

  // Also check Desktop wide view briefly
  await page.setViewportSize({ width: 1366, height: 840 });
  await page.screenshot({ path: 'test-results/preview-desktop-intro.png' });
  await page.setViewportSize({ width: 390, height: 844 });

  // Verify hero portraits load cleanly (naturalWidth > 0)
  const firstPortraitLoaded = await page
    .locator('[data-testid="hero-card-alaric"] img')
    .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  expect(firstPortraitLoaded).toBe(true);

  // Verify all 7 stage cards exist
  for (const stageId of [
    'forest',
    'castle',
    'dungeon',
    'volcano_desert',
    'metropolis',
    'temple',
    'inferno',
  ]) {
    await expect(page.getByTestId(`stage-card-${stageId}`)).toBeAttached();
  }

  // Navigate to Powers Codex tab and Lore tab
  await page.getByTestId('tab-powers').click();
  await expect(page.locator('.codex-card').first()).toBeVisible();

  await page.getByTestId('tab-lore').click();
  await expect(page.locator('.codex-card').first()).toBeVisible();

  // Return to Play tab, select Hero Irmã Valéria + Stage VII Inferno, and start!
  await page.getByTestId('tab-play').click();
  await page.getByTestId('hero-card-valeria').click();
  await page.getByTestId('stage-card-inferno').scrollIntoViewIfNeeded();
  await page.getByTestId('stage-card-inferno').click();
  await page.getByTestId('start-run-btn').click();

  await expect(page.getByTestId('arena-hud')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#phaser-container canvas')).toBeVisible();
  await expect(page.locator('[data-clock-phase]')).toContainText('Fase VII');

  // Verify pause works on mobile viewport
  await page.getByTestId('pause-btn').click();
  await expect(page.getByTestId('pause-modal')).toBeVisible();
});
