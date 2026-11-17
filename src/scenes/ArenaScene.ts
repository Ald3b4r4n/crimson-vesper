import Phaser from 'phaser';
import { forgeAllTexturesAndAnims } from '../art/SpriteForge';
import { gothicAudio } from '../audio/GothicAudio';
import {
  ENEMIES,
  EnemyDefinition,
  EnemyKind,
  HEROES,
  HeroId,
  HeroStats,
} from '../data/loreData';
import { SpatialGrid } from '../game/SpatialGrid';
import {
  applyUpgradeChoice,
  buildUpgradeChoices,
  computeEffectiveStats,
  createInitialInventory,
  InventoryState,
  resolveRelicChest,
  UpgradeChoice,
  xpRequiredForLevel,
} from '../game/UpgradeLogic';

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  level: number;
  elapsedSeconds: number;
  kills: number;
  souls: number;
  dashReadyRatio: number;
  phaseName: string;
  inventory: InventoryState;
  boss?: {
    name: string;
    hp: number;
    maxHp: number;
  };
}

export interface RunSummary {
  victory: boolean;
  heroId: HeroId;
  elapsedSeconds: number;
  level: number;
  kills: number;
  souls: number;
  inventory: InventoryState;
}

export interface ArenaCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onLevelUpChoices: (choices: UpgradeChoice[], onPick: (choice: UpgradeChoice) => void) => void;
  onRelicChestOpen: (reward: UpgradeChoice, onClose: () => void) => void;
  onBannerAnnouncement: (title: string, subtitle: string) => void;
  onPauseChanged: (paused: boolean) => void;
  onRunEnded: (summary: RunSummary) => void;
}

interface EnemyRuntime {
  id: number;
  kind: EnemyKind;
  def: EnemyDefinition;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  vx: number;
  vy: number;
  knockVx: number;
  knockVy: number;
  active: boolean;
  dying: boolean;
  spawnProgress: number; // 0 -> 1 emergence transition
  hitFlashTimer: number;
  squashTimer: number;
  animSeed: number;
  auraContactTimer: number;
  bossChargeTimer: number;
  bossCharging: boolean;
  bossChargeDirX: number;
  bossChargeDirY: number;
}

interface ProjectileRuntime {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  spinSpeed: number;
  damage: number;
  pierce: number;
  radius: number;
  life: number;
  crit: boolean;
  lifeSteal: number;
  hitIds: Set<number>;
}

interface GemRuntime {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  xpValue: number;
  magnetized: boolean;
  magnetTime: number;
  originX: number;
  originY: number;
  bobSeed: number;
}

interface ChestRuntime {
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  pulse: number;
}

interface PropRuntime {
  sprite: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

const RUN_VICTORY_SECONDS = 600; // 10 intense minutes to Full Eclipse & Crimson Reaper

export class ArenaScene extends Phaser.Scene {
  private callbacks!: ArenaCallbacks;
  private heroId: HeroId = 'alaric';
  private inventory!: InventoryState;
  private stats!: HeroStats;

  // World & Atmosphere
  private forestBg!: Phaser.GameObjects.TileSprite;
  private roadBg!: Phaser.GameObjects.TileSprite;
  private ambientOverlay!: Phaser.GameObjects.Rectangle;
  private fogWisps: Array<{ sprite: Phaser.GameObjects.Image; vx: number; vy: number }> = [];
  private props: PropRuntime[] = [];

  // Hero
  private heroSprite!: Phaser.GameObjects.Sprite;
  private heroShadow!: Phaser.GameObjects.Image;
  private thuribleAura!: Phaser.GameObjects.Image;
  private hpBarGraphics!: Phaser.GameObjects.Graphics;
  private heroX = 0;
  private heroY = 0;
  private heroVx = 0;
  private heroVy = 0;
  private facing = 1;
  private hp = 120;
  private trailingHp = 120;
  private invulnTimer = 0;
  private dashCooldownTimer = 0;
  private dashActiveTimer = 0;
  private dashDirX = 1;
  private dashDirY = 0;
  private dustStepTimer = 0;

  // Entities & Spatial Index
  private nextEnemyId = 1;
  private enemies: EnemyRuntime[] = [];
  private projectiles: ProjectileRuntime[] = [];
  private gems: GemRuntime[] = [];
  private chests: ChestRuntime[] = [];
  private orbitalSprites: Phaser.GameObjects.Image[] = [];
  private orbitalAngle = 0;
  private orbitalHitCooldowns = new Map<number, number>();
  private grid = new SpatialGrid<EnemyRuntime>(96);

  // Timers & Wave Director
  private elapsedSeconds = 0;
  private kills = 0;
  private spawnAccumulator = 0;
  private spawnedBossMilestones = new Set<string>();
  private weaponTimers: Record<string, number> = {
    whip: 0.3,
    wand: 0.2,
    axe: 0.8,
    lightning: 1.1,
  };
  private hudSyncTimer = 0;

  // State Flags & Controls
  private modalPaused = false;
  private userPaused = false;
  private runEnded = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private virtualMoveX = 0;
  private virtualMoveY = 0;

  constructor() {
    super({ key: 'ArenaScene' });
  }

  configureRun(heroId: HeroId, callbacks: ArenaCallbacks): void {
    this.heroId = heroId;
    this.callbacks = callbacks;
  }

  setVirtualJoystick(dx: number, dy: number): void {
    this.virtualMoveX = dx;
    this.virtualMoveY = dy;
  }

  triggerDash(): void {
    if (this.isSimulationPaused() || this.dashCooldownTimer > 0) return;
    this.dashCooldownTimer = 2.8;
    this.dashActiveTimer = 0.22;
    this.invulnTimer = Math.max(this.invulnTimer, 0.32);

    const len = Math.hypot(this.heroVx, this.heroVy);
    if (len > 15) {
      this.dashDirX = this.heroVx / len;
      this.dashDirY = this.heroVy / len;
    } else {
      this.dashDirX = this.facing;
      this.dashDirY = 0;
    }

    gothicAudio.playDash();
    this.spawnRingBurst(this.heroX, this.heroY, HEROES[this.heroId].accentColor, 14);
  }

  toggleUserPause(): boolean {
    if (this.runEnded || this.modalPaused) return this.userPaused;
    this.userPaused = !this.userPaused;
    this.callbacks?.onPauseChanged(this.userPaused);
    return this.userPaused;
  }

  setUserPause(paused: boolean): void {
    if (this.runEnded) return;
    this.userPaused = paused;
    this.callbacks?.onPauseChanged(this.userPaused);
  }

  create(): void {
    forgeAllTexturesAndAnims(this);

    // Reset state cleanly for new or restarted runs
    this.enemies = [];
    this.projectiles = [];
    this.gems = [];
    this.chests = [];
    this.orbitalSprites = [];
    this.props = [];
    this.fogWisps = [];
    this.orbitalHitCooldowns.clear();
    this.spawnedBossMilestones.clear();

    this.inventory = createInitialInventory(this.heroId);
    this.stats = computeEffectiveStats(this.inventory);
    this.hp = this.stats.maxHp;
    this.trailingHp = this.hp;
    this.heroX = 0;
    this.heroY = 0;
    this.heroVx = 0;
    this.heroVy = 0;
    this.facing = 1;
    this.elapsedSeconds = 0;
    this.kills = 0;
    this.spawnAccumulator = 0;
    this.invulnTimer = 0;
    this.dashCooldownTimer = 0;
    this.dashActiveTimer = 0;
    this.modalPaused = false;
    this.userPaused = false;
    this.runEnded = false;

    const { width, height } = this.scale;

    // 1. Infinite Forest & Cathedral Road
    this.forestBg = this.add
      .tileSprite(0, 0, width + 512, height + 512, 'forest_tile')
      .setScrollFactor(0)
      .setDepth(-30);

    this.roadBg = this.add
      .tileSprite(width / 2, height / 2, 160, height + 512, 'road_tile')
      .setScrollFactor(0)
      .setDepth(-28);

    // Populate gothic props in world space (recycled smoothly around hero)
    this.initWorldProps();

    // 2. Thurible Sanctuary Aura (under hero)
    this.thuribleAura = this.add
      .image(0, 0, 'vfx_aura_ring')
      .setDepth(2)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);

