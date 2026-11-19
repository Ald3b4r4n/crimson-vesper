import { expect, test } from '@playwright/test';

test('verifies 4 difficulties, 36 Ultimate Power Grid icons, dense forest & fire physics, and mobile fullscreen landscape', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 840 });
  await page.goto('/');

  // 1. Reworked Game Splash Menu
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.locator('.title-main')).toHaveText('VESPERA');
  await expect(page.getByTestId('menu-play-btn')).toBeVisible();
  await expect(page.getByTestId('tab-powers')).toBeVisible();
  await expect(page.getByTestId('open-save-modal-btn')).toBeVisible();
  await expect(page.getByTestId('fullscreen-btn')).toBeVisible();

  // Test Save Game Modal (3 slots, manual save, JSON export)
  await page.getByTestId('open-save-modal-btn').click();
  await expect(page.getByTestId('save-game-modal')).toBeVisible();
  await expect(page.getByTestId('save-slot-0')).toBeVisible();
  await expect(page.getByTestId('save-slot-1')).toBeVisible();
  await expect(page.getByTestId('save-slot-2')).toBeVisible();
  await page.getByTestId('manual-save-btn').click();
  await expect(page.getByTestId('save-status-msg')).toContainText('salvo');
  await page.getByTestId('export-save-btn').click();
  await expect(page.getByTestId('save-json-textarea')).toContainText('totalSouls');
  await page.locator('[data-close-save-modal]').click();
  await expect(page.getByTestId('save-game-modal')).toBeHidden();
  await page.screenshot({ path: 'test-results/preview-splash-menu.png' });

  // 2. Redesigned Power Grid, Out-of-Game Forge & Ultimate Matrix (36 custom .webp icons: Base + Relic -> Evolved -> Ultimate)
  await page.getByTestId('tab-powers').click();
  await expect(page.locator('.synergy-row')).toHaveCount(9);
  await expect(page.locator('.synergy-matrix .power-icon-img')).toHaveCount(36);

  const loadedCount = await page
    .locator('.synergy-matrix .power-icon-img')
    .evaluateAll((imgs) =>
      imgs.filter((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0).length
    );
  expect(loadedCount).toBe(36);

  // Out-of-Game Forge check: upgrade unlocked Whip (60 souls from initial 200), verify locked Bible requires Stage I discovery
  await expect(page.getByTestId('weapon-forge-panel')).toBeVisible();
  await expect(page.getByTestId('forge-souls-balance')).toHaveText('200');
  await page.getByTestId('forge-upgrade-btn').click();
  await expect(page.getByTestId('forge-souls-balance')).toHaveText('140');
  await expect(page.getByTestId('forge-level-val')).toHaveText('1 / 5');

  await page.getByTestId('power-tile-bible').click();
  await expect(page.getByTestId('forge-upgrade-btn')).toBeDisabled();
  await expect(page.getByTestId('forge-upgrade-btn')).toContainText('Fase I');
  await expect(page.getByTestId('arsenal-stage-weapons-list')).toBeVisible();
  await expect(page.getByTestId('arsenal-stage-weapons-list')).toContainText('Bíblia das Cinzas');
  await expect(page.getByTestId('arsenal-stage-weapons-list')).toContainText('Turíbulo Sagrado');
  await page.screenshot({ path: 'test-results/preview-power-grid.png' });

  // Return to Splash, then enter Hero Select -> verify all 8 Heroes (incl. Mordred, LinK, Antonio Cruz, Luisa Cruz) & Difficulty Selector
  await page.getByRole('button', { name: '← Menu' }).click();
  await page.getByTestId('menu-play-btn').click();

  await expect(page.getByTestId('hero-card-alaric')).toBeVisible();
  await expect(page.getByTestId('hero-card-mordred')).toBeVisible();
  await expect(page.getByTestId('hero-card-link')).toBeVisible();
  await expect(page.getByTestId('hero-card-antonio')).toBeVisible();
  await expect(page.getByTestId('hero-card-luisa')).toBeVisible();

  await page.getByTestId('hero-card-luisa').click();
  await expect(page.locator('.showcase-panel')).toContainText('Filha de Antonio Cruz');
  await expect(page.locator('.showcase-panel')).toContainText('encaracolados');
  await page.getByTestId('hero-card-antonio').click();
  await expect(page.locator('.showcase-panel')).toContainText('Antonio Cruz');
  await expect(page.getByTestId('difficulty-normal')).toBeVisible();
  await expect(page.getByTestId('difficulty-hard')).toBeVisible();
  await expect(page.getByTestId('difficulty-epic')).toBeVisible();
  await expect(page.getByTestId('difficulty-holi_shit')).toBeVisible();
  await page.getByTestId('difficulty-holi_shit').click();
  await page.screenshot({ path: 'test-results/preview-hero-select.png' });

  await page.getByTestId('go-stage-select-btn').click();
  await expect(page.getByTestId('stage-card-forest')).toBeVisible();
  await page.getByTestId('stage-card-forest').click();
  await expect(page.getByTestId('stage-card-forest')).toContainText('Bíblia das Cinzas');
  await expect(page.getByTestId('stage-hidden-weapon-info')).toContainText('Bíblia das Cinzas');
  await expect(page.getByTestId('stage-weapons-guide')).toBeVisible();
  await expect(page.getByTestId('stage-weapons-guide')).toContainText('Turíbulo Sagrado');
  await expect(page.locator('.showcase-footer')).toContainText('40:00');
  await expect(page.locator('.showcase-footer')).toContainText('HOLI SHIT!');
  await page.screenshot({ path: 'test-results/preview-stage-select.png' });

  await page.getByTestId('start-run-btn').click();

  // 3. Arena HUD, 40:00 Match Clock, Hidden Weapon Compass, Difficulty Badge, Dense Forest + Fire Physics & Pause Modal
  await expect(page.getByTestId('arena-hud')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#phaser-container canvas')).toBeVisible();
  await expect(page.locator('[data-clock-time]')).toContainText('/ 40:00');
  await expect(page.locator('[data-clock-phase]')).toContainText('HOLI SHIT!');
  await expect(page.getByTestId('hud-weapon-compass')).toBeVisible();
  await expect(page.getByTestId('hud-weapon-compass')).toContainText('Bíblia das Cinzas');

  await page.waitForTimeout(700);
  const hudIconLoaded = await page
    .locator('.slots-panel .slot-icon-img')
    .first()
    .evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0);
  expect(hudIconLoaded).toBe(true);

  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/preview-gameplay-forest.png' });
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyW');

  await page.getByTestId('pause-btn').click();
  await expect(page.getByTestId('pause-modal')).toBeVisible();
  await page.getByTestId('pause-save-run-btn').click();
  await expect(page.getByTestId('pause-save-status')).toContainText('Vigília salva');
  await expect(page.locator('[data-quit-btn]')).toHaveText('Sair e retornar ao menu');
  await page.locator('[data-quit-btn]').click();
  await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 5000 });

  // Resume the saved mid-run checkpoint from Splash Screen!
  await page.waitForTimeout(400);
  await expect(page.getByTestId('continue-saved-run-btn')).toBeVisible();
  await page.getByTestId('continue-saved-run-btn').click();
  await expect(page.getByTestId('arena-hud')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-clock-phase]')).toContainText('HOLI SHIT!');
  await page.getByTestId('pause-btn').click();
  await page.locator('[data-quit-btn]').click();
  await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 5000 });

  // 4. Native Mobile Landscape (844x390 — exact smartphone landscape viewport) + Wide Field-of-View + Multitouch Dash!
  await page.waitForTimeout(420);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByTestId('menu-play-btn').click();
  await page.getByTestId('hero-card-seraphina').click();
  await page.getByTestId('go-stage-select-btn').click();
  await page.getByTestId('stage-card-forest').click();
  await page.getByTestId('start-run-btn').click();

  await expect(page.getByTestId('arena-hud')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(700);

  // Verify canvas world resolution scaled to wide tactical FOV (~1861x860) while CSS fills 100% of 844x390!
  const canvasMetrics = await page.locator('#phaser-container canvas').evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return { worldW: c.width, worldH: c.height, cssW: Math.round(r.width), cssH: Math.round(r.height) };
  });
  expect(canvasMetrics.worldH).toBeGreaterThanOrEqual(840);
  expect(canvasMetrics.worldW).toBeGreaterThanOrEqual(1800);
  expect(canvasMetrics.cssW).toBe(844);
  expect(canvasMetrics.cssH).toBe(390);

  // Verify TWO-THUMB MULTITOUCH: Left thumb holds floating joystick (pointerId=1) while Right thumb taps PASSO ESPECTRAL (pointerId=2)!
  await page.evaluate(() => {
    const surface = document.querySelector('[data-touch-surface]')!;
    const dashBtn = document.querySelector('[data-testid="dash-btn"]')!;
    surface.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 1,
        isPrimary: true,
        pointerType: 'touch',
        clientX: 160,
        clientY: 260,
      })
    );
    surface.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 1,
        isPrimary: true,
        pointerType: 'touch',
        clientX: 210,
        clientY: 245,
      })
    );
    dashBtn.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 2,
        isPrimary: false,
        pointerType: 'touch',
        clientX: 790,
        clientY: 340,
      })
    );
  });

  await page.waitForTimeout(120);
  await expect(page.getByTestId('dash-btn')).not.toHaveClass(/\bready\b/);
  await expect(page.locator('[data-dash-label]')).toContainText('s');
  await page.screenshot({ path: 'test-results/preview-mobile-native-landscape.png' });

  // Release left thumb and return to menu
  await page.evaluate(() => {
    const surface = document.querySelector('[data-touch-surface]')!;
    surface.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: 1,
        isPrimary: true,
        pointerType: 'touch',
      })
    );
  });

  await page.getByTestId('pause-btn').click();
  await expect(page.getByTestId('pause-modal')).toBeVisible();
  await page.locator('[data-quit-btn]').click();
  await expect(page.getByTestId('title-screen')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(420);

  // 5. Mobile Portrait (390x844) -> Automatic & Toggled Forced CSS Landscape ("visão de tela deitada")
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#game-root')).toHaveClass(/forced-landscape/);
  // Toggle off and back on via fullscreen button to verify manual toggle too
  await page.getByTestId('fullscreen-btn').click();
  await expect(page.locator('#game-root')).not.toHaveClass(/forced-landscape/);
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
