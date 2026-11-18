import Phaser from 'phaser';
import {
  forgeAllTexturesAndAnims,
  forgeStageTextures,
  preloadAllSpriteAssets,
} from '../art/SpriteForge';
import { gothicAudio } from '../audio/GothicAudio';
import {
  ENEMIES,
  EnemyDefinition,
  EnemyKind,
  HEROES,
  HeroId,
  HeroStats,
  StageDefinition,
  StageId,
  STAGES,
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
  stageDurationSeconds: number;
  kills: number;
  souls: number;
  dashReadyRatio: number;
  stageName: string;
  stageRoman: string;
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
  stageId: StageId;
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
  isFinalStageBoss: boolean;
  spawnProgress: number;
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
  accelX: number;
  accelY: number;
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

interface FirePoolRuntime {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  tickTimer: number;
  homing: boolean;
}

interface GemRuntime {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  xpValue: number;
  magnetized: boolean;
  magnetTime: number;
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

export class ArenaScene extends Phaser.Scene {
  private callbacks!: ArenaCallbacks;
  private heroId: HeroId = 'alaric';
  private stageDef: StageDefinition = STAGES[0];
  private inventory!: InventoryState;
  private stats!: HeroStats;

  // World & Atmosphere
  private groundBg!: Phaser.GameObjects.TileSprite;
  private roadBg!: Phaser.GameObjects.TileSprite;
  private ambientOverlay!: Phaser.GameObjects.Rectangle;
  private fogWisps: Array<{ sprite: Phaser.GameObjects.Image; vx: number; vy: number }> = [];
  private props: PropRuntime[] = [];
  private ambientEmberTimer = 0;

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
  private aimX = 1;
  private aimY = 0;
  private hp = 125;
  private trailingHp = 125;
  private invulnTimer = 0;
  private dashCooldownTimer = 0;
  private dashActiveTimer = 0;
  private dashDirX = 1;
  private dashDirY = 0;
  private dustStepTimer = 0;

  // Entities
  private nextEnemyId = 1;
  private enemies: EnemyRuntime[] = [];
  private projectiles: ProjectileRuntime[] = [];
  private firePools: FirePoolRuntime[] = [];
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
  private spawnedMilestones = new Set<string>();
  private weaponTimers: Record<string, number> = {};
  private hudSyncTimer = 0;

  // Controls & Flags
  private modalPaused = false;
  private userPaused = false;
  private runEnded = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private virtualMoveX = 0;
  private virtualMoveY = 0;

  constructor() {
    super({ key: 'ArenaScene' });
  }

  configureRun(heroId: HeroId, stageId: StageId, callbacks: ArenaCallbacks): void {
    this.heroId = heroId;
    this.stageDef = STAGES.find((s) => s.id === stageId) ?? STAGES[0];
    this.callbacks = callbacks;
  }

  setVirtualJoystick(dx: number, dy: number): void {
    this.virtualMoveX = dx;
    this.virtualMoveY = dy;
  }

  triggerDash(): void {
    if (this.isSimulationPaused() || this.dashCooldownTimer > 0) return;
    this.dashCooldownTimer = 2.6;
    this.dashActiveTimer = 0.22;
    this.invulnTimer = Math.max(this.invulnTimer, 0.34);

    this.dashDirX = this.aimX;
    this.dashDirY = this.aimY;

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

  preload(): void {
    preloadAllSpriteAssets(this);
  }

  create(): void {
    forgeAllTexturesAndAnims(this);
    const envKeys = forgeStageTextures(this, this.stageDef);

    this.enemies = [];
    this.projectiles = [];
    this.firePools = [];
    this.gems = [];
    this.chests = [];
    this.orbitalSprites = [];
    this.props = [];
    this.fogWisps = [];
    this.orbitalHitCooldowns.clear();
    this.spawnedMilestones.clear();

    this.inventory = createInitialInventory(this.heroId);
    this.stats = computeEffectiveStats(this.inventory);
    this.hp = this.stats.maxHp;
    this.trailingHp = this.hp;
    this.heroX = 0;
    this.heroY = 0;
    this.heroVx = 0;
    this.heroVy = 0;
    this.facing = 1;
    this.aimX = 1;
    this.aimY = 0;
    this.elapsedSeconds = 0;
    this.kills = 0;
    this.spawnAccumulator = 0;
    this.invulnTimer = 0;
    this.dashCooldownTimer = 0;
    this.dashActiveTimer = 0;
    this.modalPaused = false;
    this.userPaused = false;
    this.runEnded = false;

    this.weaponTimers = {
      whip: 0.25,
      wand: 0.2,
      axe: 0.55,
      lightning: 0.9,
      daggers: 0.2,
      flask: 0.7,
      cross: 0.35,
    };

    const { width, height } = this.scale;

    // 1. Stage-Specific Infinite Ground & Central Road
    this.groundBg = this.add
      .tileSprite(width / 2, height / 2, width + 512, height + 512, envKeys.groundKey)
      .setScrollFactor(0)
      .setDepth(-30);

    this.roadBg = this.add
      .tileSprite(width / 2, height / 2, 168, height + 512, envKeys.roadKey)
      .setScrollFactor(0)
      .setDepth(-28);

    this.initWorldProps(envKeys.propKeys);

    // 2. Thurible Sanctuary Aura
    this.thuribleAura = this.add
      .image(0, 0, 'vfx_aura_ring')
      .setDepth(2)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);

    // 3. Upgraded Hero Shadow & Animated Sprite
    this.heroShadow = this.add.image(0, 38, 'vfx_shadow').setDepth(4).setScale(1.22, 0.95);
    this.heroSprite = this.add
      .sprite(0, 0, `hero_${this.heroId}`, 0)
      .setDepth(10)
      .setScale(0.1);
    this.heroSprite.play(`hero_${this.heroId}_walk`);

    this.tweens.add({
      targets: this.heroSprite,
      scaleX: 0.82,
      scaleY: 0.82,
      duration: 500,
      ease: 'Back.easeOut',
    });
    this.spawnRingBurst(0, 0, HEROES[this.heroId].accentColor, 18);

    this.hpBarGraphics = this.add.graphics().setDepth(25);

    // 4. Stage Fog & Lighting
    for (let i = 0; i < 8; i++) {
      const wisp = this.add
        .image(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), 'vfx_fog')
        .setScrollFactor(0)
        .setDepth(40)
        .setTint(this.stageDef.palette.fogColor)
        .setScale(Phaser.Math.FloatBetween(1.8, 3.2))
        .setAlpha(Phaser.Math.FloatBetween(0.14, 0.3))
        .setBlendMode(Phaser.BlendModes.SCREEN);
      this.fogWisps.push({
        sprite: wisp,
        vx: Phaser.Math.FloatBetween(12, 28),
        vy: Phaser.Math.FloatBetween(-5, 6),
      });
    }

    this.ambientOverlay = this.add
      .rectangle(
        width / 2,
        height / 2,
        width + 64,
        height + 64,
        this.stageDef.palette.ambientStart,
        0.14
      )
      .setScrollFactor(0)
      .setDepth(42)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    const cam = this.cameras.main;
    cam.centerOn(0, 0);

    // 5. Keyboard Bindings & Clean Shutdown Lifecycle
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
      this.input.keyboard?.removeAllListeners();
    });
    if (this.input.keyboard) {
      this.input.keyboard.removeAllListeners();
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.input.keyboard.on('keydown-SPACE', () => this.triggerDash());
      this.input.keyboard.on('keydown-ESC', () => this.toggleUserPause());
      this.input.keyboard.on('keydown-P', () => this.toggleUserPause());
    }

    this.scale.off('resize', this.handleResize, this);
    this.scale.on('resize', this.handleResize, this);
    this.handleResize(this.scale.gameSize);

    // Initial wave from this stage's native enemy pool
    const starterKind = this.stageDef.enemyPool[0];
    for (let i = 0; i < 8; i++) {
      this.spawnEnemyAroundHero(starterKind);
    }

    this.callbacks?.onBannerAnnouncement(
      `Fase ${this.stageDef.roman} · ${this.stageDef.name}`,
      this.stageDef.subtitle
    );
    this.pushHudUpdate();
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    if (!this.scene.isActive()) return;
    const w = gameSize.width;
    const h = gameSize.height;
    if (this.groundBg && this.groundBg.scene) {
      this.groundBg.setPosition(w / 2, h / 2).setSize(w + 512, h + 512);
    }
    if (this.ambientOverlay && this.ambientOverlay.scene) {
      this.ambientOverlay.setPosition(w / 2, h / 2).setSize(w + 64, h + 64);
    }
  }

  private initWorldProps(propKeys: [string, string, string]): void {
    for (let i = 0; i < 34; i++) {
      const key = propKeys[i % 3];
      let px = Phaser.Math.Between(-1200, 1200);
      const py = Phaser.Math.Between(-1200, 1200);
      if (Math.abs(px) < 125) px += px >= 0 ? 150 : -150;

      const sprite = this.add.image(px, py, key).setDepth(3);
      let glow: Phaser.GameObjects.Image | undefined;
      if (i % 3 === 2) {
        glow = this.add
          .image(px, py - 10, 'vfx_particle')
          .setScale(7)
          .setTint(this.stageDef.palette.emberTint)
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
    this.updateFirePools(time, dt);
    this.updateProjectiles(dt);
    this.updateEnemies(time, dt);
    this.updateGemsAndChests(time, dt);
    this.drawHeroHpBar();

    if (this.hp > 0 && this.hp < this.stats.maxHp) {
      this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.1) {
      this.hudSyncTimer = 0;
      this.pushHudUpdate();
    }

    if (
      this.elapsedSeconds >= this.stageDef.durationSeconds &&
      !this.spawnedMilestones.has('final_boss')
    ) {
      this.spawnedMilestones.add('final_boss');
      const finalDef = ENEMIES[this.stageDef.finalBoss];
      this.spawnBoss(
        this.stageDef.finalBoss,
        finalDef.name,
        'Derrote o Guardião da Região para conquistar esta Fase!',
        true
      );
    }
  }

  private updateHeroMovementAndAnims(time: number, dt: number): void {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);
    }

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
    if (inputLen > 0.12) {
      this.aimX = inputX / (inputLen || 1);
      this.aimY = inputY / (inputLen || 1);
    }

    if (this.dashActiveTimer > 0) {
      this.dashActiveTimer -= dt;
      const dashSpeed = this.stats.moveSpeed * 2.85;
      this.heroVx = this.dashDirX * dashSpeed;
      this.heroVy = this.dashDirY * dashSpeed;

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
    this.heroShadow.setPosition(this.heroX, this.heroY + 38);

    const targetTilt = (this.heroVx / this.stats.moveSpeed) * 0.065;
    this.heroSprite.rotation = Phaser.Math.Linear(this.heroSprite.rotation, targetTilt, 10 * dt);

    if (speedRatio > 0.15) {
      this.heroSprite.anims.timeScale = 0.85 + speedRatio * 0.65;
      const stridePulse = Math.sin(time * 0.016) * 0.036 * speedRatio;
      this.heroSprite.setScale(0.82 - stridePulse, 0.82 + stridePulse);

      this.dustStepTimer -= dt;
      if (this.dustStepTimer <= 0) {
        this.dustStepTimer = 0.18;
        this.spawnFootstepDust(this.heroX, this.heroY + 36);
      }
    } else {
      this.heroSprite.anims.timeScale = 0.35;
      const breath = Math.sin(time * 0.004) * 0.02;
      this.heroSprite.setScale(0.82 + breath * 0.5, 0.82 - breath);
    }

    if (this.invulnTimer > 0 && this.dashActiveTimer <= 0) {
      this.heroSprite.setAlpha(Math.sin(time * 0.045) > 0 ? 1 : 0.45);
    } else {
      this.heroSprite.setAlpha(1);
    }
  }

  private updateCameraAndScenery(time: number, dt: number): void {
    const cam = this.cameras.main;
    const lookAheadX = this.heroVx * 0.2;
    const lookAheadY = this.heroVy * 0.2;
    const targetCamX = this.heroX + lookAheadX - cam.width / 2;
    const targetCamY = this.heroY + lookAheadY - cam.height / 2;

    cam.scrollX = Phaser.Math.Linear(cam.scrollX, targetCamX, Math.min(1, 6.5 * dt));
    cam.scrollY = Phaser.Math.Linear(cam.scrollY, targetCamY, Math.min(1, 6.5 * dt));

    this.groundBg.tilePositionX = cam.scrollX;
    this.groundBg.tilePositionY = cam.scrollY;

    const roadScreenX = 0 - cam.scrollX;
    this.roadBg.setPosition(roadScreenX, cam.height / 2);
    this.roadBg.tilePositionY = cam.scrollY;

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
        if (Math.abs(p.x) < 125) p.x += p.x >= 0 ? 145 : -145;
        p.sprite.setPosition(p.x, p.y);
      }
      if (p.glow) {
        p.glow.setPosition(p.x, p.y - 12);
        p.glow.setAlpha(0.22 + Math.sin(time * 0.008 + i) * 0.07);
      }
    }

    for (const w of this.fogWisps) {
      w.sprite.x += w.vx * dt;
      w.sprite.y += w.vy * dt;
      if (w.sprite.x > cam.width + 180) w.sprite.x = -180;
      if (w.sprite.y < -120) w.sprite.y = cam.height + 120;
      if (w.sprite.y > cam.height + 120) w.sprite.y = -120;
    }

    // Floating Stage Embers / Ash / Hellfire sparks
    this.ambientEmberTimer -= dt;
    if (this.ambientEmberTimer <= 0) {
      this.ambientEmberTimer = 0.22;
      const ex = cam.scrollX + Phaser.Math.Between(0, cam.width);
      const ey = cam.scrollY + cam.height + 10;
      const spark = this.add
        .image(ex, ey, 'vfx_particle')
        .setDepth(35)
        .setScale(Phaser.Math.FloatBetween(0.3, 0.65))
        .setTint(this.stageDef.palette.emberTint)
        .setAlpha(0.75)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: spark,
        y: ey - Phaser.Math.Between(120, 260),
        x: ex + Phaser.Math.Between(-50, 50),
        alpha: 0,
        duration: Phaser.Math.Between(1400, 2400),
        onComplete: () => spark.destroy(),
      });
    }
  }

  private updateWaveDirector(dt: number): void {
    const t = this.elapsedSeconds;
    const dur = this.stageDef.durationSeconds;
    const progress = Math.min(1, t / dur);
    const maxActiveEnemies = Math.min(320, Math.round(45 + progress * 195));

    // Mid-boss around 38% of stage duration
    if (progress >= 0.38 && !this.spawnedMilestones.has('mid_boss')) {
      this.spawnedMilestones.add('mid_boss');
      const midDef = ENEMIES[this.stageDef.midBoss];
      this.spawnBoss(
        this.stageDef.midBoss,
        midDef.name,
        'Um Campeão das Trevas bloqueia sua passagem — abata-o pelo Relicário!',
        false
      );
    }

    // Horde encirclement surge around 68% of stage duration
    if (progress >= 0.68 && !this.spawnedMilestones.has('surge')) {
      this.spawnedMilestones.add('surge');
      const surgeKind = this.stageDef.enemyPool[2] ?? this.stageDef.enemyPool[0];
      this.callbacks?.onBannerAnnouncement(
        'Cerco Implacável',
        `Enxames de ${ENEMIES[surgeKind].name} fecham o círculo!`
      );
      this.spawnCircleWave(surgeKind, 22);
    }

    if (this.enemies.length >= maxActiveEnemies) return;

    const spawnsPerSecond = (2.7 + progress * 6.5) * (0.9 + this.stageDef.difficultyMult * 0.1);
    this.spawnAccumulator += spawnsPerSecond * dt;

    while (this.spawnAccumulator >= 1 && this.enemies.length < maxActiveEnemies) {
      this.spawnAccumulator -= 1;
      const pool = this.stageDef.enemyPool;
      let idx = 0;
      const r = Math.random();
      if (progress < 0.25) {
        idx = r < 0.7 ? 0 : 1;
      } else if (progress < 0.55) {
        idx = r < 0.35 ? 0 : r < 0.75 ? 1 : 2;
      } else {
        idx = r < 0.2 ? 0 : r < 0.5 ? 1 : r < 0.8 ? 2 : 3;
      }
      const kind = pool[Math.min(pool.length - 1, idx)];
      this.spawnEnemyAroundHero(kind);
    }
  }

  private spawnCircleWave(kind: EnemyKind, count: number): void {
    const cam = this.cameras.main;
    const dist = Math.hypot(cam.width, cam.height) * 0.5;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.spawnEnemyAt(
        kind,
        this.heroX + Math.cos(angle) * dist,
        this.heroY + Math.sin(angle) * dist,
        false
      );
    }
  }

  private spawnBoss(
    kind: EnemyKind,
    title: string,
    subtitle: string,
    isFinalStageBoss: boolean
  ): void {
    gothicAudio.playBossHorn();
    this.cameras.main.shake(360, 0.006);
    this.callbacks?.onBannerAnnouncement(title, subtitle);
    const angle = Math.random() * Math.PI * 2;
    this.spawnEnemyAt(
      kind,
      this.heroX + Math.cos(angle) * 420,
      this.heroY + Math.sin(angle) * 420,
      isFinalStageBoss
    );
  }

  private spawnEnemyAroundHero(kind: EnemyKind): void {
    const cam = this.cameras.main;
    const halfW = cam.width / 2 + 68;
    const halfH = cam.height / 2 + 68;
    const angle = Math.random() * Math.PI * 2;
    this.spawnEnemyAt(
      kind,
      this.heroX + Math.cos(angle) * halfW,
      this.heroY + Math.sin(angle) * halfH,
      false
    );
  }

  private spawnEnemyAt(
    kind: EnemyKind,
    x: number,
    y: number,
    isFinalStageBoss: boolean
  ): void {
    const def = ENEMIES[kind];
    const timeMult = 1 + this.elapsedSeconds * 0.0035;
    const scaledHp = Math.round(
      def.hp * this.stageDef.difficultyMult * (def.isBoss ? 1 : timeMult)
    );

    const shadow = this.add
      .image(x, y + (def.isBoss ? 52 : 30) * def.scale, 'vfx_shadow')
      .setDepth(3)
      .setScale(def.scale * 0.95, def.scale * 0.72)
      .setAlpha(0);

    const sprite = this.add
      .sprite(x, y, `enemy_${kind}`, Phaser.Math.Between(0, 3))
      .setDepth(def.isBoss ? 14 : 7)
      .setScale(def.scale * 0.25, def.scale * 0.1)
      .setAlpha(0)
      .setTint(0x2a1428);
    sprite.play(`enemy_${kind}_move`);

    const ripple = this.add
      .image(x, y + 14, 'vfx_particle')
      .setTint(def.isBoss ? 0xff2a55 : this.stageDef.palette.emberTint)
      .setScale(0.5)
      .setAlpha(0.62)
      .setDepth(3);
    this.tweens.add({
      targets: ripple,
      scaleX: def.isBoss ? 6 : 2.8,
      scaleY: def.isBoss ? 3 : 1.4,
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
      isFinalStageBoss,
      spawnProgress: 0,
      hitFlashTimer: 0,
      squashTimer: 0,
      animSeed: Math.random() * Math.PI * 2,
      auraContactTimer: 0,
      bossChargeTimer: 4.0,
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

  private rollCrit(force = false): boolean {
    return force || Math.random() < this.stats.critChance;
  }

  private updateWeapons(time: number, dt: number): void {
    const w = this.inventory.weapons;

    // 1. WHIP / BLOOD ROSE
    const whipLv = w.whip ?? 0;
    const hasBloodRose = Boolean(w.blood_rose);
    if (whipLv > 0 || hasBloodRose) {
      this.weaponTimers.whip -= dt;
      if (this.weaponTimers.whip <= 0) {
        const baseCd = hasBloodRose ? 0.85 : Math.max(0.92, 1.3 - whipLv * 0.08);
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
        const baseCd = hasStarTorrent ? 0.16 : Math.max(0.45, 0.84 - wandLv * 0.09);
        this.weaponTimers.wand = baseCd * this.stats.cooldown;
        this.fireWandBolts(wandLv, hasStarTorrent);
      }
    }

    // 3. BIBLE / IMMORTAL VESPER
    this.updateBibleOrbitals(time, dt, w.bible ?? 0, Boolean(w.immortal_vesper));

    // 4. AXE / ECLIPSE SCYTHE
    const axeLv = w.axe ?? 0;
    const hasEclipseScythe = Boolean(w.eclipse_scythe);
    if (axeLv > 0 || hasEclipseScythe) {
      this.weaponTimers.axe -= dt;
      if (this.weaponTimers.axe <= 0) {
        const baseCd = hasEclipseScythe ? 1.1 : Math.max(1.2, 1.8 - axeLv * 0.1);
        this.weaponTimers.axe = baseCd * this.stats.cooldown;
        this.fireAxesOrScythes(axeLv, hasEclipseScythe);
      }
    }

    // 5. THURIBLE / DEVOURING SHROUD
    this.updateThuribleAura(time, dt, w.thurible ?? 0, Boolean(w.devouring_shroud));

    // 6. LIGHTNING / SEVEN JUDGMENT
    const lightLv = w.lightning ?? 0;
    const hasSevenJudgment = Boolean(w.seven_judgment);
    if (lightLv > 0 || hasSevenJudgment) {
      this.weaponTimers.lightning -= dt;
      if (this.weaponTimers.lightning <= 0) {
        const baseCd = hasSevenJudgment ? 1.3 : Math.max(1.55, 2.45 - lightLv * 0.16);
        this.weaponTimers.lightning = baseCd * this.stats.cooldown;
        this.fireLightningStrikes(lightLv, hasSevenJudgment);
      }
    }

    // 7. NEW: PHANTOM DAGGERS / THOUSAND FANGS
    const daggersLv = w.daggers ?? 0;
    const hasThousandFangs = Boolean(w.thousand_fangs);
    if (daggersLv > 0 || hasThousandFangs) {
      this.weaponTimers.daggers -= dt;
      if (this.weaponTimers.daggers <= 0) {
        const baseCd = hasThousandFangs ? 0.22 : Math.max(0.55, 0.95 - daggersLv * 0.08);
        this.weaponTimers.daggers = baseCd * this.stats.cooldown;
        this.firePhantomDaggers(daggersLv, hasThousandFangs);
      }
    }

    // 8. NEW: HOLY ALCHEMICAL FLASK / PURIFYING TIDE
    const flaskLv = w.flask ?? 0;
    const hasPurifyingTide = Boolean(w.purifying_tide);
    if (flaskLv > 0 || hasPurifyingTide) {
      this.weaponTimers.flask -= dt;
      if (this.weaponTimers.flask <= 0) {
        const baseCd = hasPurifyingTide ? 1.8 : Math.max(2.1, 3.0 - flaskLv * 0.16);
        this.weaponTimers.flask = baseCd * this.stats.cooldown;
        this.fireAlchemicalFlasks(flaskLv, hasPurifyingTide);
      }
    }

    // 9. NEW: JUDGMENT CROSS / CELESTIAL BLADE
    const crossLv = w.cross ?? 0;
    const hasCelestialBlade = Boolean(w.celestial_blade);
    if (crossLv > 0 || hasCelestialBlade) {
      this.weaponTimers.cross -= dt;
      if (this.weaponTimers.cross <= 0) {
        const baseCd = hasCelestialBlade ? 1.05 : Math.max(1.15, 1.75 - crossLv * 0.1);
        this.weaponTimers.cross = baseCd * this.stats.cooldown;
        this.fireJudgmentCrosses(crossLv, hasCelestialBlade);
      }
    }
  }

  private fireWhipSlash(lv: number, evolved: boolean): void {
    gothicAudio.playWhip(evolved);
    const slashes = (evolved ? 2 : lv >= 2 ? 2 : 1) + Math.min(2, this.stats.amount);
    const baseDamage = (evolved ? 52 : 20 + lv * 7.5) * this.stats.might;
    const areaScale = (evolved ? 1.45 : 1 + lv * 0.08) * this.stats.area;

    for (let i = 0; i < slashes; i++) {
      const dir = i % 2 === 0 ? this.facing : -this.facing;
      const offsetY = i >= 2 ? (i % 2 === 0 ? -26 : 26) : -6 + i * 14;
      this.time.delayedCall(i * 75, () => {
        if (this.isSimulationPaused()) return;
        const sx = this.heroX + dir * (72 * areaScale);
        const sy = this.heroY + offsetY;

        const slash = this.add
          .image(sx, sy, 'vfx_whip_slash')
          .setDepth(18)
          .setFlipX(dir < 0)
          .setScale(0.2 * areaScale, 0.58 * areaScale)
          .setTint(evolved ? 0xff2a55 : 0xfff6dc)
          .setBlendMode(Phaser.BlendModes.ADD);

        this.tweens.add({
          targets: slash,
          scaleX: 1.18 * areaScale,
          scaleY: 1.1 * areaScale,
          alpha: { from: 1, to: 0 },
          duration: 210,
          ease: 'Cubic.easeOut',
          onComplete: () => slash.destroy(),
        });

        const reachX = 88 * areaScale;
        const reachY = 40 * areaScale;
        const candidates = this.grid.queryRadius(sx, sy, reachX);
        for (const enemy of candidates) {
          if (
            Math.abs(enemy.x - sx) <= reachX + enemy.radius &&
            Math.abs(enemy.y - sy) <= reachY + enemy.radius
          ) {
            const isCrit = this.rollCrit(evolved);
            this.damageEnemy(
              enemy,
              isCrit ? baseDamage * 1.55 : baseDamage,
              dir * 215,
              0,
              isCrit,
              evolved ? 1.6 : 0
            );
          }
        }
      });
    }
  }

  private fireWandBolts(lv: number, evolved: boolean): void {
    const nearest = this.grid.findNearest(this.heroX, this.heroY, 560);
    if (!nearest) return;

    const count = (evolved ? 1 : 1 + Math.floor(lv / 2)) + this.stats.amount;
    const damage = (evolved ? 28 : 15 + lv * 5.5) * this.stats.might;
    const pierce = evolved ? 3 : lv >= 3 ? 2 : 1;

    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * (evolved ? 42 : 72), () => {
        if (this.isSimulationPaused()) return;
        const target = this.grid.findNearest(this.heroX, this.heroY, 580) ?? nearest;
        const angle =
          Math.atan2(target.y - this.heroY, target.x - this.heroX) +
          Phaser.Math.FloatBetween(-0.06, 0.06);
        const speed = (evolved ? 560 : 430 + lv * 20) * this.stats.projSpeed;

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
          accelX: 0,
          accelY: 0,
          gravity: 0,
          spinSpeed: 0,
          damage,
          pierce,
          radius: 13 * this.stats.area,
          life: 1.5,
          crit: this.rollCrit(),
          lifeSteal: 0,
          hitIds: new Set(),
        });
      });
    }
  }

  private firePhantomDaggers(lv: number, evolved: boolean): void {
    const count = (evolved ? 3 : 2 + Math.floor(lv * 0.8)) + this.stats.amount;
    const damage = (evolved ? 30 : 14 + lv * 5) * this.stats.might;
    const baseAngle = Math.atan2(this.aimY, this.aimX);
    const speed = (evolved ? 680 : 520 + lv * 25) * this.stats.projSpeed;

    gothicAudio.playWand(true);
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.11;
      const angle = baseAngle + spread;
      const sprite = this.add
        .image(this.heroX, this.heroY - 4, 'vfx_dagger')
        .setDepth(16)
        .setScale(this.stats.area * (evolved ? 1.3 : 1.05))
        .setRotation(angle)
        .setTint(evolved ? 0xffffff : 0xcaf0f8)
        .setBlendMode(Phaser.BlendModes.ADD);

      this.projectiles.push({
        sprite,
        x: this.heroX,
        y: this.heroY - 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        accelX: 0,
        accelY: 0,
        gravity: 0,
        spinSpeed: 0,
        damage,
        pierce: evolved ? 4 : lv >= 3 ? 2 : 1,
        radius: 11 * this.stats.area,
        life: 1.15,
        crit: this.rollCrit(evolved && Math.random() < 0.45),
        lifeSteal: 0,
        hitIds: new Set(),
      });
    }
  }

  private fireAlchemicalFlasks(lv: number, evolved: boolean): void {
    const count = (evolved ? 3 : 1 + Math.floor(lv / 2)) + Math.min(2, this.stats.amount);
    const poolRadius = (evolved ? 95 : 54 + lv * 7) * this.stats.area;
    const poolDamage = (evolved ? 26 : 9 + lv * 3.8) * this.stats.might;
    const duration = evolved ? 4.4 : 2.8 + lv * 0.25;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.9;
      const dist = Phaser.Math.Between(90, 210);
      const tx = this.heroX + Math.cos(angle) * dist;
      const ty = this.heroY + Math.sin(angle) * dist;

      const bottle = this.add
        .image(this.heroX, this.heroY - 12, 'vfx_particle')
        .setDepth(19)
        .setScale(1.1)
        .setTint(evolved ? 0x00f5d4 : 0x52ff9a);

      this.tweens.add({
        targets: bottle,
        x: tx,
        y: ty,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 340,
        ease: 'Quad.easeOut',
        onComplete: () => {
          bottle.destroy();
          if (this.runEnded) return;
          const poolSprite = this.add
            .image(tx, ty, 'vfx_fire_pool')
            .setDepth(2)
            .setDisplaySize(20, 20)
            .setTint(evolved ? 0x00bbf9 : 0x52ff9a)
            .setBlendMode(Phaser.BlendModes.ADD);

          this.tweens.add({
            targets: poolSprite,
            displayWidth: poolRadius * 2,
            displayHeight: poolRadius * 2,
            duration: 240,
            ease: 'Back.easeOut',
          });

          this.firePools.push({
            sprite: poolSprite,
            x: tx,
            y: ty,
            radius: poolRadius,
            damage: poolDamage,
            life: duration,
            maxLife: duration,
            tickTimer: 0,
            homing: evolved,
          });
        },
      });
    }
  }

  private updateFirePools(time: number, dt: number): void {
    for (let i = this.firePools.length - 1; i >= 0; i--) {
      const fp = this.firePools[i];
      fp.life -= dt;
      fp.tickTimer -= dt;

      if (fp.homing) {
        const dx = this.heroX - fp.x;
        const dy = this.heroY - fp.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > 35) {
          fp.x += (dx / dist) * 42 * dt;
          fp.y += (dy / dist) * 42 * dt;
        }
      }

      fp.sprite
        .setPosition(fp.x, fp.y)
        .setRotation(time * 0.0018)
        .setAlpha(Math.min(0.75, (fp.life / 0.5) * 0.75));

      if (fp.tickTimer <= 0) {
        fp.tickTimer = 0.34;
        const victims = this.grid.queryRadius(fp.x, fp.y, fp.radius);
        for (const v of victims) {
          this.damageEnemy(v, fp.damage, 0, 0, false, 0);
        }
      }

      if (fp.life <= 0) {
        fp.sprite.destroy();
        this.firePools.splice(i, 1);
      }
    }
  }

  private fireJudgmentCrosses(lv: number, evolved: boolean): void {
    gothicAudio.playAxe();
    const count = (evolved ? 2 : lv >= 3 ? 2 : 1) + this.stats.amount;
    const damage = (evolved ? 48 : 20 + lv * 7) * this.stats.might;
    const nearest = this.grid.findNearest(this.heroX, this.heroY, 500);
    const baseAngle = nearest
      ? Math.atan2(nearest.y - this.heroY, nearest.x - this.heroX)
      : Math.atan2(this.aimY, this.aimX);

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i - (count - 1) / 2) * 0.35;
      const outSpeed = (340 + lv * 20) * this.stats.projSpeed;
      const vx = Math.cos(angle) * outSpeed;
      const vy = Math.sin(angle) * outSpeed;

      const sprite = this.add
        .image(this.heroX, this.heroY, evolved ? 'vfx_celestial_blade' : 'vfx_cross')
        .setDepth(17)
        .setScale(this.stats.area * (evolved ? 1.28 : 1.05))
        .setBlendMode(Phaser.BlendModes.ADD);

      // Accelerates smoothly in reverse for classic boomerang return!
      this.projectiles.push({
        sprite,
        x: this.heroX,
        y: this.heroY,
        vx,
        vy,
        accelX: -vx * 1.95,
        accelY: -vy * 1.95,
        gravity: 0,
        spinSpeed: 12,
        damage,
        pierce: 99,
        radius: (evolved ? 28 : 20) * this.stats.area,
        life: 2.3,
        crit: this.rollCrit(evolved),
        lifeSteal: 0,
        hitIds: new Set(),
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
    const damage = (evolved ? 34 : 14 + lv * 5) * this.stats.might;

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
    const damage = (evolved ? 56 : 29 + lv * 10) * this.stats.might;

    for (let i = 0; i < count; i++) {
      if (evolved) {
        const angle = (i / count) * Math.PI * 2 + this.elapsedSeconds * 0.9;
        const speed = 330 * this.stats.projSpeed;
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
          accelX: 0,
          accelY: 0,
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
          accelX: 0,
          accelY: 0,
          gravity: 780,
          spinSpeed: 9.5 * this.facing,
          damage,
          pierce: 3 + lv,
          radius: 21 * this.stats.area,
          life: 2.1,
          crit: this.rollCrit(Math.random() < 0.25),
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

    const radius = (evolved ? 132 : 70 + lv * 11) * this.stats.area;
    const pulse = 1 + Math.sin(time * 0.006) * 0.045;
    this.thuribleAura
      .setPosition(this.heroX, this.heroY + 4)
      .setDisplaySize(radius * 2 * pulse, radius * 2 * pulse)
      .setTint(evolved ? 0xff3b6b : 0x9ef7c6)
      .setAlpha(evolved ? 0.58 : 0.42)
      .setRotation(time * 0.0004);

    const tickDamage = (evolved ? 20 : 6.5 + lv * 3) * this.stats.might;
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
    const inRange = this.grid.queryRadius(this.heroX, this.heroY, 470);
    if (inRange.length === 0) return;

    const strikes = (evolved ? 4 : 1 + Math.floor(lv / 2)) + this.stats.amount;
    const damage = (evolved ? 66 : 28 + lv * 9) * this.stats.might;
    const blastRadius = (evolved ? 90 : 58 + lv * 6) * this.stats.area;

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
          this.damageEnemy(v, damage, 0, -60, this.rollCrit(evolved), 0);
        }
      });
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.vx += p.accelX * dt;
      p.vy += (p.accelY + p.gravity) * dt;
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
          p.crit ? p.damage * 1.55 : p.damage,
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

      const dxHero = this.heroX - e.x;
      const dyHero = this.heroY - e.y;
      const distHero = Math.hypot(dxHero, dyHero) || 1;
      if (!e.def.isBoss && distHero > 1050) {
        const angle = Math.random() * Math.PI * 2;
        e.x = this.heroX + Math.cos(angle) * 620;
        e.y = this.heroY + Math.sin(angle) * 460;
        continue;
      }

      if (e.spawnProgress < 1) {
        e.spawnProgress = Math.min(1, e.spawnProgress + dt * 2.9);
      }

      let moveSpeed = e.def.speed;
      let dirX = dxHero / distHero;
      let dirY = dyHero / distHero;

      if (e.kind === 'bat' || e.kind === 'banshee' || e.kind === 'magma_imp') {
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
          moveSpeed *= 2.4;
          if (e.bossChargeTimer <= 0) {
            e.bossCharging = false;
            e.bossChargeTimer = 3.8;
          }
        }
      }

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

      const emergeEase = 1 - Math.pow(1 - e.spawnProgress, 3);
      const visualBase = e.def.isBoss ? e.def.scale * 0.82 : e.def.scale * 0.74;
      let sx = visualBase * (0.45 + 0.55 * emergeEase);
      let sy = visualBase * (0.15 + 0.85 * emergeEase);

      if (e.squashTimer > 0) {
        e.squashTimer = Math.max(0, e.squashTimer - dt);
        const sq = e.squashTimer / 0.14;
        sx *= 1 + 0.2 * sq;
        sy *= 1 - 0.16 * sq;
      } else {
        const stride = Math.sin(time * 0.01 + e.animSeed) * 0.032;
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
        .setRotation((dxHero >= 0 ? 1 : -1) * 0.035 * Math.sin(time * 0.008 + e.animSeed));

      e.shadow
        .setPosition(e.x, e.y + (e.def.isBoss ? 52 : 30) * e.def.scale)
        .setAlpha(0.58 * emergeEase);

      if (e.spawnProgress >= 0.85 && this.invulnTimer <= 0) {
        const hitDist = e.radius + 14;
        if (dxHero * dxHero + dyHero * dyHero <= hitDist * hitDist) {
          this.damageHero(Math.round(e.def.damage * (0.85 + this.stageDef.difficultyMult * 0.15)));
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
    this.spawnFloatingDamage(enemy.x, enemy.y - 16 * enemy.def.scale, dmg, isCrit);

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
    this.inventory.souls += enemy.def.isBoss ? 60 : 1;

    this.spawnXpGem(enemy.x, enemy.y, enemy.def.xpValue, enemy.def.gemTier);
    if (enemy.def.isBoss) {
      this.cameras.main.shake(420, 0.009);
      this.spawnRingBurst(enemy.x, enemy.y, 0xffd166, 28);

      if (enemy.isFinalStageBoss) {
        this.time.delayedCall(650, () => this.finishRun(true));
      } else {
        this.spawnRelicChest(enemy.x, enemy.y);
      }
    }

    enemy.sprite.stop();
    enemy.sprite.setTint(0xff3b6b);
    this.spawnDeathEmbers(enemy.x, enemy.y, enemy.def.isBoss ? 14 : 4);

    this.tweens.add({
      targets: enemy.sprite,
      scaleX: enemy.def.scale * 0.25,
      scaleY: enemy.def.scale * 1.45,
      y: enemy.y - 20,
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
    if (this.gems.length > 340) {
      const existing = this.gems[this.gems.length - 1];
      existing.xpValue += xpValue;
      existing.sprite.setTexture('gem_ruby');
      return;
    }

    const sprite = this.add.image(x, y, `gem_${tier}`).setDepth(5).setScale(0.2);
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
      }

      if (g.magnetized) {
        g.magnetTime += dt;
        const dist = Math.sqrt(dSq) || 1;
        if (g.magnetTime < 0.11) {
          g.x -= (dx / dist) * 120 * dt;
          g.y -= (dy / dist) * 120 * dt;
        } else {
          const speed = 370 + (g.magnetTime - 0.11) * 960;
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
        scaleX: 0.85,
        scaleY: 0.85,
        duration: 620,
        ease: 'Cubic.easeOut',
      });
    }

    this.time.delayedCall(680, () => {
      this.callbacks?.onRunEnded({
        victory,
        heroId: this.heroId,
        stageId: this.stageDef.id,
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
    const barW = 54;
    const barH = 5;
    const bx = this.heroX - barW / 2;
    const by = this.heroY + 46;

    this.hpBarGraphics.clear();
    this.hpBarGraphics.fillStyle(0x0d090e, 0.88);
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
      duration: 450,
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
        .setTint(i % 2 === 0 ? 0xff4d6d : this.stageDef.palette.emberTint)
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
      stageDurationSeconds: this.stageDef.durationSeconds,
      kills: this.kills,
      souls: this.inventory.souls,
      dashReadyRatio: 1 - Phaser.Math.Clamp(this.dashCooldownTimer / 2.6, 0, 1),
      stageName: this.stageDef.name,
      stageRoman: this.stageDef.roman,
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