    // 3. Hero Shadow & Animated Sprite
    this.heroShadow = this.add.image(0, 22, 'vfx_shadow').setDepth(4).setScale(1.05, 0.9);
    this.heroSprite = this.add
      .sprite(0, 0, `hero_${this.heroId}`, 0)
      .setDepth(10)
      .setScale(0.1);
    this.heroSprite.play(`hero_${this.heroId}_walk`);

    // Dramatic Hero Arrival Entrance Tween
    this.tweens.add({
      targets: this.heroSprite,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 520,
      ease: 'Back.easeOut',
    });
    this.spawnRingBurst(0, 0, HEROES[this.heroId].accentColor, 18);

    // World-space HP bar below hero (classic Vampire Survivors style!)
    this.hpBarGraphics = this.add.graphics().setDepth(25);

    // 4. Drifting Atmospheric Mist & Eclipse Lighting Overlay
    for (let i = 0; i < 9; i++) {
      const wisp = this.add
        .image(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(0, height),
          'vfx_fog'
        )
        .setScrollFactor(0)
        .setDepth(40)
        .setScale(Phaser.Math.FloatBetween(1.8, 3.4))
        .setAlpha(Phaser.Math.FloatBetween(0.18, 0.36))
        .setBlendMode(Phaser.BlendModes.SCREEN);
      this.fogWisps.push({
        sprite: wisp,
        vx: Phaser.Math.FloatBetween(10, 26),
        vy: Phaser.Math.FloatBetween(-5, 6),
      });
    }

    this.ambientOverlay = this.add
      .rectangle(width / 2, height / 2, width + 64, height + 64, 0x16091e, 0.14)
      .setScrollFactor(0)
      .setDepth(42)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Subtle WebGL Vignette on Camera if WebGL pipeline available
    const cam = this.cameras.main;
    cam.centerOn(0, 0);
    if (cam.postFX) {
      cam.postFX.addVignette(0.5, 0.5, 0.88, 0.34);
    }

    // 5. Keyboard Controls
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        SPACE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      };

      this.input.keyboard.on('keydown-SPACE', () => this.triggerDash());
      this.input.keyboard.on('keydown-ESC', () => this.toggleUserPause());
      this.input.keyboard.on('keydown-P', () => this.toggleUserPause());
    }

    this.scale.on('resize', this.handleResize, this);
    this.handleResize(this.scale.gameSize);

    // Kick off initial wave of bats so action begins immediately with style
    for (let i = 0; i < 8; i++) {
      this.spawnEnemyAroundHero('bat');
    }

    this.callbacks?.onBannerAnnouncement(
      'Floresta dos Lamentos',
      'Sobreviva ao Eclipse Carmesim e colete as Gemas de Éter'
    );
    this.pushHudUpdate();
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const w = gameSize.width;
    const h = gameSize.height;
    if (this.forestBg) {
      this.forestBg.setPosition(w / 2, h / 2).setSize(w + 512, h + 512);
    }
    if (this.ambientOverlay) {
      this.ambientOverlay.setPosition(w / 2, h / 2).setSize(w + 64, h + 64);
    }
  }

  private initWorldProps(): void {
    const keys = ['prop_pillar', 'prop_tree', 'prop_brazier'];
    for (let i = 0; i < 34; i++) {
      const key = keys[i % keys.length];
      let px = Phaser.Math.Between(-1200, 1200);
      const py = Phaser.Math.Between(-1200, 1200);
      if (Math.abs(px) < 120) px += px >= 0 ? 150 : -150; // Keep central road clear

      const sprite = this.add.image(px, py, key).setDepth(py * 0.001 + 3);
      let glow: Phaser.GameObjects.Image | undefined;
      if (key === 'prop_brazier') {
        glow = this.add
          .image(px, py - 8, 'vfx_particle')
          .setScale(7)
          .setTint(0xff8c3b)
          .setAlpha(0.28)
          .setDepth(2)
          .setBlendMode(Phaser.BlendModes.ADD);
      }
      this.props.push({ sprite, glow, x: px, y: py });
    }
  }

  private isSimulationPaused(): boolean {
    return this.modalPaused || this.userPaused || this.runEnded;
  }

  update(time: number, deltaMs: number): void {
    if (this.isSimulationPaused()) return;

    const dt = Math.min(0.05, deltaMs / 1000);
    this.elapsedSeconds += dt;

    this.updateHeroMovementAndAnims(time, dt);
    this.updateCameraAndScenery(time, dt);
    this.updateWaveDirector(dt);
    this.updateSpatialGrid();
    this.updateWeapons(time, dt);
    this.updateProjectiles(dt);
    this.updateEnemies(time, dt);
    this.updateGemsAndChests(time, dt);
    this.drawHeroHpBar();

    // Passive HP Regeneration
    if (this.hp > 0 && this.hp < this.stats.maxHp) {
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.1) {
      this.hudSyncTimer = 0;
      this.pushHudUpdate();
    }

    if (this.elapsedSeconds >= RUN_VICTORY_SECONDS && !this.spawnedBossMilestones.has('reaper')) {
      this.spawnedBossMilestones.add('reaper');
      this.spawnBoss('reaper', 'O Ceifador Carmesim', 'A Meia-Noite Eterna chegou!');
    }
  }

  private updateHeroMovementAndAnims(time: number, dt: number): void {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);

    let inputX = this.virtualMoveX;
    let inputY = this.virtualMoveY;

    if (this.cursors && this.wasd) {
      if (this.cursors.left.isDown || this.wasd.A.isDown) inputX -= 1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) inputX += 1;
      if (this.cursors.up.isDown || this.wasd.W.isDown) inputY -= 1;
      if (this.cursors.down.isDown || this.wasd.S.isDown) inputY += 1;
    }

    const inputLen = Math.hypot(inputX, inputY);
    if (inputLen > 1) {
      inputX /= inputLen;
      inputY /= inputLen;
    }

    if (this.dashActiveTimer > 0) {
      this.dashActiveTimer -= dt;
      const dashSpeed = this.stats.moveSpeed * 2.85;
      this.heroVx = this.dashDirX * dashSpeed;
      this.heroVy = this.dashDirY * dashSpeed;

      // Spawn fading spectral afterimages during dash
      if (Math.random() < 0.65) {
        const ghost = this.add
          .image(this.heroX, this.heroY, `hero_${this.heroId}`, this.heroSprite.frame.name)
          .setScale(this.heroSprite.scaleX, this.heroSprite.scaleY)
          .setFlipX(this.heroSprite.flipX)
          .setTint(HEROES[this.heroId].accentColor)
          .setAlpha(0.55)
          .setDepth(8)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: ghost,
          alpha: 0,
          scaleX: ghost.scaleX * 0.85,
          scaleY: ghost.scaleY * 0.85,
          duration: 240,
          onComplete: () => ghost.destroy(),
        });
      }
    } else {
      // Smooth acceleration & graceful deceleration transition
      const targetVx = inputX * this.stats.moveSpeed;
      const targetVy = inputY * this.stats.moveSpeed;
      const accel = inputLen > 0.05 ? 14 : 11;
      this.heroVx = Phaser.Math.Linear(this.heroVx, targetVx, Math.min(1, accel * dt));
      this.heroVy = Phaser.Math.Linear(this.heroVy, targetVy, Math.min(1, accel * dt));
    }

    this.heroX += this.heroVx * dt;
    this.heroY += this.heroVy * dt;

    if (Math.abs(inputX) > 0.08) {
      this.facing = inputX >= 0 ? 1 : -1;
    }

    const speedRatio = Math.min(1, Math.hypot(this.heroVx, this.heroVy) / this.stats.moveSpeed);
    this.heroSprite.setPosition(this.heroX, this.heroY);
    this.heroSprite.setFlipX(this.facing < 0);
    this.heroShadow.setPosition(this.heroX, this.heroY + 22);

    // Elegant secondary motion: dynamic lean + stride squash/stretch vs calm idle breathing
    const targetTilt = (this.heroVx / this.stats.moveSpeed) * 0.095;
    this.heroSprite.rotation = Phaser.Math.Linear(this.heroSprite.rotation, targetTilt, 10 * dt);

    if (speedRatio > 0.15) {
      this.heroSprite.anims.timeScale = 0.75 + speedRatio * 0.65;
      const stridePulse = Math.sin(time * 0.016) * 0.05 * speedRatio;
      this.heroSprite.setScale(1.15 - stridePulse, 1.15 + stridePulse);

      this.dustStepTimer -= dt;
      if (this.dustStepTimer <= 0) {
        this.dustStepTimer = 0.18;
        this.spawnFootstepDust(this.heroX, this.heroY + 20);
      }
    } else {
      this.heroSprite.anims.timeScale = 0.35;
      const breath = Math.sin(time * 0.004) * 0.03;
      this.heroSprite.setScale(1.15 + breath * 0.5, 1.15 - breath);
    }

    // Hurt invulnerability shimmer
    if (this.invulnTimer > 0 && this.dashActiveTimer <= 0) {
      this.heroSprite.setAlpha(Math.sin(time * 0.045) > 0 ? 1 : 0.45);
    } else {
      this.heroSprite.setAlpha(1);
    }
  }

  private updateCameraAndScenery(time: number, dt: number): void {
    const cam = this.cameras.main;
    const lookAheadX = this.heroVx * 0.22;
    const lookAheadY = this.heroVy * 0.22;
    const targetCamX = this.heroX + lookAheadX - cam.width / 2;
    const targetCamY = this.heroY + lookAheadY - cam.height / 2;

    cam.scrollX = Phaser.Math.Linear(cam.scrollX, targetCamX, Math.min(1, 6.5 * dt));
    cam.scrollY = Phaser.Math.Linear(cam.scrollY, targetCamY, Math.min(1, 6.5 * dt));

    this.forestBg.tilePositionX = cam.scrollX;
    this.forestBg.tilePositionY = cam.scrollY;

    // Keep ancient north-south road anchored at world X = 0!
    const roadScreenX = 0 - cam.scrollX;
    this.roadBg.setPosition(roadScreenX, cam.height / 2);
    this.roadBg.tilePositionY = cam.scrollY;

    // Wrap gothic scenery props seamlessly around the camera
    const wrapRange = 1250;
    for (let i = 0; i < this.props.length; i++) {
      const p = this.props[i];
      let moved = false;
      if (p.x - this.heroX > wrapRange) {
        p.x -= wrapRange * 2;
        moved = true;
      } else if (this.heroX - p.x > wrapRange) {
        p.x += wrapRange * 2;
        moved = true;
      }
      if (p.y - this.heroY > wrapRange) {
        p.y -= wrapRange * 2;
        moved = true;
      } else if (this.heroY - p.y > wrapRange) {
        p.y += wrapRange * 2;
        moved = true;
      }
      if (moved) {
        if (Math.abs(p.x) < 120) p.x += p.x >= 0 ? 140 : -140;
        p.sprite.setPosition(p.x, p.y);
      }
      if (p.glow) {
        p.glow.setPosition(p.x, p.y - 10);
        p.glow.setAlpha(0.22 + Math.sin(time * 0.008 + i) * 0.07);
      }
    }

    // Drift atmospheric fog wisps
    for (const w of this.fogWisps) {
      w.sprite.x += w.vx * dt;
      w.sprite.y += w.vy * dt;
      if (w.sprite.x > cam.width + 180) w.sprite.x = -180;
      if (w.sprite.y < -120) w.sprite.y = cam.height + 120;
      if (w.sprite.y > cam.height + 120) w.sprite.y = -120;
    }

    // Smooth atmospheric color progression toward the Crimson Eclipse!
    const eclipseProgress = Math.min(1, this.elapsedSeconds / RUN_VICTORY_SECONDS);
    const r = Math.round(Phaser.Math.Linear(22, 72, eclipseProgress));
    const g = Math.round(Phaser.Math.Linear(14, 8, eclipseProgress));
    const b = Math.round(Phaser.Math.Linear(34, 22, eclipseProgress));
    this.ambientOverlay.setFillStyle((r << 16) | (g << 8) | b, 0.14 + eclipseProgress * 0.16);
  }

  private updateWaveDirector(dt: number): void {
    const t = this.elapsedSeconds;
    const maxActiveEnemies = Math.min(340, Math.round(48 + t * 0.58));

    // Boss milestones
    if (t >= 90 && !this.spawnedBossMilestones.has('fenrir')) {
      this.spawnedBossMilestones.add('fenrir');
      this.spawnBoss(
        'fenrir',
        'Fenrir da Lua Podre',
        'O Guardião Feral farejou seu sangue na floresta!'
      );
    }
    if (t >= 240 && !this.spawnedBossMilestones.has('malakor')) {
      this.spawnedBossMilestones.add('malakor');
      this.spawnBoss(
        'malakor',
        'Cardeal Malakor',
        'O Primeiro Traidor desce sobre asas escarlates!'
      );
    }
    // Periodic swarm surge events (like screenshot 3's dryad + steed encircle!)
    if (t >= 140 && !this.spawnedBossMilestones.has('surge_dryads')) {
      this.spawnedBossMilestones.add('surge_dryads');
      this.callbacks?.onBannerAnnouncement(
        'Maré Silvestre',
        'Dríades Espinhosas e Corcéis da Névoa cercam a estrada!'
      );
      this.spawnCircleWave('dryad', 24);
    }
    if (t >= 340 && !this.spawnedBossMilestones.has('surge_knights')) {
      this.spawnedBossMilestones.add('surge_knights');
      this.callbacks?.onBannerAnnouncement(
        'Procissão de Ferro',
        'A Guarda Cardeal Oca marcha sobre as cinzas!'
      );
      this.spawnCircleWave('hollow_knight', 18);
    }

    if (this.enemies.length >= maxActiveEnemies) return;

    const spawnsPerSecond = 2.6 + t * 0.032;
    this.spawnAccumulator += spawnsPerSecond * dt;

    while (this.spawnAccumulator >= 1 && this.enemies.length < maxActiveEnemies) {
      this.spawnAccumulator -= 1;
      const kind = this.pickWaveEnemyKind(t);
      this.spawnEnemyAroundHero(kind);
    }
  }

  private pickWaveEnemyKind(t: number): EnemyKind {
    const r = Math.random();
    if (t < 35) {
      return r < 0.65 ? 'bat' : 'flagellant';
    }
    if (t < 110) {
      if (r < 0.32) return 'bat';
      if (r < 0.72) return 'flagellant';
      return 'dryad';
    }
    if (t < 210) {
      if (r < 0.2) return 'flagellant';
      if (r < 0.56) return 'dryad';
      if (r < 0.84) return 'mist_steed';
      return 'acolyte';
    }
    if (t < 360) {
      if (r < 0.28) return 'dryad';
      if (r < 0.55) return 'mist_steed';
      if (r < 0.82) return 'acolyte';
      return 'hollow_knight';
    }
    if (r < 0.25) return 'mist_steed';
    if (r < 0.6) return 'acolyte';
    return 'hollow_knight';
  }

  private spawnCircleWave(kind: EnemyKind, count: number): void {
    const cam = this.cameras.main;
    const dist = Math.hypot(cam.width, cam.height) * 0.52;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.spawnEnemyAt(
        kind,
        this.heroX + Math.cos(angle) * dist,
        this.heroY + Math.sin(angle) * dist
      );
    }
  }

  private spawnBoss(kind: EnemyKind, title: string, subtitle: string): void {
    gothicAudio.playBossHorn();
    this.cameras.main.shake(360, 0.006);
    this.callbacks?.onBannerAnnouncement(title, subtitle);
    const angle = Math.random() * Math.PI * 2;
    this.spawnEnemyAt(kind, this.heroX + Math.cos(angle) * 440, this.heroY + Math.sin(angle) * 440);
  }

  private spawnEnemyAroundHero(kind: EnemyKind): void {
    const cam = this.cameras.main;
    const margin = 70;
    const halfW = cam.width / 2 + margin;
    const halfH = cam.height / 2 + margin;
    const angle = Math.random() * Math.PI * 2;
    const x = this.heroX + Math.cos(angle) * halfW;
    const y = this.heroY + Math.sin(angle) * halfH;
    this.spawnEnemyAt(kind, x, y);
  }

  private spawnEnemyAt(kind: EnemyKind, x: number, y: number): void {
    const def = ENEMIES[kind];
    const timeScaleHp = 1 + this.elapsedSeconds * 0.0038;
    const scaledHp = Math.round(def.hp * (def.isBoss ? 1 : timeScaleHp));

    const shadow = this.add
      .image(x, y + 16 * def.scale, 'vfx_shadow')
      .setDepth(3)
      .setScale(def.scale * 0.85, def.scale * 0.7)
      .setAlpha(0);

    const sprite = this.add
      .sprite(x, y, `enemy_${kind}`, Phaser.Math.Between(0, 3))
      .setDepth(def.isBoss ? 14 : 7)
      .setScale(def.scale * 0.35, def.scale * 0.12)
      .setAlpha(0)
      .setTint(0x2a1428);
    sprite.play(`enemy_${kind}_move`);

    // Subtle dark emergence ring
    const ripple = this.add
      .image(x, y + 12, 'vfx_particle')
      .setTint(def.isBoss ? 0xff2a55 : 0x5c2b68)
      .setScale(0.5)
      .setAlpha(0.65)
      .setDepth(3);
    this.tweens.add({
      targets: ripple,
      scaleX: def.isBoss ? 5.5 : 2.6,
      scaleY: def.isBoss ? 2.8 : 1.4,
      alpha: 0,
      duration: 380,
      onComplete: () => ripple.destroy(),
    });

    this.enemies.push({
      id: this.nextEnemyId++,
      kind,
      def,
      sprite,
      shadow,
      x,
      y,
      radius: def.radius,
      hp: scaledHp,
      maxHp: scaledHp,
      vx: 0,
      vy: 0,
      knockVx: 0,
      knockVy: 0,
      active: true,
      dying: false,
      spawnProgress: 0,
      hitFlashTimer: 0,
      squashTimer: 0,
      animSeed: Math.random() * Math.PI * 2,
      auraContactTimer: 0,
      bossChargeTimer: 4.2,
      bossCharging: false,
      bossChargeDirX: 0,
      bossChargeDirY: 0,
    });
  }

  private updateSpatialGrid(): void {
    this.grid.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.active && !e.dying) {
        this.grid.insert(e);
      }
    }
  }

  private updateWeapons(time: number, dt: number): void {
    const w = this.inventory.weapons;

    // 1. WHIP / BLOOD ROSE
    const whipLv = w.whip ?? 0;
    const hasBloodRose = Boolean(w.blood_rose);
    if (whipLv > 0 || hasBloodRose) {
      this.weaponTimers.whip -= dt;
      if (this.weaponTimers.whip <= 0) {
        const baseCd = hasBloodRose ? 0.86 : Math.max(0.95, 1.32 - whipLv * 0.08);
        this.weaponTimers.whip = baseCd * this.stats.cooldown;
        this.fireWhipSlash(whipLv, hasBloodRose);
      }
    }

    // 2. WAND / STAR TORRENT
    const wandLv = w.wand ?? 0;
    const hasStarTorrent = Boolean(w.star_torrent);
    if (wandLv > 0 || hasStarTorrent) {
      this.weaponTimers.wand -= dt;
      if (this.weaponTimers.wand <= 0) {
        const baseCd = hasStarTorrent ? 0.17 : Math.max(0.46, 0.86 - wandLv * 0.09);
        this.weaponTimers.wand = baseCd * this.stats.cooldown;
        this.fireWandBolts(wandLv, hasStarTorrent);
      }
    }

    // 3. BIBLE / IMMORTAL VESPER (Continuous Orbitals)
    const bibleLv = w.bible ?? 0;
    const hasImmortalVesper = Boolean(w.immortal_vesper);
    this.updateBibleOrbitals(time, dt, bibleLv, hasImmortalVesper);

    // 4. AXE / ECLIPSE SCYTHE
    const axeLv = w.axe ?? 0;
    const hasEclipseScythe = Boolean(w.eclipse_scythe);
    if (axeLv > 0 || hasEclipseScythe) {
      this.weaponTimers.axe -= dt;
      if (this.weaponTimers.axe <= 0) {
        const baseCd = hasEclipseScythe ? 1.15 : Math.max(1.25, 1.85 - axeLv * 0.1);
        this.weaponTimers.axe = baseCd * this.stats.cooldown;
        this.fireAxesOrScythes(axeLv, hasEclipseScythe);
      }
    }

    // 5. THURIBLE / DEVOURING SHROUD (Sanctuary Aura)
    const thuribleLv = w.thurible ?? 0;
    const hasDevouringShroud = Boolean(w.devouring_shroud);
    this.updateThuribleAura(time, dt, thuribleLv, hasDevouringShroud);

    // 6. LIGHTNING / SEVEN JUDGMENT
    const lightningLv = w.lightning ?? 0;
    const hasSevenJudgment = Boolean(w.seven_judgment);
    if (lightningLv > 0 || hasSevenJudgment) {
      this.weaponTimers.lightning -= dt;
      if (this.weaponTimers.lightning <= 0) {
        const baseCd = hasSevenJudgment ? 1.35 : Math.max(1.6, 2.5 - lightningLv * 0.16);
        this.weaponTimers.lightning = baseCd * this.stats.cooldown;
        this.fireLightningStrikes(lightningLv, hasSevenJudgment);
      }
    }
  }

  private fireWhipSlash(lv: number, evolved: boolean): void {
    gothicAudio.playWhip(evolved);
    const slashes = (evolved ? 2 : lv >= 2 ? 2 : 1) + Math.min(2, this.stats.amount);
    const baseDamage = (evolved ? 48 : 18 + lv * 7) * this.stats.might;
    const areaScale = (evolved ? 1.42 : 1 + lv * 0.08) * this.stats.area;

    for (let i = 0; i < slashes; i++) {
      const dir = i % 2 === 0 ? this.facing : -this.facing;
      const offsetY = i >= 2 ? (i % 2 === 0 ? -26 : 26) : -6 + i * 14;
      const delay = i * 75;

      this.time.delayedCall(delay, () => {
        if (this.isSimulationPaused()) return;
        const sx = this.heroX + dir * (68 * areaScale);
        const sy = this.heroY + offsetY;

        const slash = this.add
          .image(sx, sy, 'vfx_whip_slash')
          .setDepth(18)
          .setFlipX(dir < 0)
          .setScale(0.2 * areaScale, 0.55 * areaScale)
          .setTint(evolved ? 0xff2a55 : 0xfff6dc)
          .setBlendMode(Phaser.BlendModes.ADD);

        this.tweens.add({
          targets: slash,
          scaleX: 1.15 * areaScale,
          scaleY: 1.08 * areaScale,
          alpha: { from: 1, to: 0 },
          duration: 210,
          ease: 'Cubic.easeOut',
          onComplete: () => slash.destroy(),
        });

        // Rectangular/oval hitbox check via SpatialGrid
        const reachX = 86 * areaScale;
        const reachY = 38 * areaScale;
        const candidates = this.grid.queryRadius(sx, sy, reachX);
        for (const enemy of candidates) {
          if (Math.abs(enemy.x - sx) <= reachX + enemy.radius && Math.abs(enemy.y - sy) <= reachY + enemy.radius) {
            const isCrit = evolved || Math.random() < 0.15;
            this.damageEnemy(
              enemy,
              isCrit ? baseDamage * 1.5 : baseDamage,
              dir * 210,
              0,
              isCrit,
              evolved ? 1.5 : 0
            );
          }
        }
      });
    }
  }

  private fireWandBolts(lv: number, evolved: boolean): void {
    const nearest = this.grid.findNearest(this.heroX, this.heroY, 540);
    if (!nearest) return;

    const count = (evolved ? 1 : 1 + Math.floor(lv / 2)) + this.stats.amount;
    const damage = (evolved ? 26 : 14 + lv * 5) * this.stats.might;
    const pierce = evolved ? 3 : lv >= 3 ? 2 : 1;

    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * (evolved ? 45 : 75), () => {
        if (this.isSimulationPaused()) return;
        const target = this.grid.findNearest(this.heroX, this.heroY, 560) ?? nearest;
        const angle =
          Math.atan2(target.y - this.heroY, target.x - this.heroX) +
          Phaser.Math.FloatBetween(-0.07, 0.07);
        const speed = evolved ? 540 : 420 + lv * 20;

        gothicAudio.playWand(evolved);
        const sprite = this.add
          .image(this.heroX, this.heroY - 6, 'vfx_wand_bolt')
          .setDepth(16)
          .setScale(this.stats.area * (evolved ? 1.25 : 1))
          .setRotation(angle)
          .setTint(evolved ? 0x9ef0ff : 0xffffff)
          .setBlendMode(Phaser.BlendModes.ADD);

        this.projectiles.push({
          sprite,
          x: this.heroX,
          y: this.heroY - 6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity: 0,
          spinSpeed: 0,
          damage,
          pierce,
          radius: 12 * this.stats.area,
          life: 1.5,
          crit: evolved && Math.random() < 0.25,
          lifeSteal: 0,
          hitIds: new Set(),
        });
      });
    }
  }

  private updateBibleOrbitals(
    time: number,
    dt: number,
    lv: number,
    evolved: boolean
  ): void {
    if (lv <= 0 && !evolved) {
      if (this.orbitalSprites.length > 0) {
        this.orbitalSprites.forEach((s) => s.destroy());
        this.orbitalSprites = [];
      }
      return;
    }

    const desiredCount = (evolved ? 6 : 1 + lv) + this.stats.amount;
    while (this.orbitalSprites.length < desiredCount) {
      const spr = this.add
        .image(this.heroX, this.heroY, 'vfx_bible')
        .setDepth(15)
        .setTint(evolved ? 0xffe066 : 0xffffff);
      this.orbitalSprites.push(spr);
    }

    // Smooth active/rest cycle unless evolved (Immortal Vesper never fades!)
    const cycle = (time * 0.001) % 5.0;
    const visibility = evolved
      ? 1
      : cycle < 0.35
        ? cycle / 0.35
        : cycle < 3.65
          ? 1
          : cycle < 4.0
            ? 1 - (cycle - 3.65) / 0.35
            : 0;

    const angularSpeed = evolved ? 4.4 : 2.7 + lv * 0.25;
    this.orbitalAngle += angularSpeed * dt;
    const orbitRadius = (evolved ? 118 : 84 + lv * 7) * this.stats.area * (0.4 + 0.6 * visibility);
    const damage = (evolved ? 32 : 13 + lv * 5) * this.stats.might;

    // Tick down per-enemy orbital hit cooldowns
    for (const [enemyId, cd] of this.orbitalHitCooldowns.entries()) {
      if (cd - dt <= 0) this.orbitalHitCooldowns.delete(enemyId);
      else this.orbitalHitCooldowns.set(enemyId, cd - dt);
    }

    for (let i = 0; i < this.orbitalSprites.length; i++) {
      const spr = this.orbitalSprites[i];
      if (i >= desiredCount || visibility <= 0.02) {
        spr.setVisible(false);
        continue;
      }
      const theta = this.orbitalAngle + (i / desiredCount) * Math.PI * 2;
      const ox = this.heroX + Math.cos(theta) * orbitRadius;
      const oy = this.heroY + Math.sin(theta) * orbitRadius;
      spr
        .setVisible(true)
        .setPosition(ox, oy)
        .setAlpha(visibility)
        .setScale(visibility * this.stats.area * (evolved ? 1.2 : 1))
        .setRotation(theta + Math.PI / 2);

      if (visibility > 0.5) {
        const hitList = this.grid.queryRadius(ox, oy, 20 * this.stats.area);
        for (const enemy of hitList) {
          if (!this.orbitalHitCooldowns.has(enemy.id)) {
            this.orbitalHitCooldowns.set(enemy.id, 0.35);
            const pushAngle = Math.atan2(enemy.y - this.heroY, enemy.x - this.heroX);
            this.damageEnemy(
              enemy,
              damage,
              Math.cos(pushAngle) * 190,
              Math.sin(pushAngle) * 190,
              false,
              0
            );
          }
        }
      }
    }
  }

  private fireAxesOrScythes(lv: number, evolved: boolean): void {
    gothicAudio.playAxe();
    const count = (evolved ? 4 : 1 + Math.floor(lv / 2)) + this.stats.amount;
    const damage = (evolved ? 54 : 28 + lv * 10) * this.stats.might;

    for (let i = 0; i < count; i++) {
      if (evolved) {
        // 360-degree outward flying Eclipse Scythes!
        const angle = (i / count) * Math.PI * 2 + this.elapsedSeconds * 0.9;
        const speed = 320;
        const sprite = this.add
          .image(this.heroX, this.heroY, 'vfx_scythe')
          .setDepth(17)
          .setScale(1.25 * this.stats.area)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.projectiles.push({
          sprite,
          x: this.heroX,
          y: this.heroY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity: 0,
          spinSpeed: 11,
          damage,
          pierce: 99,
          radius: 26 * this.stats.area,
          life: 2.2,
          crit: true,
          lifeSteal: 0,
          hitIds: new Set(),
        });
      } else {
        // High-arc executioner axe (classic Vampire Survivors parabolic arc!)
        const spread = (i - (count - 1) / 2) * 75;
        const vx = this.facing * Phaser.Math.Between(95, 175) + spread;
        const vy = -Phaser.Math.Between(390, 470);
        const sprite = this.add
          .image(this.heroX, this.heroY - 10, 'vfx_axe')
          .setDepth(17)
          .setScale(1.05 * this.stats.area);
        this.projectiles.push({
          sprite,
          x: this.heroX,
          y: this.heroY - 10,
          vx,
          vy,
          gravity: 780,
          spinSpeed: 9.5 * this.facing,
          damage,
          pierce: 3 + lv,
          radius: 21 * this.stats.area,
          life: 2.1,
          crit: Math.random() < 0.3,
          lifeSteal: 0,
          hitIds: new Set(),
        });
      }
    }
  }

  private updateThuribleAura(
    time: number,
    dt: number,
    lv: number,
    evolved: boolean
  ): void {
    if (lv <= 0 && !evolved) {
      this.thuribleAura.setAlpha(0);
      return;
    }

    const radius = (evolved ? 128 : 68 + lv * 11) * this.stats.area;
    const pulse = 1 + Math.sin(time * 0.006) * 0.045;
    this.thuribleAura
      .setPosition(this.heroX, this.heroY + 4)
      .setDisplaySize(radius * 2 * pulse, radius * 2 * pulse)
      .setTint(evolved ? 0xff3b6b : 0x9ef7c6)
      .setAlpha(evolved ? 0.58 : 0.42)
      .setRotation(time * 0.0004);

    const tickDamage = (evolved ? 19 : 6 + lv * 2.8) * this.stats.might;
    const candidates = this.grid.queryRadius(this.heroX, this.heroY, radius);
    for (const enemy of candidates) {
      enemy.auraContactTimer -= dt;
      if (enemy.auraContactTimer <= 0) {
        enemy.auraContactTimer = evolved ? 0.32 : 0.46;
        const pushAngle = Math.atan2(enemy.y - this.heroY, enemy.x - this.heroX);
        this.damageEnemy(
          enemy,
          tickDamage,
          Math.cos(pushAngle) * 75,
          Math.sin(pushAngle) * 75,
          false,
          evolved ? 0.35 : 0
        );
      }
    }
  }

  private fireLightningStrikes(lv: number, evolved: boolean): void {
    const inRange = this.grid.queryRadius(this.heroX, this.heroY, 460);
    if (inRange.length === 0) return;

    const strikes = (evolved ? 4 : 1 + Math.floor(lv / 2)) + this.stats.amount;
    const damage = (evolved ? 64 : 26 + lv * 9) * this.stats.might;
    const blastRadius = (evolved ? 88 : 56 + lv * 6) * this.stats.area;

    gothicAudio.playThunder();

    for (let i = 0; i < strikes; i++) {
      const pick = inRange[Phaser.Math.Between(0, inRange.length - 1)];
      if (!pick) continue;
      const tx = pick.x;
      const ty = pick.y;

      this.time.delayedCall(i * 85, () => {
        if (this.isSimulationPaused()) return;
        const bolt = this.add
          .image(tx, ty - 105, 'vfx_lightning')
          .setDepth(22)
          .setScale(evolved ? 1.35 : 1, 1.1)
          .setTint(evolved ? 0xffb74d : 0xffffff)
          .setBlendMode(Phaser.BlendModes.ADD);

        const ring = this.add
          .image(tx, ty, 'vfx_aura_ring')
          .setDepth(5)
          .setScale(0.15)
          .setTint(evolved ? 0xff9e44 : 0xff4d6d)
          .setBlendMode(Phaser.BlendModes.ADD);

        this.tweens.add({
          targets: bolt,
          alpha: 0,
          scaleX: 0.25,
          duration: 220,
          onComplete: () => bolt.destroy(),
        });
        this.tweens.add({
          targets: ring,
          displayWidth: blastRadius * 2,
          displayHeight: blastRadius * 2,
          alpha: 0,
          duration: 300,
          ease: 'Cubic.easeOut',
          onComplete: () => ring.destroy(),
        });

        const victims = this.grid.queryRadius(tx, ty, blastRadius);
        for (const v of victims) {
          this.damageEnemy(v, damage, 0, -60, evolved, 0);
        }
      });
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.sprite.setPosition(p.x, p.y);
      if (p.spinSpeed !== 0) {
        p.sprite.rotation += p.spinSpeed * dt;
      }

      const hits = this.grid.queryRadius(p.x, p.y, p.radius);
      for (let h = 0; h < hits.length; h++) {
        const enemy = hits[h];
        if (p.hitIds.has(enemy.id)) continue;
        p.hitIds.add(enemy.id);
        p.pierce -= 1;

        const norm = Math.hypot(p.vx, p.vy) || 1;
        this.damageEnemy(
          enemy,
          p.crit ? p.damage * 1.45 : p.damage,
          (p.vx / norm) * 145,
          (p.vy / norm) * 145,
          p.crit,
          p.lifeSteal
        );
        if (p.pierce <= 0) break;
      }

      if (p.life <= 0 || p.pierce <= 0) {
        p.sprite.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateEnemies(time: number, dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.active) {
        this.enemies.splice(i, 1);
        continue;
      }
      if (e.dying) continue;

      // Despawn regular enemies if way too far off-screen, reposition closer
      const dxHero = this.heroX - e.x;
      const dyHero = this.heroY - e.y;
      const distHero = Math.hypot(dxHero, dyHero) || 1;
      if (!e.def.isBoss && distHero > 1050) {
        const angle = Math.random() * Math.PI * 2;
        e.x = this.heroX + Math.cos(angle) * 620;
        e.y = this.heroY + Math.sin(angle) * 460;
        continue;
      }

      // 1. Emergence Transition (0 -> 1)
      if (e.spawnProgress < 1) {
        e.spawnProgress = Math.min(1, e.spawnProgress + dt * 2.9);
      }

      // 2. Steering + Boss Lunge Behavior
      let moveSpeed = e.def.speed;
      let dirX = dxHero / distHero;
      let dirY = dyHero / distHero;

      if (e.kind === 'bat') {
        // Sinuous swooping flight
        const perpX = -dirY;
        const perpY = dirX;
        const wave = Math.sin(time * 0.006 + e.animSeed) * 0.42;
        dirX += perpX * wave;
        dirY += perpY * wave;
      } else if (e.def.isBoss) {
        e.bossChargeTimer -= dt;
        if (e.bossChargeTimer <= 0 && !e.bossCharging) {
          e.bossCharging = true;
          e.bossChargeTimer = 0.65;
          e.bossChargeDirX = dirX;
          e.bossChargeDirY = dirY;
          this.spawnRingBurst(e.x, e.y, 0xff2a55, 10);
        } else if (e.bossCharging) {
          dirX = e.bossChargeDirX;
          dirY = e.bossChargeDirY;
          moveSpeed *= 2.45;
          if (e.bossChargeTimer <= 0) {
            e.bossCharging = false;
            e.bossChargeTimer = 3.8;
          }
        }
      }

      // Soft horde separation via SpatialGrid so enemies form lush dense crowds!
      const neighbors = this.grid.queryRadius(e.x, e.y, e.radius * 1.6);
      let sepX = 0;
      let sepY = 0;
      const checkCap = Math.min(6, neighbors.length);
      for (let n = 0; n < checkCap; n++) {
        const other = neighbors[n];
        if (other.id === e.id) continue;
        const sdx = e.x - other.x;
        const sdy = e.y - other.y;
        const dSq = sdx * sdx + sdy * sdy;
        const minSep = e.radius + other.radius;
        if (dSq > 0.01 && dSq < minSep * minSep) {
          const d = Math.sqrt(dSq);
          const push = (minSep - d) / minSep;
          sepX += (sdx / d) * push * 85;
          sepY += (sdy / d) * push * 85;
        }
      }

      e.knockVx = Phaser.Math.Linear(e.knockVx, 0, Math.min(1, 9 * dt));
      e.knockVy = Phaser.Math.Linear(e.knockVy, 0, Math.min(1, 9 * dt));

      e.vx = dirX * moveSpeed + sepX + e.knockVx;
      e.vy = dirY * moveSpeed + sepY + e.knockVy;
      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // 3. Visual State, Hit Flash & Elastic Squash/Stretch
      const emergeEase = 1 - Math.pow(1 - e.spawnProgress, 3);
      let sx = e.def.scale * (0.45 + 0.55 * emergeEase);
      let sy = e.def.scale * (0.15 + 0.85 * emergeEase);

      if (e.squashTimer > 0) {
        e.squashTimer = Math.max(0, e.squashTimer - dt);
        const sq = e.squashTimer / 0.14;
        sx *= 1 + 0.24 * sq;
        sy *= 1 - 0.19 * sq;
      } else {
        const stride = Math.sin(time * 0.01 + e.animSeed) * 0.04;
        sx *= 1 + stride;
        sy *= 1 - stride;
      }

      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        e.sprite.setTintFill(0xffffff);
      } else if (e.spawnProgress < 1) {
        e.sprite.setTint(0x7c5a8a);
      } else {
        e.sprite.clearTint();
      }

      e.sprite
        .setPosition(e.x, e.y)
        .setScale(sx, sy)
        .setAlpha(emergeEase)
        .setFlipX(dxHero < 0)
        .setRotation((dxHero >= 0 ? 1 : -1) * 0.04 * Math.sin(time * 0.008 + e.animSeed));

      e.shadow
        .setPosition(e.x, e.y + 16 * e.def.scale)
        .setAlpha(0.55 * emergeEase);

      // 4. Contact Damage vs Hero
      if (e.spawnProgress >= 0.85 && this.invulnTimer <= 0) {
        const hitDist = e.radius + 14;
        if (dxHero * dxHero + dyHero * dyHero <= hitDist * hitDist) {
          this.damageHero(e.def.damage);
        }
      }
    }
  }

  private damageEnemy(
    enemy: EnemyRuntime,
    rawAmount: number,
    knockX: number,
    knockY: number,
    isCrit: boolean,
    lifeSteal: number
  ): void {
    if (!enemy.active || enemy.dying) return;
    const dmg = Math.max(1, Math.round(rawAmount));
    enemy.hp -= dmg;
    enemy.hitFlashTimer = 0.065;
    enemy.squashTimer = 0.14;

    const resist = enemy.def.knockbackResist;
    enemy.knockVx += knockX * (1 - resist);
    enemy.knockVy += knockY * (1 - resist);

    gothicAudio.playHit();
    this.spawnFloatingDamage(enemy.x, enemy.y - 14 * enemy.def.scale, dmg, isCrit);

    if (lifeSteal > 0 && this.hp < this.stats.maxHp) {
      this.hp = Math.min(this.stats.maxHp, this.hp + lifeSteal);
    }

    if (enemy.hp <= 0) {
      this.killEnemyElegantly(enemy);
    }
  }

  private killEnemyElegantly(enemy: EnemyRuntime): void {
    enemy.dying = true;
    this.kills += 1;
    this.inventory.souls += enemy.def.isBoss ? 50 : 1;

    // Drop XP Gem (and Golden Relic Chest if Boss!)
    this.spawnXpGem(enemy.x, enemy.y, enemy.def.xpValue, enemy.def.gemTier);
    if (enemy.def.isBoss) {
      this.spawnRelicChest(enemy.x, enemy.y);
      this.cameras.main.shake(420, 0.009);
      this.spawnRingBurst(enemy.x, enemy.y, 0xffd166, 28);

      if (enemy.kind === 'reaper') {
        this.time.delayedCall(650, () => this.finishRun(true));
      }
    }

    // Dissolve transition: crimson-ash stretch + rising soul ember
    enemy.sprite.stop();
    enemy.sprite.setTint(0xff3b6b);
    this.spawnDeathEmbers(enemy.x, enemy.y, enemy.def.isBoss ? 14 : 4);

    this.tweens.add({
      targets: enemy.sprite,
      scaleX: enemy.def.scale * 0.25,
      scaleY: enemy.def.scale * 1.45,
      y: enemy.y - 18,
      alpha: 0,
      duration: 240,
      ease: 'Quad.easeOut',
      onComplete: () => {
        enemy.sprite.destroy();
        enemy.shadow.destroy();
        enemy.active = false;
      },
    });
    this.tweens.add({
      targets: enemy.shadow,
      alpha: 0,
      duration: 200,
    });
  }

  private spawnXpGem(
    x: number,
    y: number,
    xpValue: number,
    tier: 'sapphire' | 'amber' | 'ruby'
  ): void {
    // Cap ground gems gracefully by merging into nearby gem if count is huge
    if (this.gems.length > 340) {
      const existing = this.gems[this.gems.length - 1];
      existing.xpValue += xpValue;
      existing.sprite.setTexture('gem_ruby');
      return;
    }

    const key = `gem_${tier}`;
    const sprite = this.add.image(x, y, key).setDepth(5).setScale(0.2);

    this.tweens.add({
      targets: sprite,
      scaleX: 0.92,
      scaleY: 0.92,
      y: { from: y - 10, to: y },
      duration: 260,
      ease: 'Back.easeOut',
    });

    this.gems.push({
      sprite,
      x,
      y,
      xpValue,
      magnetized: false,
      magnetTime: 0,
      originX: x,
      originY: y,
      bobSeed: Math.random() * Math.PI * 2,
    });
  }

  private spawnRelicChest(x: number, y: number): void {
    const glow = this.add
      .image(x, y, 'vfx_aura_ring')
      .setDepth(5)
      .setScale(0.45)
      .setTint(0xffd166)
      .setBlendMode(Phaser.BlendModes.ADD);
    const sprite = this.add.image(x, y - 24, 'relic_chest').setDepth(12).setScale(0.3);

    this.tweens.add({
      targets: sprite,
      y,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 450,
      ease: 'Bounce.easeOut',
    });

    this.chests.push({ sprite, glow, x, y, pulse: 0 });
  }

  private updateGemsAndChests(time: number, dt: number): void {
    const magnetSq = this.stats.magnet * this.stats.magnet;

    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const dx = this.heroX - g.x;
      const dy = this.heroY - g.y;
      const dSq = dx * dx + dy * dy;

      if (!g.magnetized && dSq <= magnetSq) {
        g.magnetized = true;
        g.magnetTime = 0;
        g.originX = g.x;
        g.originY = g.y;
      }

      if (g.magnetized) {
        g.magnetTime += dt;
        if (g.magnetTime < 0.11) {
          // Signature Vampire Survivors initial pull-back kick!
          const dist = Math.sqrt(dSq) || 1;
          g.x -= (dx / dist) * 120 * dt;
          g.y -= (dy / dist) * 120 * dt;
        } else {
          const speed = 360 + (g.magnetTime - 0.11) * 950;
          const dist = Math.sqrt(dSq) || 1;
          g.x += (dx / dist) * speed * dt;
          g.y += (dy / dist) * speed * dt;
        }
        g.sprite.setPosition(g.x, g.y);

        if (dSq <= 22 * 22) {
          g.sprite.destroy();
          this.gems.splice(i, 1);
          this.collectXp(g.xpValue);
        }
      } else {
        g.sprite.y = g.y + Math.sin(time * 0.005 + g.bobSeed) * 2.2;
      }
    }

    for (let i = this.chests.length - 1; i >= 0; i--) {
      const c = this.chests[i];
      c.pulse += dt * 3.5;
      c.glow.setScale(0.42 + Math.sin(c.pulse) * 0.06).setRotation(c.pulse * 0.25);

      const dx = this.heroX - c.x;
      const dy = this.heroY - c.y;
      if (dx * dx + dy * dy <= 34 * 34) {
        c.sprite.destroy();
        c.glow.destroy();
        this.chests.splice(i, 1);
        this.openRelicChestModal();
      }
    }
  }

  private collectXp(amount: number): void {
    gothicAudio.playGem();
    this.inventory.xp += amount;

    if (this.inventory.xp >= this.inventory.xpToNext) {
      this.inventory.xp -= this.inventory.xpToNext;
      this.inventory.level += 1;
      this.inventory.xpToNext = xpRequiredForLevel(this.inventory.level);
      this.triggerLevelUpCeremony();
    }
  }

  private triggerLevelUpCeremony(): void {
    this.modalPaused = true;
    gothicAudio.playLevelUp();
    this.spawnRingBurst(this.heroX, this.heroY, 0xffd166, 22);

    // Gentle shockwave pushes crowding enemies slightly back on level-up
    const nearby = this.grid.queryRadius(this.heroX, this.heroY, 150);
    for (const e of nearby) {
      const a = Math.atan2(e.y - this.heroY, e.x - this.heroX);
      e.knockVx += Math.cos(a) * 180;
      e.knockVy += Math.sin(a) * 180;
    }

    const choices = buildUpgradeChoices(this.inventory, 3);
    this.pushHudUpdate();

    this.callbacks?.onLevelUpChoices(choices, (picked) => {
      const prevMaxHp = this.stats.maxHp;
      const res = applyUpgradeChoice(this.inventory, picked);
      this.stats = computeEffectiveStats(this.inventory);
      const hpDelta = Math.max(0, this.stats.maxHp - prevMaxHp);
      this.hp = Math.min(this.stats.maxHp, this.hp + hpDelta + res.healedHp);
      this.modalPaused = false;
      this.pushHudUpdate();
    });
  }

  private openRelicChestModal(): void {
    this.modalPaused = true;
    gothicAudio.playChest();
    const reward = resolveRelicChest(this.inventory);
    const prevMaxHp = this.stats.maxHp;
    const res = applyUpgradeChoice(this.inventory, reward);
    this.stats = computeEffectiveStats(this.inventory);
    const hpDelta = Math.max(0, this.stats.maxHp - prevMaxHp);
    this.hp = Math.min(this.stats.maxHp, this.hp + hpDelta + res.healedHp);

    if (res.evolvedWeapon) {
      this.spawnRingBurst(this.heroX, this.heroY, 0xff2a55, 32);
    }
    this.pushHudUpdate();

    this.callbacks?.onRelicChestOpen(reward, () => {
      this.modalPaused = false;
      this.pushHudUpdate();
    });
  }

  private damageHero(rawDamage: number): void {
    if (this.invulnTimer > 0 || this.runEnded) return;
    const netDamage = Math.max(1, rawDamage - this.stats.armor);
    this.hp = Math.max(0, this.hp - netDamage);
    this.invulnTimer = 0.52;

    gothicAudio.playHurt();
    this.cameras.main.shake(160, 0.0045);
    this.spawnDeathEmbers(this.heroX, this.heroY, 8);
    this.pushHudUpdate();

    if (this.hp <= 0) {
      this.finishRun(false);
    }
  }

  private finishRun(victory: boolean): void {
    if (this.runEnded) return;
    this.runEnded = true;
    this.pushHudUpdate();

    if (!victory) {
      this.heroSprite.stop();
      this.heroSprite.setTint(0xff2a55);
      this.tweens.add({
        targets: this.heroSprite,
        alpha: 0.25,
        angle: -35,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 620,
        ease: 'Cubic.easeOut',
      });
    }

    this.time.delayedCall(680, () => {
      this.callbacks?.onRunEnded({
        victory,
        heroId: this.heroId,
        elapsedSeconds: this.elapsedSeconds,
        level: this.inventory.level,
        kills: this.kills,
        souls: this.inventory.souls,
        inventory: this.inventory,
      });
    });
  }

  private drawHeroHpBar(): void {
    this.trailingHp = Phaser.Math.Linear(this.trailingHp, this.hp, 0.14);
    const barW = 46;
    const barH = 5;
    const bx = this.heroX - barW / 2;
    const by = this.heroY + 30;

    this.hpBarGraphics.clear();
    this.hpBarGraphics.fillStyle(0x0d090e, 0.85);
    this.hpBarGraphics.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

    const trailRatio = Phaser.Math.Clamp(this.trailingHp / this.stats.maxHp, 0, 1);
    this.hpBarGraphics.fillStyle(0xffbe5c, 0.85);
    this.hpBarGraphics.fillRect(bx, by, barW * trailRatio, barH);

    const hpRatio = Phaser.Math.Clamp(this.hp / this.stats.maxHp, 0, 1);
    this.hpBarGraphics.fillStyle(0xd91e36, 1);
    this.hpBarGraphics.fillRect(bx, by, barW * hpRatio, barH);
  }

  private spawnFloatingDamage(x: number, y: number, amount: number, isCrit: boolean): void {
    const label = this.add
      .text(x + Phaser.Math.Between(-8, 8), y, `${amount}`, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: isCrit ? '17px' : '13px',
        fontStyle: 'bold',
        color: isCrit ? '#ffd166' : '#f4eff4',
        stroke: '#140812',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.tweens.add({
      targets: label,
      y: y - (isCrit ? 32 : 22),
      alpha: 0,
      scaleX: isCrit ? 1.2 : 0.95,
      scaleY: isCrit ? 1.2 : 0.95,
      duration: 460,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private spawnFootstepDust(x: number, y: number): void {
    const p = this.add
      .image(x + Phaser.Math.Between(-5, 5), y, 'vfx_particle')
      .setDepth(4)
      .setScale(0.45)
      .setTint(0x8c7b6b)
      .setAlpha(0.42);
    this.tweens.add({
      targets: p,
      y: y - 8,
      scaleX: 0.9,
      scaleY: 0.9,
      alpha: 0,
      duration: 280,
      onComplete: () => p.destroy(),
    });
  }

  private spawnDeathEmbers(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Phaser.Math.Between(14, 38);
      const p = this.add
        .image(x, y, 'vfx_particle')
        .setDepth(19)
        .setScale(Phaser.Math.FloatBetween(0.4, 0.85))
        .setTint(i % 2 === 0 ? 0xff4d6d : 0xffd166)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 14,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: Phaser.Math.Between(240, 420),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private spawnRingBurst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const p = this.add
        .image(x, y, 'vfx_particle')
        .setDepth(20)
        .setScale(0.75)
        .setTint(color)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * 58,
        y: y + Math.sin(angle) * 58,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 380,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private currentPhaseName(): string {
    if (this.elapsedSeconds < 90) return 'I · Crepúsculo Cinzento';
    if (this.elapsedSeconds < 210) return 'II · Névoa das Dríades';
    if (this.elapsedSeconds < 360) return 'III · Vigília Carmesim';
    return 'IV · Eclipse Total';
  }

  private pushHudUpdate(): void {
    let activeBoss: EnemyRuntime | undefined;
    for (const e of this.enemies) {
      if (e.active && !e.dying && e.def.isBoss) {
        activeBoss = e;
        break;
      }
    }

    this.callbacks?.onHudUpdate({
      hp: Math.ceil(this.hp),
      maxHp: this.stats.maxHp,
      xp: this.inventory.xp,
      xpToNext: this.inventory.xpToNext,
      level: this.inventory.level,
      elapsedSeconds: this.elapsedSeconds,
      kills: this.kills,
      souls: this.inventory.souls,
      dashReadyRatio: 1 - Phaser.Math.Clamp(this.dashCooldownTimer / 2.8, 0, 1),
      phaseName: this.currentPhaseName(),
      inventory: this.inventory,
      boss: activeBoss
        ? {
            name: activeBoss.def.name,
            hp: Math.max(0, Math.ceil(activeBoss.hp)),
            maxHp: activeBoss.maxHp,
          }
        : undefined,
    });
  }
}
