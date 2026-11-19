import Phaser from 'phaser';
import {
  forgeAllTexturesAndAnims,
  forgeStageTextures,
  preloadAllSpriteAssets,
  StageEnvCatalog,
} from '../art/SpriteForge';
import { gothicAudio } from '../audio/GothicAudio';
import { gothicSoundtrack } from '../audio/GothicSoundtrack';
import {
  BaseWeaponId,
  DEFAULT_UNLOCKED_WEAPONS,
  DIFFICULTIES,
  DifficultyDefinition,
  DifficultyId,
  ENEMIES,
  EnemyDefinition,
  EnemyKind,
  HEROES,
  HeroId,
  HeroStats,
  RELICS,
  StageDefinition,
  StageId,
  STAGES,
  WEAPONS,
} from '../data/loreData';
import { SpatialGrid } from '../game/SpatialGrid';
import {
  applyUpgradeChoice,
  buildUpgradeChoices,
  computeEffectiveStats,
  computeIntraMatchEscalation,
  computeWeaponForgeBonus,
  createInitialInventory,
  IntraMatchEscalation,
  InventoryState,
  MAX_WEAPON_SLOTS,
  resolveRelicChest,
  UpgradeChoice,
  WeaponForgeBonus,
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
  dashCooldownRemaining: number;
  stageName: string;
  stageRoman: string;
  difficultyId: DifficultyId;
  difficultyLabel: string;
  actNumber: 1 | 2 | 3 | 4;
  actName: string;
  inventory: InventoryState;
  boss?: {
    name: string;
    hp: number;
    maxHp: number;
  };
  hiddenWeapon?: {
    weaponId: BaseWeaponId;
    weaponName: string;
    altarName: string;
    alreadyUnlocked: boolean;
    claimedInRun: boolean;
    distanceMeters: number;
    angleDeg: number;
  };
}

export interface RunSummary {
  victory: boolean;
  heroId: HeroId;
  stageId: StageId;
  difficultyId: DifficultyId;
  elapsedSeconds: number;
  level: number;
  kills: number;
  souls: number;
  inventory: InventoryState;
}

export type BossRole =
  | 'none'
  | 'sub_boss'
  | 'act_10_boss'
  | 'major_20_boss'
  | 'major_30_boss'
  | 'final_40_boss';

export interface SavedActiveRun {
  savedAt: string;
  heroId: HeroId;
  stageId: StageId;
  difficultyId: DifficultyId;
  elapsedSeconds: number;
  hp: number;
  kills: number;
  inventory: InventoryState;
  hiddenAltarClaimed: boolean;
  spawnedMilestones: string[];
  subBossWaveIndex: number;
}

export interface ArenaCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onLevelUpChoices: (choices: UpgradeChoice[], onPick: (choice: UpgradeChoice) => void) => void;
  onRelicChestOpen: (reward: UpgradeChoice, onClose: () => void) => void;
  onBannerAnnouncement: (title: string, subtitle: string) => void;
  onPauseChanged: (paused: boolean) => void;
  onStage30MinBossCleared: (
    summary: RunSummary,
    onContinueTo40: () => void,
    onFinishStageNow: () => void
  ) => void;
  onWeaponDiscovered?: (weaponId: BaseWeaponId) => void;
  onSaveRunCheckpoint?: (checkpoint: SavedActiveRun | null) => void;
  onRunEnded: (summary: RunSummary) => void;
}

interface EnemyRuntime {
  id: number;
  kind: EnemyKind;
  def: EnemyDefinition;
  displayName: string;
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
  bossRole: BossRole;
  isElite: boolean;
  burnTimer: number;
  burnTickTimer: number;
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
  aoeBurstRadius?: number;
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
  flameEmitTimer: number;
  homing: boolean;
  palette: 'alchemical' | 'purifying' | 'hellfire';
}

type FlamePalette = 'alchemical' | 'purifying' | 'hellfire' | 'torch';

interface FlameParticleRuntime {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  buoyancy: number;
  drag: number;
  turbulenceSeed: number;
  baseScale: number;
  palette: FlamePalette;
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

interface RuinRuntime {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  x: number;
  y: number;
  solidRadius: number;
  isBrazier?: boolean;
  isTree?: boolean;
}

interface VegetationRuntime {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  baseScale: number;
  swaySeed: number;
  rustleTimer: number;
}

interface BreakableRuntime {
  id: number;
  key: string;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  broken: boolean;
  respawnTimer: number;
  hitCooldown: number;
  wobbleTimer: number;
}

interface PickupRuntime {
  kind: 'chalice' | 'magnet';
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  bobSeed: number;
}

function ySortDepth(worldY: number, offset = 0): number {
  return 10 + worldY * 0.0002 + offset;
}

export class ArenaScene extends Phaser.Scene {
  private callbacks!: ArenaCallbacks;
  private heroId: HeroId = 'alaric';
  private stageDef: StageDefinition = STAGES[0];
  private difficultyId: DifficultyId = 'normal';
  private difficultyDef: DifficultyDefinition = DIFFICULTIES.normal;
  private envCatalog!: StageEnvCatalog;
  private inventory!: InventoryState;
  private stats!: HeroStats;

  // World & Scenery
  private groundBg!: Phaser.GameObjects.TileSprite;
  private roadBg!: Phaser.GameObjects.TileSprite;
  private ambientOverlay!: Phaser.GameObjects.Rectangle;
  private fogWisps: Array<{ sprite: Phaser.GameObjects.Image; vx: number; vy: number }> = [];
  private ruins: RuinRuntime[] = [];
  private vegetation: VegetationRuntime[] = [];
  private breakables: BreakableRuntime[] = [];
  private pickups: PickupRuntime[] = [];
  private flames: FlameParticleRuntime[] = [];
  private ambientEmberTimer = 0;
  private sceneryFireTimer = 0;
  private hordeSurgeTimer = 35;
  private subBossTimer = 75;
  private subBossWaveIndex = 0;

  // Stage-Hidden Weapon Altar & Meta Progression
  private metaUnlockedWeapons: BaseWeaponId[] = [...DEFAULT_UNLOCKED_WEAPONS];
  private metaWeaponForge: Partial<Record<BaseWeaponId, number>> = {};
  private resumeCheckpoint?: SavedActiveRun;
  private autoSaveTimer = 0;
  private hiddenAltarClaimed = false;
  private hiddenAltarSprite?: Phaser.GameObjects.Image;
  private hiddenAltarBeam?: Phaser.GameObjects.Image;
  private hiddenAltarHalo?: Phaser.GameObjects.Image;
  private hiddenAltarWeaponIcon?: Phaser.GameObjects.Image;
  private hiddenAltarGlow?: Phaser.GameObjects.Image;
  private hiddenAltarShadow?: Phaser.GameObjects.Image;
  private hiddenAltarLabel?: Phaser.GameObjects.Text;
  private compassArrowSprite?: Phaser.GameObjects.Image;

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
  private heroAttackAnimTimer = 0;

  // Combat Entities
  private nextEnemyId = 1;
  private nextBreakableId = 1;
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
  private pendingLevelUps = 0;

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

  configureRun(
    heroId: HeroId,
    stageId: StageId,
    difficultyId: DifficultyId,
    callbacks: ArenaCallbacks,
    metaProgression?: {
      unlockedWeapons: BaseWeaponId[];
      weaponForge: Partial<Record<BaseWeaponId, number>>;
    },
    resumeCheckpoint?: SavedActiveRun
  ): void {
    this.heroId = heroId;
    this.stageDef = STAGES.find((s) => s.id === stageId) ?? STAGES[0];
    this.difficultyId = difficultyId;
    this.difficultyDef = DIFFICULTIES[difficultyId] ?? DIFFICULTIES.normal;
    this.callbacks = callbacks;
    this.metaUnlockedWeapons = metaProgression?.unlockedWeapons?.length
      ? [...metaProgression.unlockedWeapons]
      : [...DEFAULT_UNLOCKED_WEAPONS];
    this.metaWeaponForge = metaProgression?.weaponForge ? { ...metaProgression.weaponForge } : {};
    this.resumeCheckpoint = resumeCheckpoint;
  }

  exportRunCheckpoint(): SavedActiveRun | null {
    if (!this.inventory || this.runEnded || this.hp <= 0) return null;
    const clonedInv: InventoryState = {
      ...this.inventory,
      weapons: { ...this.inventory.weapons },
      relics: { ...this.inventory.relics },
      unlockedWeapons: this.inventory.unlockedWeapons ? [...this.inventory.unlockedWeapons] : undefined,
      weaponForge: this.inventory.weaponForge ? { ...this.inventory.weaponForge } : undefined,
    };
    return {
      savedAt: new Date().toISOString(),
      heroId: this.heroId,
      stageId: this.stageDef.id,
      difficultyId: this.difficultyId,
      elapsedSeconds: this.elapsedSeconds,
      hp: Math.max(1, Math.round(this.hp)),
      kills: this.kills,
      inventory: clonedInv,
      hiddenAltarClaimed: this.hiddenAltarClaimed,
      spawnedMilestones: Array.from(this.spawnedMilestones),
      subBossWaveIndex: this.subBossWaveIndex,
    };
  }

  setVirtualJoystick(dx: number, dy: number): void {
    this.virtualMoveX = dx;
    this.virtualMoveY = dy;
  }

  triggerDash(): boolean {
    if (this.isSimulationPaused() || this.dashCooldownTimer > 0) return false;

    // Immediately align dash direction with live joystick/keyboard input if held right now
    let liveX = this.virtualMoveX;
    let liveY = this.virtualMoveY;
    if (this.cursors && this.wasd) {
      if (this.cursors.left.isDown || this.wasd.A.isDown) liveX -= 1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) liveX += 1;
      if (this.cursors.up.isDown || this.wasd.W.isDown) liveY -= 1;
      if (this.cursors.down.isDown || this.wasd.S.isDown) liveY += 1;
    }
    const liveLen = Math.hypot(liveX, liveY);
    if (liveLen > 0.08) {
      this.aimX = liveX / liveLen;
      this.aimY = liveY / liveLen;
      if (Math.abs(this.aimX) > 0.08) {
        this.facing = this.aimX >= 0 ? 1 : -1;
      }
    }

    this.dashCooldownTimer = 2.4;
    this.dashActiveTimer = 0.26;
    this.invulnTimer = Math.max(this.invulnTimer, 0.42);

    this.dashDirX = this.aimX;
    this.dashDirY = this.aimY;

    gothicAudio.playDash();
    this.spawnRingBurst(this.heroX, this.heroY, HEROES[this.heroId].accentColor, 16);
    this.pushHudUpdate();
    return true;
  }

  toggleUserPause(): boolean {
    if (this.runEnded || this.modalPaused) return this.userPaused;
    this.userPaused = !this.userPaused;
    if (this.userPaused) {
      this.callbacks?.onSaveRunCheckpoint?.(this.exportRunCheckpoint());
    }
    this.callbacks?.onPauseChanged(this.userPaused);
    return this.userPaused;
  }

  setUserPause(paused: boolean): void {
    if (this.runEnded) return;
    this.userPaused = paused;
    if (this.userPaused) {
      this.callbacks?.onSaveRunCheckpoint?.(this.exportRunCheckpoint());
    }
    this.callbacks?.onPauseChanged(this.userPaused);
  }

  preload(): void {
    preloadAllSpriteAssets(this);
  }

  create(): void {
    forgeAllTexturesAndAnims(this);
    this.envCatalog = forgeStageTextures(this, this.stageDef);

    this.enemies = [];
    this.projectiles = [];
    this.firePools = [];
    this.gems = [];
    this.chests = [];
    this.orbitalSprites = [];
    this.ruins = [];
    this.vegetation = [];
    this.breakables = [];
    this.pickups = [];
    this.flames = [];
    this.fogWisps = [];
    this.orbitalHitCooldowns.clear();
    this.spawnedMilestones.clear();
    this.sceneryFireTimer = 0;
    this.hordeSurgeTimer = this.difficultyDef.surgeIntervalSec;
    this.subBossTimer = Math.round(this.difficultyDef.subBossIntervalSec * 0.85);
    this.subBossWaveIndex = 0;
    this.autoSaveTimer = 0;
    this.hiddenAltarClaimed = false;
    this.hiddenAltarSprite = undefined;
    this.hiddenAltarBeam = undefined;
    this.hiddenAltarHalo = undefined;
    this.hiddenAltarWeaponIcon = undefined;
    this.hiddenAltarGlow = undefined;
    this.hiddenAltarShadow = undefined;
    this.hiddenAltarLabel = undefined;
    this.compassArrowSprite = undefined;

    const resumed = this.resumeCheckpoint;
    this.resumeCheckpoint = undefined;

    if (resumed) {
      this.inventory = {
        ...resumed.inventory,
        heroId: this.heroId,
        weapons: { ...resumed.inventory.weapons },
        relics: { ...resumed.inventory.relics },
        unlockedWeapons: Array.from(
          new Set([
            ...(resumed.inventory.unlockedWeapons ?? this.metaUnlockedWeapons),
            ...this.metaUnlockedWeapons,
          ])
        ),
        weaponForge: { ...this.metaWeaponForge },
      };
      this.stats = computeEffectiveStats(this.inventory);
      this.hp = Math.min(this.stats.maxHp, Math.max(1, resumed.hp));
      this.trailingHp = this.hp;
      this.elapsedSeconds = Math.max(0, resumed.elapsedSeconds);
      this.kills = Math.max(0, resumed.kills);
      this.hiddenAltarClaimed = Boolean(resumed.hiddenAltarClaimed);
      this.spawnedMilestones = new Set(resumed.spawnedMilestones ?? []);
      this.subBossWaveIndex = resumed.subBossWaveIndex ?? 0;
    } else {
      this.inventory = createInitialInventory(
        this.heroId,
        this.metaUnlockedWeapons,
        this.metaWeaponForge
      );
      this.stats = computeEffectiveStats(this.inventory);
      this.hp = this.stats.maxHp;
      this.trailingHp = this.hp;
      this.elapsedSeconds = 0;
      this.kills = 0;
    }

    this.heroX = 0;
    this.heroY = 0;
    this.heroVx = 0;
    this.heroVy = 0;
    this.facing = 1;
    this.aimX = 1;
    this.aimY = 0;
    this.spawnAccumulator = 0;
    this.invulnTimer = 0;
    this.dashCooldownTimer = 0;
    this.dashActiveTimer = 0;
    this.heroAttackAnimTimer = 0;
    this.pendingLevelUps = 0;
    this.modalPaused = false;
    this.userPaused = false;
    this.runEnded = false;

    const bannerTitle = resumed
      ? `VIGÍLIA RETOMADA · Fase ${this.stageDef.roman}`
      : `Fase ${this.stageDef.roman} · ${this.stageDef.name}`;
    const bannerSub = resumed ? 'Save carregado com sucesso!' : this.stageDef.subtitle;

    gothicSoundtrack.playStageMusic(this.stageDef.id);

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

    // 1. Seamless Ground & Central Path
    this.groundBg = this.add
      .tileSprite(width / 2, height / 2, width + 512, height + 512, this.envCatalog.groundKey)
      .setScrollFactor(0)
      .setDepth(-30);

    this.roadBg = this.add
      .tileSprite(width / 2, height / 2, 180, height + 512, this.envCatalog.roadKey)
      .setScrollFactor(0)
      .setDepth(-28);

    // 2. Populate Ruins, Vegetation Clusters, Breakables & Hidden Stage Weapon Altar!
    this.initRuinsVegetationAndBreakables();
    this.spawnHiddenWeaponAltar();

    // 3. Thurible Sanctuary Aura
    this.thuribleAura = this.add
      .image(0, 0, 'vfx_aura_ring')
      .setDepth(2)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);

    // 4. Articulated Hero Sprite & Shadow
    this.heroShadow = this.add.image(0, 38, 'vfx_shadow').setDepth(4).setScale(1.22, 0.95);
    this.heroSprite = this.add
      .sprite(0, 0, `hero_${this.heroId}`, 0)
      .setDepth(ySortDepth(0))
      .setScale(0.1);
    this.heroSprite.play(`hero_${this.heroId}_idle`);

    this.tweens.add({
      targets: this.heroSprite,
      scaleX: 0.86,
      scaleY: 0.86,
      duration: 500,
      ease: 'Back.easeOut',
    });
    this.spawnRingBurst(0, 0, HEROES[this.heroId].accentColor, 18);

    this.hpBarGraphics = this.add.graphics().setDepth(28);

    // 5. Stage Fog & Lighting
    for (let i = 0; i < 8; i++) {
      const wisp = this.add
        .image(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), 'vfx_fog')
        .setScrollFactor(0)
        .setDepth(40)
        .setTint(this.stageDef.palette.fogColor)
        .setScale(Phaser.Math.FloatBetween(1.8, 3.2))
        .setAlpha(Phaser.Math.FloatBetween(0.13, 0.28))
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
        0.13
      )
      .setScrollFactor(0)
      .setDepth(42)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    const cam = this.cameras.main;
    cam.centerOn(0, 0);

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

    // Initial wave
    const starterKind = this.stageDef.enemyPool[0];
    for (let i = 0; i < 8; i++) {
      this.spawnEnemyAroundHero(starterKind);
    }

    this.callbacks?.onBannerAnnouncement(bannerTitle, bannerSub);
    this.pushHudUpdate();
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    if (!this.scene.isActive()) return;
    const w = gameSize.width;
    const h = gameSize.height;
    if (this.groundBg && this.groundBg.scene) {
      this.groundBg.setPosition(w / 2, h / 2).setSize(w + 512, h + 512);
    }
    if (this.roadBg && this.roadBg.scene) {
      this.roadBg.setSize(180, h + 512);
    }
    if (this.ambientOverlay && this.ambientOverlay.scene) {
      this.ambientOverlay.setPosition(w / 2, h / 2).setSize(w + 64, h + 64);
    }
  }

  private randomOffRoadCoord(range: number, minRoadClearance = 128): { x: number; y: number } {
    let px = Phaser.Math.Between(-range, range);
    const py = Phaser.Math.Between(-range, range);
    if (Math.abs(px) < minRoadClearance) {
      px += px >= 0 ? minRoadClearance : -minRoadClearance;
    }
    return { x: px, y: py };
  }

  private initRuinsVegetationAndBreakables(): void {
    // A. Dense Forest Trees & Architectural Ruins (Forest gets 72 lush trees/ruins + 135 flora clusters!)
    const isForest = this.stageDef.propStyle === 'forest';
    const { ruinKeys, vegKeys, breakableKeys } = this.envCatalog;
    const ruinCount = isForest ? 72 : 28;
    const spreadRange = isForest ? 1450 : 1300;

    for (let i = 0; i < ruinCount; i++) {
      const key = ruinKeys[i % ruinKeys.length];
      const isTree = key.startsWith('tree_') || key === 'prop_dead_tree';
      const isBrazier = key === 'prop_iron_brazier';
      const { x, y } = this.randomOffRoadCoord(spreadRange, isTree ? 128 : 155);
      const treeScale = isTree ? Phaser.Math.FloatBetween(0.95, 1.38) : 1.0;

      const shadow = this.add
        .image(x, y + (isTree ? 52 * treeScale : 40), 'vfx_shadow')
        .setDepth(3)
        .setScale((isTree ? 2.1 : 1.6) * treeScale, (isTree ? 1.25 : 1.1) * treeScale)
        .setAlpha(isTree ? 0.62 : 0.55);
      const sprite = this.add
        .image(x, y, key)
        .setScale(treeScale)
        .setDepth(ySortDepth(y + (isTree ? 44 * treeScale : 28)))
        .setFlipX(i % 2 === 1);

      let glow: Phaser.GameObjects.Image | undefined;
      if (isBrazier) {
        glow = this.add
          .image(x, y - 16, 'vfx_flame_core')
          .setScale(1.8)
          .setTint(this.stageDef.palette.emberTint)
          .setAlpha(0.36)
          .setDepth(2)
          .setBlendMode(Phaser.BlendModes.ADD);
      }
      this.ruins.push({
        sprite,
        shadow,
        glow,
        x,
        y,
        solidRadius: isTree ? 18 : isBrazier ? 18 : 26,
        isBrazier,
        isTree,
      });
    }

    // B. Lush Vegetation Clusters (Forest gets 135 rich ferns/bushes/glowing mushrooms!)
    const vegCount = isForest ? 135 : 48;
    for (let i = 0; i < vegCount; i++) {
      const key = vegKeys[i % vegKeys.length];
      const { x, y } = this.randomOffRoadCoord(spreadRange, 102);
      const baseScale = Phaser.Math.FloatBetween(0.74, 1.16);
      const shadow = this.add
        .image(x, y + 26 * baseScale, 'vfx_shadow')
        .setDepth(3)
        .setScale(1.15 * baseScale, 0.8 * baseScale)
        .setAlpha(0.45);
      const sprite = this.add
        .image(x, y, key)
        .setScale(baseScale)
        .setFlipX(i % 2 === 0)
        .setDepth(ySortDepth(y + 18));
      this.vegetation.push({
        sprite,
        shadow,
        x,
        y,
        baseScale,
        swaySeed: Math.random() * Math.PI * 2,
        rustleTimer: 0,
      });
    }

    // C. Reduced Breakable Destructibles (16 total, rarer healing so map doesn't flood with HP!)
    const breakableCount = 16;
    for (let i = 0; i < breakableCount; i++) {
      const key = breakableKeys[i % breakableKeys.length];
      let x: number;
      let y: number;
      if (i < 4) {
        const side = i % 2 === 0 ? 1 : -1;
        x = side * Phaser.Math.Between(104, 240);
        y = (i - 1.5) * 320 + Phaser.Math.Between(-40, 40);
      } else {
        const pos = this.randomOffRoadCoord(1320, 96);
        x = pos.x;
        y = pos.y;
      }

      const shadow = this.add
        .image(x, y + 26, 'vfx_shadow')
        .setDepth(3)
        .setScale(0.95, 0.72)
        .setAlpha(0.55);
      const sprite = this.add.image(x, y, key).setDepth(ySortDepth(y + 20)).setScale(0.92);

      let glow: Phaser.GameObjects.Image | undefined;
      if (key === 'break_candelabra' || key === 'break_crystal_cluster') {
        glow = this.add
          .image(x, y - 14, 'vfx_flame_core')
          .setScale(1.15)
          .setTint(key === 'break_candelabra' ? 0xffa94d : 0xff2a55)
          .setAlpha(0.32)
          .setDepth(2)
          .setBlendMode(Phaser.BlendModes.ADD);
      }

      this.breakables.push({
        id: this.nextBreakableId++,
        key,
        sprite,
        shadow,
        glow,
        x,
        y,
        hp: 26,
        maxHp: 26,
        broken: false,
        respawnTimer: 0,
        hitCooldown: 0,
        wobbleTimer: 0,
      });
    }
  }

  private spawnHiddenWeaponAltar(): void {
    const pos = this.stageDef.hiddenAltarPos;
    const wId = this.stageDef.hiddenWeapon;
    const wDef = WEAPONS[wId];
    const alreadyUnlocked = this.metaUnlockedWeapons.includes(wId);
    const claimed = this.hiddenAltarClaimed;

    this.hiddenAltarShadow = this.add
      .image(pos.x, pos.y + 44, 'vfx_shadow')
      .setDepth(3)
      .setScale(1.85, 1.05)
      .setAlpha(0.7);

    if (!claimed) {
      this.hiddenAltarBeam = this.add
        .image(pos.x, pos.y - 84, 'vfx_reliquary_beam')
        .setDepth(ySortDepth(pos.y, -0.06))
        .setScale(1.05, 1.0)
        .setTint(alreadyUnlocked ? 0x67d4ff : 0xffd166)
        .setAlpha(0.72)
        .setBlendMode(Phaser.BlendModes.ADD);
    }

    this.hiddenAltarGlow = this.add
      .image(pos.x, pos.y - 16, 'vfx_aura_ring')
      .setDepth(ySortDepth(pos.y, -0.04))
      .setScale(claimed ? 0.45 : 0.88)
      .setTint(claimed || alreadyUnlocked ? 0x67d4ff : 0xffd166)
      .setAlpha(claimed ? 0.28 : 0.8)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.hiddenAltarSprite = this.add
      .image(pos.x, pos.y, 'prop_weapon_altar')
      .setDepth(ySortDepth(pos.y + 30))
      .setScale(0.95)
      .setTint(claimed ? 0x7c8ea6 : 0xffffff)
      .setAlpha(claimed ? 0.72 : 1);

    if (!claimed) {
      this.hiddenAltarHalo = this.add
        .image(pos.x, pos.y - 46, 'vfx_reliquary_halo')
        .setDepth(ySortDepth(pos.y + 30, 0.2))
        .setScale(0.62)
        .setTint(alreadyUnlocked ? 0x9ef0ff : 0xffe066)
        .setBlendMode(Phaser.BlendModes.ADD);

      const iconTex = `weapon_icon_${wId}`;
      if (this.textures.exists(iconTex)) {
        this.hiddenAltarWeaponIcon = this.add
          .image(pos.x, pos.y - 46, iconTex)
          .setDepth(ySortDepth(pos.y + 30, 0.3))
          .setDisplaySize(32, 32);
      }
    }

    this.hiddenAltarLabel = this.add
      .text(pos.x, pos.y - 80, claimed ? `✦ ${wDef.name} (Liberada)` : `✦ ${wDef.name}`, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: claimed || alreadyUnlocked ? '#9ef0ff' : '#ffe79e',
        stroke: '#120710',
        strokeThickness: 3.5,
      })
      .setOrigin(0.5)
      .setDepth(30);

    if (!claimed) {
      this.compassArrowSprite = this.add
        .image(this.heroX + 76, this.heroY, 'vfx_compass_arrow')
        .setDepth(31)
        .setTint(alreadyUnlocked ? 0x67d4ff : 0xffe066)
        .setScale(1.05)
        .setAlpha(0.92);
    }
  }

  private claimHiddenWeaponAltar(): void {
    if (this.hiddenAltarClaimed) return;
    this.hiddenAltarClaimed = true;

    const pos = this.stageDef.hiddenAltarPos;
    const wId = this.stageDef.hiddenWeapon;
    const wDef = WEAPONS[wId];

    if (!this.inventory.unlockedWeapons) {
      this.inventory.unlockedWeapons = [...this.metaUnlockedWeapons];
    }
    if (!this.inventory.unlockedWeapons.includes(wId)) {
      this.inventory.unlockedWeapons.push(wId);
    }
    if (!this.metaUnlockedWeapons.includes(wId)) {
      this.metaUnlockedWeapons.push(wId);
    }
    this.callbacks?.onWeaponDiscovered?.(wId);

    const prevMaxHp = this.stats.maxHp;
    const currentLv = this.inventory.weapons[wId] ?? 0;
    const ownedCount = Object.keys(this.inventory.weapons).length;
    if (currentLv === 0 && ownedCount < MAX_WEAPON_SLOTS) {
      this.inventory.weapons[wId] = this.getForgeBonus(wId).startingLevel;
    } else if (currentLv > 0 && currentLv < wDef.maxLevel) {
      this.inventory.weapons[wId] = currentLv + 1;
    } else {
      this.inventory.ascensionMight = (this.inventory.ascensionMight ?? 0) + 0.1;
      this.inventory.souls += 80;
    }
    this.stats = computeEffectiveStats(this.inventory);
    const hpDelta = Math.max(0, this.stats.maxHp - prevMaxHp);
    this.hp = Math.min(this.stats.maxHp, this.hp + hpDelta + 25);

    this.hiddenAltarGlow?.setTint(0x67d4ff).setAlpha(0.28).setScale(0.45);
    this.hiddenAltarSprite?.setTint(0x7c8ea6).setAlpha(0.72);
    this.hiddenAltarBeam?.destroy();
    this.hiddenAltarBeam = undefined;
    this.hiddenAltarHalo?.destroy();
    this.hiddenAltarHalo = undefined;
    if (this.hiddenAltarWeaponIcon) {
      const iconSpr = this.hiddenAltarWeaponIcon;
      this.hiddenAltarWeaponIcon = undefined;
      this.tweens.add({
        targets: iconSpr,
        x: this.heroX,
        y: this.heroY - 12,
        scaleX: 0.25,
        scaleY: 0.25,
        alpha: 0,
        duration: 420,
        ease: 'Cubic.easeIn',
        onComplete: () => iconSpr.destroy(),
      });
    }
    const catDef = wDef.catalystRelic ? RELICS[wDef.catalystRelic] : undefined;
    this.hiddenAltarLabel
      ?.setText(`✦ ${wDef.name}${catDef ? ` + ${catDef.name}` : ''} (Liberados)`)
      .setColor('#9ef0ff');
    this.compassArrowSprite?.destroy();
    this.compassArrowSprite = undefined;

    gothicAudio.playLevelUp();
    this.spawnRingBurst(pos.x, pos.y, 0xffe066, 28);
    this.spawnFloatingNotice(
      this.heroX,
      this.heroY - 40,
      catDef ? '✦ ARMA & CATALISADOR LIBERADOS!' : '✦ ARMA LIBERADA!',
      '#ffe79e'
    );
    this.callbacks?.onBannerAnnouncement(
      catDef
        ? `LIBERADOS: ${wDef.name.toUpperCase()} + ${catDef.name.toUpperCase()}`
        : `ARMA SECRETA LIBERADA: ${wDef.name.toUpperCase()}`,
      catDef
        ? `Descobertos em ${this.stageDef.hiddenAltarName} e disponíveis nas partidas!`
        : `Descoberta em ${this.stageDef.hiddenAltarName} e disponível na Forja!`
    );
    this.callbacks?.onSaveRunCheckpoint?.(this.exportRunCheckpoint());
    this.pushHudUpdate();
  }

  private isSimulationPaused(): boolean {
    return this.modalPaused || this.userPaused || this.runEnded;
  }

  private triggerHeroAttackAnim(): void {
    if (this.runEnded) return;
    if (this.heroAttackAnimTimer <= 0.04) {
      this.heroAttackAnimTimer = 0.24;
      this.heroSprite.play(`hero_${this.heroId}_attack`, true);
    }
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
    this.updateFirePhysics(time, dt);
    this.updateProjectiles(dt);
    this.updateEnemies(time, dt);
    this.updateBreakablesAndPickups(time, dt);
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

    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= 15) {
      this.autoSaveTimer = 0;
      this.callbacks?.onSaveRunCheckpoint?.(this.exportRunCheckpoint());
    }
  }

  private updateHeroMovementAndAnims(time: number, dt: number): void {
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);
    }
    if (this.heroAttackAnimTimer > 0) {
      this.heroAttackAnimTimer = Math.max(0, this.heroAttackAnimTimer - dt);
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
      const dashSpeed = this.stats.moveSpeed * 3.55;
      this.heroVx = this.dashDirX * dashSpeed;
      this.heroVy = this.dashDirY * dashSpeed;

      // Spectral phase wake: push nearby monsters aside while phasing through them!
      const wakeEnemies = this.grid.queryRadius(this.heroX, this.heroY, 48);
      for (const enemy of wakeEnemies) {
        if (!enemy.def.isBoss) {
          const pdx = enemy.x - this.heroX;
          const pdy = enemy.y - this.heroY;
          const pd = Math.hypot(pdx, pdy) || 1;
          enemy.knockVx = (pdx / pd) * 220;
          enemy.knockVy = (pdy / pd) * 220;
        }
      }

      if (Math.random() < 0.8) {
        const ghost = this.add
          .image(this.heroX, this.heroY, `hero_${this.heroId}`, this.heroSprite.frame.name)
          .setScale(this.heroSprite.scaleX, this.heroSprite.scaleY)
          .setFlipX(this.heroSprite.flipX)
          .setTint(HEROES[this.heroId].accentColor)
          .setAlpha(0.62)
          .setDepth(ySortDepth(this.heroY, -0.01))
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: ghost,
          alpha: 0,
          scaleX: ghost.scaleX * 0.85,
          scaleY: ghost.scaleY * 0.85,
          duration: 260,
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

    // Gentle soft-collision slide around solid stone ruins
    for (let i = 0; i < this.ruins.length; i++) {
      const r = this.ruins[i];
      const dx = this.heroX - r.x;
      const dy = this.heroY - (r.y + 18);
      const minD = r.solidRadius + 14;
      const dSq = dx * dx + dy * dy;
      if (dSq > 0.01 && dSq < minD * minD) {
        const d = Math.sqrt(dSq);
        this.heroX += (dx / d) * (minD - d);
        this.heroY += (dy / d) * (minD - d);
      }
    }

    if (Math.abs(inputX) > 0.08) {
      this.facing = inputX >= 0 ? 1 : -1;
    }

    const speedRatio = Math.min(1, Math.hypot(this.heroVx, this.heroVy) / this.stats.moveSpeed);
    this.heroSprite
      .setPosition(this.heroX, this.heroY)
      .setFlipX(this.facing < 0)
      .setDepth(ySortDepth(this.heroY + 34));
    this.heroShadow.setPosition(this.heroX, this.heroY + 38);

    const targetTilt = (this.heroVx / this.stats.moveSpeed) * 0.055;
    this.heroSprite.rotation = Phaser.Math.Linear(this.heroSprite.rotation, targetTilt, 10 * dt);

    // Blend smoothly between Attack Swing, 8-Frame Articulated Walk, and Calm Idle!
    const walkKey = `hero_${this.heroId}_walk`;
    const idleKey = `hero_${this.heroId}_idle`;
    const curAnimKey = this.heroSprite.anims.currentAnim?.key;

    if (this.heroAttackAnimTimer <= 0) {
      if (speedRatio > 0.14) {
        if (curAnimKey !== walkKey) {
          this.heroSprite.play(walkKey, true);
        }
        this.heroSprite.anims.timeScale = 0.78 + speedRatio * 0.68;
      } else {
        if (curAnimKey !== idleKey) {
          this.heroSprite.play(idleKey, true);
        }
        this.heroSprite.anims.timeScale = 1.0;
      }
    } else {
      this.heroSprite.anims.timeScale = 1.15;
    }

    if (speedRatio > 0.14) {
      const stridePulse = Math.sin(time * 0.016) * 0.025 * speedRatio;
      this.heroSprite.setScale(0.86 - stridePulse, 0.86 + stridePulse);

      this.dustStepTimer -= dt;
      if (this.dustStepTimer <= 0) {
        this.dustStepTimer = 0.18;
        this.spawnFootstepDust(this.heroX, this.heroY + 36);
      }
    } else {
      const breath = Math.sin(time * 0.004) * 0.015;
      this.heroSprite.setScale(0.86 + breath * 0.5, 0.86 - breath);
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

    const isForest = this.stageDef.propStyle === 'forest';
    const wrapRange = Math.max(
      isForest ? 1450 : 1350,
      Math.ceil(Math.max(cam.width, cam.height) * 0.62) + 220
    );

    // 1. Wrap Trees/Ruins + Canopy Occlusion Fade + Animated Fire Glow!
    for (let i = 0; i < this.ruins.length; i++) {
      const r = this.ruins[i];
      let moved = false;
      if (r.x - this.heroX > wrapRange) {
        r.x -= wrapRange * 2;
        moved = true;
      } else if (this.heroX - r.x > wrapRange) {
        r.x += wrapRange * 2;
        moved = true;
      }
      if (r.y - this.heroY > wrapRange) {
        r.y -= wrapRange * 2;
        moved = true;
      } else if (this.heroY - r.y > wrapRange) {
        r.y += wrapRange * 2;
        moved = true;
      }
      if (moved) {
        if (Math.abs(r.x) < 135) r.x += r.x >= 0 ? 155 : -155;
        r.sprite.setPosition(r.x, r.y).setDepth(ySortDepth(r.y + (r.isTree ? 44 : 28)));
        r.shadow.setPosition(r.x, r.y + (r.isTree ? 52 : 40));
      }

      // Smooth canopy sway for living forest trees + canopy fade when hero walks underneath!
      if (r.isTree) {
        r.sprite.setRotation(Math.sin(time * 0.0014 + i * 0.9) * 0.022);
      }
      const behind = r.isTree
        ? Math.abs(this.heroX - r.x) < 62 && this.heroY < r.y + 42 && this.heroY > r.y - 96
        : Math.abs(this.heroX - r.x) < 52 && this.heroY < r.y + 24 && this.heroY > r.y - 76;
      r.sprite.setAlpha(Phaser.Math.Linear(r.sprite.alpha, behind ? 0.52 : 1.0, 10 * dt));

      if (r.glow) {
        r.glow.setPosition(r.x, r.y - 16);
        r.glow.setAlpha(0.28 + Math.sin(time * 0.012 + i) * 0.1);
        r.glow.setScale(1.7 + Math.sin(time * 0.019 + i) * 0.2);
      }
    }

    // 2. Wrap & Animate Swaying / Rustling Vegetation!
    for (let i = 0; i < this.vegetation.length; i++) {
      const v = this.vegetation[i];
      let moved = false;
      if (v.x - this.heroX > wrapRange) {
        v.x -= wrapRange * 2;
        moved = true;
      } else if (this.heroX - v.x > wrapRange) {
        v.x += wrapRange * 2;
        moved = true;
      }
      if (v.y - this.heroY > wrapRange) {
        v.y -= wrapRange * 2;
        moved = true;
      } else if (this.heroY - v.y > wrapRange) {
        v.y += wrapRange * 2;
        moved = true;
      }
      if (moved) {
        if (Math.abs(v.x) < 108) v.x += v.x >= 0 ? 125 : -125;
        v.sprite.setPosition(v.x, v.y).setDepth(ySortDepth(v.y + 18));
        v.shadow.setPosition(v.x, v.y + 26 * v.baseScale);
      }

      // Trigger rustle when hero brushes through bush!
      const dx = this.heroX - v.x;
      const dy = this.heroY - v.y;
      if (v.rustleTimer <= 0 && dx * dx + dy * dy < 32 * 32 && Math.hypot(this.heroVx, this.heroVy) > 25) {
        v.rustleTimer = 0.34;
        this.spawnLeafRustle(v.x, v.y);
      }

      if (v.rustleTimer > 0) {
        v.rustleTimer = Math.max(0, v.rustleTimer - dt);
        const shake = Math.sin(v.rustleTimer * 45) * 0.14 * (v.rustleTimer / 0.34);
        v.sprite
          .setRotation(shake)
          .setScale(v.baseScale * (1 + 0.1 * (v.rustleTimer / 0.34)), v.baseScale * 0.94);
      } else {
        const wind = Math.sin(time * 0.0024 + v.swaySeed) * 0.042;
        v.sprite.setRotation(wind).setScale(v.baseScale);
      }
    }

    for (const w of this.fogWisps) {
      w.sprite.x += w.vx * dt;
      w.sprite.y += w.vy * dt;
      if (w.sprite.x > cam.width + 180) w.sprite.x = -180;
      if (w.sprite.y < -120) w.sprite.y = cam.height + 120;
      if (w.sprite.y > cam.height + 120) w.sprite.y = -120;
    }

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

  private updateBreakablesAndPickups(time: number, dt: number): void {
    const cam = this.cameras.main;
    const wrapRange = Math.max(1220, Math.ceil(Math.max(cam.width, cam.height) * 0.6) + 180);

    for (let i = 0; i < this.breakables.length; i++) {
      const b = this.breakables[i];
      if (b.hitCooldown > 0) b.hitCooldown = Math.max(0, b.hitCooldown - dt);

      if (b.broken) {
        b.respawnTimer -= dt;
        if (b.respawnTimer <= 0) {
          // Respawn off-screen ahead of player exploration!
          const angle = Math.random() * Math.PI * 2;
          const dist = Phaser.Math.Between(680, 1050);
          b.x = this.heroX + Math.cos(angle) * dist;
          b.y = this.heroY + Math.sin(angle) * dist;
          if (Math.abs(b.x) < 92) b.x += b.x >= 0 ? 110 : -110;
          b.hp = b.maxHp;
          b.broken = false;
          b.sprite
            .setPosition(b.x, b.y)
            .setDepth(ySortDepth(b.y + 20))
            .setScale(0.92)
            .setRotation(0)
            .clearTint()
            .setVisible(true);
          b.shadow.setPosition(b.x, b.y + 26).setVisible(true);
          b.glow?.setPosition(b.x, b.y - 12).setVisible(true);
        }
        continue;
      }

      // Wrap intact breakables around camera exploration
      let moved = false;
      if (b.x - this.heroX > wrapRange) {
        b.x -= wrapRange * 2;
        moved = true;
      } else if (this.heroX - b.x > wrapRange) {
        b.x += wrapRange * 2;
        moved = true;
      }
      if (b.y - this.heroY > wrapRange) {
        b.y -= wrapRange * 2;
        moved = true;
      } else if (this.heroY - b.y > wrapRange) {
        b.y += wrapRange * 2;
        moved = true;
      }
      if (moved) {
        if (Math.abs(b.x) < 92) b.x += b.x >= 0 ? 110 : -110;
        b.sprite.setPosition(b.x, b.y).setDepth(ySortDepth(b.y + 20));
        b.shadow.setPosition(b.x, b.y + 26);
        b.glow?.setPosition(b.x, b.y - 12);
      }

      if (b.wobbleTimer > 0) {
        b.wobbleTimer = Math.max(0, b.wobbleTimer - dt);
        b.sprite.setRotation(Math.sin(b.wobbleTimer * 55) * 0.2);
        if (b.wobbleTimer < 0.08) b.sprite.clearTint();
      } else {
        b.sprite.setRotation(0);
      }

      if (b.glow) {
        b.glow.setAlpha(0.24 + Math.sin(time * 0.01 + b.id) * 0.07);
      }
    }

    // Update Dropped Loot Pickups (Blood Chalices & Astral Vacuum Magnets!)
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.sprite.y = pk.y + Math.sin(time * 0.005 + pk.bobSeed) * 3.5;
      pk.glow
        .setPosition(pk.x, pk.sprite.y)
        .setScale(0.32 + Math.sin(time * 0.006 + pk.bobSeed) * 0.04)
        .setRotation(time * 0.001);

      const dx = this.heroX - pk.x;
      const dy = this.heroY - pk.y;
      if (dx * dx + dy * dy <= 38 * 38) {
        this.collectLootPickup(pk);
        pk.sprite.destroy();
        pk.glow.destroy();
        this.pickups.splice(i, 1);
      }
    }

    // Update Stage-Hidden Weapon Altar & Directional Compass Arrow
    if (!this.hiddenAltarClaimed && this.hiddenAltarSprite) {
      const altarPos = this.stageDef.hiddenAltarPos;
      const adx = altarPos.x - this.heroX;
      const ady = altarPos.y - this.heroY;
      const adist = Math.hypot(adx, ady);
      const ang = Math.atan2(ady, adx);

      this.hiddenAltarGlow
        ?.setScale(0.84 + Math.sin(time * 0.005) * 0.1)
        .setRotation(time * 0.0008);
      if (this.hiddenAltarBeam) {
        this.hiddenAltarBeam
          .setAlpha(0.58 + Math.sin(time * 0.004) * 0.18)
          .setScale(0.95 + Math.sin(time * 0.006) * 0.1, 1.0);
      }
      const bobY = Math.sin(time * 0.004) * 5;
      if (this.hiddenAltarHalo) {
        this.hiddenAltarHalo
          .setPosition(altarPos.x, altarPos.y - 46 + bobY)
          .setRotation(-time * 0.0012);
      }
      if (this.hiddenAltarWeaponIcon) {
        this.hiddenAltarWeaponIcon.setPosition(altarPos.x, altarPos.y - 46 + bobY);
      }
      if (this.hiddenAltarLabel) {
        this.hiddenAltarLabel.y = altarPos.y - 80 + bobY * 0.5;
      }

      if (
        Math.random() < 0.14 &&
        Math.abs(adx) < cam.width * 0.65 &&
        Math.abs(ady) < cam.height * 0.65
      ) {
        this.spawnPhysicsFlame(
          altarPos.x + Phaser.Math.FloatBetween(-18, 18),
          altarPos.y - 26,
          Phaser.Math.FloatBetween(-12, 12),
          Phaser.Math.FloatBetween(-42, -18),
          'torch',
          0.45
        );
      }

      if (this.compassArrowSprite) {
        const showArrow = adist > 82;
        this.compassArrowSprite.setVisible(showArrow);
        if (showArrow) {
          this.compassArrowSprite
            .setPosition(this.heroX + Math.cos(ang) * 76, this.heroY + Math.sin(ang) * 76)
            .setRotation(ang);
        }
      }

      if (adist <= 54) {
        this.claimHiddenWeaponAltar();
      }
    }
  }

  private damageBreakablesInRadius(x: number, y: number, radius: number, damage: number): void {
    for (let i = 0; i < this.breakables.length; i++) {
      const b = this.breakables[i];
      if (b.broken || b.hitCooldown > 0) continue;
      const dx = b.x - x;
      const dy = b.y - y;
      const hitLim = radius + 24;
      if (dx * dx + dy * dy <= hitLim * hitLim) {
        b.hitCooldown = 0.14;
        b.hp -= damage;
        b.wobbleTimer = 0.16;
        b.sprite.setTintFill(0xffffff);

        if (b.hp <= 0) {
          this.shatterBreakable(b);
        }
      }
    }
  }

  private shatterBreakable(b: BreakableRuntime): void {
    b.broken = true;
    b.respawnTimer = 42.0;
    b.sprite.setVisible(false);
    b.shadow.setVisible(false);
    b.glow?.setVisible(false);

    gothicAudio.playBreak();

    // Flying splinter/stone/crystal shards!
    const shardTint =
      b.key === 'break_wooden_barrel'
        ? 0x9c6f44
        : b.key === 'break_crystal_cluster'
          ? 0xff3b6b
          : b.key === 'break_candelabra'
            ? 0xffbe5c
            : 0xc27d56;

    for (let s = 0; s < 9; s++) {
      const angle = (s / 9) * Math.PI * 2 + Math.random() * 0.4;
      const dist = Phaser.Math.Between(24, 58);
      const shard = this.add
        .image(b.x, b.y, 'vfx_shard')
        .setDepth(22)
        .setScale(Phaser.Math.FloatBetween(0.7, 1.25))
        .setTint(shardTint)
        .setRotation(Math.random() * Math.PI * 2);
      this.tweens.add({
        targets: shard,
        x: b.x + Math.cos(angle) * dist,
        y: b.y + Math.sin(angle) * dist + 10,
        rotation: shard.rotation + Phaser.Math.FloatBetween(-4, 4),
        alpha: 0,
        duration: Phaser.Math.Between(300, 480),
        ease: 'Cubic.easeOut',
        onComplete: () => shard.destroy(),
      });
    }

    // Strict Scarcity Loot Table: at most 2 Blood Chalices on the map & rare drop chance scaled by difficulty!
    const activeChalices = this.pickups.reduce((acc, p) => acc + (p.kind === 'chalice' ? 1 : 0), 0);
    const chaliceChance = activeChalices < 2 ? this.difficultyDef.chaliceDropChance : 0;
    const roll = Math.random();

    if (roll < chaliceChance) {
      this.spawnLootPickup('chalice', b.x, b.y);
    } else if (roll < chaliceChance + 0.08) {
      this.spawnLootPickup('magnet', b.x, b.y);
    } else if (roll < 0.42) {
      this.inventory.souls += Math.round(12 * this.difficultyDef.soulMult);
      this.spawnXpGem(b.x, b.y, 12, 'ruby');
      this.spawnFloatingNotice(b.x, b.y - 14, '+ALMAS', '#ffd166');
    } else {
      this.spawnXpGem(b.x - 8, b.y, 5, 'amber');
      this.spawnXpGem(b.x + 8, b.y, 4, 'sapphire');
    }
  }

  private spawnLootPickup(kind: 'chalice' | 'magnet', x: number, y: number): void {
    const tex = kind === 'chalice' ? 'pickup_blood_chalice' : 'pickup_astral_magnet';
    const glowColor = kind === 'chalice' ? 0xff2a55 : 0x67d4ff;

    const glow = this.add
      .image(x, y, 'vfx_aura_ring')
      .setDepth(5)
      .setScale(0.32)
      .setTint(glowColor)
      .setBlendMode(Phaser.BlendModes.ADD);

    const sprite = this.add
      .image(x, y - 16, tex)
      .setDepth(ySortDepth(y + 18))
      .setScale(0.25);

    this.tweens.add({
      targets: sprite,
      y,
      scaleX: 0.96,
      scaleY: 0.96,
      duration: 340,
      ease: 'Back.easeOut',
    });

    this.pickups.push({
      kind,
      sprite,
      glow,
      x,
      y,
      bobSeed: Math.random() * Math.PI * 2,
    });
  }

  private collectLootPickup(pk: PickupRuntime): void {
    if (pk.kind === 'chalice') {
      gothicAudio.playPickup(false);
      const heal = 18;
      this.hp = Math.min(this.stats.maxHp, this.hp + heal);
      this.spawnRingBurst(this.heroX, this.heroY, 0xff2a55, 14);
      this.spawnFloatingNotice(this.heroX, this.heroY - 34, `+${heal} VIDA`, '#7effb2');
    } else {
      gothicAudio.playPickup(true);
      // Vacuum EVERY XP Gem on the entire map!!
      for (const g of this.gems) {
        g.magnetized = true;
        g.magnetTime = 0.12;
      }
      this.spawnRingBurst(this.heroX, this.heroY, 0x67d4ff, 26);
      this.spawnFloatingNotice(this.heroX, this.heroY - 36, 'VÁCUO ASTRAL!', '#7ce8ff');
    }
    this.pushHudUpdate();
  }

  private spawnLeafRustle(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const p = this.add
        .image(x + Phaser.Math.Between(-10, 10), y, 'vfx_shard')
        .setDepth(18)
        .setScale(0.55)
        .setTint(this.stageDef.palette.emberTint)
        .setAlpha(0.75);
      this.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-18, 18),
        y: y - Phaser.Math.Between(12, 24),
        rotation: Phaser.Math.FloatBetween(-2, 2),
        alpha: 0,
        duration: 320,
        onComplete: () => p.destroy(),
      });
    }
  }

  private getActEscalation(): IntraMatchEscalation {
    return computeIntraMatchEscalation(this.elapsedSeconds, this.difficultyId, this.inventory);
  }

  private updateWaveDirector(dt: number): void {
    const t = this.elapsedSeconds;
    const elapsedMins = t / 60;
    const esc = this.getActEscalation();
    const maxActiveEnemies = esc.maxHorde;

    // 1. Unified 7-Stage Boss Milestones:
    //    - 10:00 (600s): Act II Herald Sub-Boss
    //    - 20:00 (1200s): 1st Major Stage Boss (boss20Min)
    //    - 30:00 (1800s): 2nd Major Stage Boss (boss30Min) -> Victory / Continue to 40:00 choice!
    //    - 40:00 (2400s): Final Supreme Overlord (boss40Min) -> Final stage completion!
    if (t >= 600 && !this.spawnedMilestones.has('act_10_boss')) {
      this.spawnedMilestones.add('act_10_boss');
      const midDef = ENEMIES[this.stageDef.midBoss];
      this.spawnBoss(
        this.stageDef.midBoss,
        `ATO II (10:00) · ${midDef.name}`,
        'A horda acelera e fica mais brutal! Derrote o Comandante!',
        'act_10_boss'
      );
      const surgeKind = this.stageDef.enemyPool[Math.min(this.stageDef.enemyPool.length - 1, 2)];
      this.spawnCircleWave(surgeKind, Math.round(this.difficultyDef.bossEscortCount * 0.85));
    }

    if (t >= 1200 && !this.spawnedMilestones.has('major_20_boss')) {
      this.spawnedMilestones.add('major_20_boss');
      const b20 = ENEMIES[this.stageDef.boss20Min];
      this.spawnBoss(
        this.stageDef.boss20Min,
        `1º CHEFÃO (20:00) · ${b20.name}`,
        'Primeiro Guardião Maior! Derrote-o para conquistar 2 Relicários Dourados!',
        'major_20_boss'
      );
      const escortKind = this.stageDef.enemyPool[Math.min(this.stageDef.enemyPool.length - 1, 3)];
      this.spawnCircleWave(escortKind, this.difficultyDef.bossEscortCount);
      if (this.difficultyId === 'epic' || this.difficultyId === 'holi_shit') {
        const guardKind = this.stageDef.subBossPool[0] ?? this.stageDef.midBoss;
        this.spawnBoss(
          guardKind,
          `Guarda-Costas · ${ENEMIES[guardKind].name}`,
          'Escolta implacável do 1º Chefão!',
          'sub_boss'
        );
      }
    }

    if (t >= 1800 && !this.spawnedMilestones.has('major_30_boss')) {
      this.spawnedMilestones.add('major_30_boss');
      const b30 = ENEMIES[this.stageDef.boss30Min];
      this.spawnBoss(
        this.stageDef.boss30Min,
        `2º CHEFÃO (30:00) · ${b30.name}`,
        'Derrote o 2º Chefão para vencer a Fase ou seguir até os 40 minutos!',
        'major_30_boss'
      );
      const escortKind = this.stageDef.enemyPool[Math.min(this.stageDef.enemyPool.length - 1, 4)];
      this.spawnCircleWave(escortKind, Math.round(this.difficultyDef.bossEscortCount * 1.2));
    }

    if (t >= this.stageDef.durationSeconds && !this.spawnedMilestones.has('final_40_boss')) {
      this.spawnedMilestones.add('final_40_boss');
      const b40 = ENEMIES[this.stageDef.boss40Min];
      this.spawnBoss(
        this.stageDef.boss40Min,
        `CHEFÃO SUPREMO (40:00) · ${b40.name}`,
        'Último Guardião do Eclipse! Derrote-o para finalizar de vez a Fase!',
        'final_40_boss'
      );
      const apexEscort = this.stageDef.enemyPool[this.stageDef.enemyPool.length - 1];
      this.spawnCircleWave(apexEscort, Math.round(this.difficultyDef.bossEscortCount * 1.4));
    }

    // 2. Recurring Regional Sub-Bosses scaled dynamically by difficulty + match progression!
    this.subBossTimer -= dt;
    if (this.subBossTimer <= 0) {
      this.subBossWaveIndex += 1;
      const freqAccel = Math.max(0.58, 1 - elapsedMins * 0.011);
      this.subBossTimer = Math.max(26, this.difficultyDef.subBossIntervalSec * freqAccel);

      let subCount = this.difficultyDef.subBossBaseCount;
      if (this.difficultyId === 'normal' && elapsedMins >= 16) subCount = 2;
      else if (this.difficultyId === 'hard' && elapsedMins >= 12) subCount = 2;
      else if (this.difficultyId === 'epic' && elapsedMins >= 20) subCount = 3;
      else if (this.difficultyId === 'holi_shit' && elapsedMins >= 10) subCount = 3;

      for (let s = 0; s < subCount; s++) {
        const useMidBoss = (this.subBossWaveIndex + s) % 3 === 0;
        const pool = this.stageDef.subBossPool;
        const kind = useMidBoss
          ? this.stageDef.midBoss
          : pool[(this.subBossWaveIndex + s) % pool.length];
        const def = ENEMIES[kind];
        this.spawnBoss(
          kind,
          `Sub-Chefe: ${def.name}`,
          'Campeão Regional à espreita — derruba Relicário Dourado!',
          'sub_boss'
        );
      }
      const escort = this.stageDef.enemyPool[Math.min(this.stageDef.enemyPool.length - 1, Math.floor(elapsedMins / 8))];
      this.spawnCircleWave(escort, Math.round(10 * this.difficultyDef.hordeMult));
    }

    // 3. Periodic Horde Encirclement Surges scaled steeply with time & difficulty!
    this.hordeSurgeTimer -= dt;
    if (this.hordeSurgeTimer <= 0 && this.enemies.length < maxActiveEnemies) {
      this.hordeSurgeTimer = Math.max(12, this.difficultyDef.surgeIntervalSec - elapsedMins * 0.45);
      const pool = this.stageDef.enemyPool;
      const unlockedMax = Math.min(pool.length, 3 + Math.floor(elapsedMins / 5));
      const pickKind = pool[Math.floor(Math.random() * unlockedMax)];
      const waveSize = Math.min(
        56,
        Math.round((15 + elapsedMins * 1.55) * this.difficultyDef.hordeMult)
      );
      this.spawnCircleWave(pickKind, waveSize);
    }

    if (this.enemies.length >= maxActiveEnemies) return;

    const stageMult = 0.92 + (this.stageDef.difficultyMult - 1) * 0.14;
    const spawnsPerSecond = esc.spawnsPerSecond * stageMult;
    this.spawnAccumulator += spawnsPerSecond * dt;

    const pool = this.stageDef.enemyPool;
    const unlockedCount = Math.min(pool.length, Math.max(3, 3 + Math.floor(elapsedMins / 4)));

    while (this.spawnAccumulator >= 1 && this.enemies.length < maxActiveEnemies) {
      this.spawnAccumulator -= 1;
      const biasPow = elapsedMins < 8 ? 1.5 : elapsedMins < 20 ? 1.12 : 0.84;
      const idx = Math.min(unlockedCount - 1, Math.floor(Math.pow(Math.random(), biasPow) * unlockedCount));
      const kind = pool[idx];
      for (let p = 0; p < esc.packSize && this.enemies.length < maxActiveEnemies; p++) {
        this.spawnEnemyAroundHero(kind);
      }
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
        'none'
      );
    }
  }

  private spawnBoss(
    kind: EnemyKind,
    title: string,
    subtitle: string,
    bossRole: BossRole
  ): void {
    gothicAudio.playBossHorn();
    this.cameras.main.shake(380, bossRole === 'major_20_boss' || bossRole === 'major_30_boss' || bossRole === 'final_40_boss' ? 0.0085 : 0.006);
    this.callbacks?.onBannerAnnouncement(title, subtitle);
    const angle = Math.random() * Math.PI * 2;
    this.spawnEnemyAt(
      kind,
      this.heroX + Math.cos(angle) * 440,
      this.heroY + Math.sin(angle) * 440,
      bossRole,
      title
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
      'none'
    );
  }

  private spawnEnemyAt(
    kind: EnemyKind,
    x: number,
    y: number,
    bossRole: BossRole,
    customTitle?: string
  ): void {
    const def = ENEMIES[kind];
    const esc = this.getActEscalation();
    const isBossUnit = bossRole !== 'none' || Boolean(def.isBoss);
    const isElite =
      !isBossUnit && this.elapsedSeconds > 35 && Math.random() < this.difficultyDef.eliteChance;

    const baseRoleHpMult: Record<BossRole, number> = {
      none: 1,
      sub_boss: def.isBoss ? 1.15 : 8.5,
      act_10_boss: 2.1,
      major_20_boss: 4.4,
      major_30_boss: 6.2,
      final_40_boss: 8.8,
    };

    const eliteMult = isElite ? 3.2 : 1.0;
    const scaledHp = Math.round(
      def.hp *
        this.stageDef.difficultyMult *
        (isBossUnit
          ? baseRoleHpMult[bossRole] * Math.max(1.2, esc.hpMult * 0.42)
          : esc.hpMult * eliteMult)
    );
    const visualScale = isBossUnit
      ? Math.max(def.scale, def.isBoss ? def.scale : def.scale * 1.45)
      : isElite
        ? def.scale * 1.28
        : def.scale;

    const shadow = this.add
      .image(x, y + (isBossUnit ? 50 : 30) * visualScale, 'vfx_shadow')
      .setDepth(3)
      .setScale(visualScale * 0.95, visualScale * 0.72)
      .setAlpha(0);

    const sprite = this.add
      .sprite(x, y, `enemy_${kind}`, Phaser.Math.Between(0, 7))
      .setDepth(ySortDepth(y + 28, isBossUnit ? 2 : isElite ? 1 : 0))
      .setScale(visualScale * 0.25, visualScale * 0.1)
      .setAlpha(0)
      .setTint(isBossUnit ? 0xff4d6d : isElite ? 0xff9f1c : 0x2a1428);
    sprite.play(`enemy_${kind}_move`);

    const ripple = this.add
      .image(x, y + 14, 'vfx_particle')
      .setTint(isBossUnit ? 0xff2a55 : isElite ? 0xffd166 : this.stageDef.palette.emberTint)
      .setScale(0.5)
      .setAlpha(0.62)
      .setDepth(3);
    this.tweens.add({
      targets: ripple,
      scaleX: isBossUnit ? 6 : isElite ? 4 : 2.8,
      scaleY: isBossUnit ? 3 : isElite ? 2 : 1.4,
      alpha: 0,
      duration: 380,
      onComplete: () => ripple.destroy(),
    });

    this.enemies.push({
      id: this.nextEnemyId++,
      kind,
      def,
      displayName: customTitle ?? def.name,
      sprite,
      shadow,
      x,
      y,
      radius: def.radius * (isBossUnit && !def.isBoss ? 1.45 : isElite ? 1.22 : 1),
      hp: scaledHp,
      maxHp: scaledHp,
      vx: 0,
      vy: 0,
      knockVx: 0,
      knockVy: 0,
      active: true,
      dying: false,
      bossRole,
      isElite,
      burnTimer: 0,
      burnTickTimer: 0,
      spawnProgress: 0,
      hitFlashTimer: 0,
      squashTimer: 0,
      animSeed: Math.random() * Math.PI * 2,
      auraContactTimer: 0,
      bossChargeTimer: (kind === 'werewolf' ? 3.2 : 3.8) * this.difficultyDef.bossAbilityCdMult,
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

  private getForgeBonus(baseId: BaseWeaponId): WeaponForgeBonus {
    return computeWeaponForgeBonus(this.inventory?.weaponForge?.[baseId] ?? 0);
  }

  private rollCrit(force = false, bonusCrit = 0): boolean {
    return force || Math.random() < Math.min(0.95, this.stats.critChance + bonusCrit);
  }

  private updateWeapons(time: number, dt: number): void {
    const w = this.inventory.weapons;

    const whipTier = w.abyssal_leviathan ? 2 : w.blood_rose ? 1 : 0;
    const whipLv = whipTier === 2 ? 3 : whipTier === 1 ? (w.blood_rose ?? 1) : (w.whip ?? 0);
    if (whipLv > 0) {
      this.weaponTimers.whip -= dt;
      if (this.weaponTimers.whip <= 0) {
        const baseCd =
          whipTier === 2 ? 0.65 : whipTier === 1 ? 0.82 : Math.max(0.92, 1.3 - whipLv * 0.08);
        this.weaponTimers.whip = baseCd * this.stats.cooldown * this.getForgeBonus('whip').cooldownMult;
        this.fireWhipSlash(whipLv, whipTier);
      }
    }

    const wandTier = w.supernova_staff ? 2 : w.star_torrent ? 1 : 0;
    const wandLv = wandTier === 2 ? 3 : wandTier === 1 ? (w.star_torrent ?? 1) : (w.wand ?? 0);
    if (wandLv > 0) {
      this.weaponTimers.wand -= dt;
      if (this.weaponTimers.wand <= 0) {
        const baseCd =
          wandTier === 2 ? 0.13 : wandTier === 1 ? 0.16 : Math.max(0.45, 0.84 - wandLv * 0.09);
        this.weaponTimers.wand = baseCd * this.stats.cooldown * this.getForgeBonus('wand').cooldownMult;
        this.fireWandBolts(wandLv, wandTier);
      }
    }

    const bibleTier = w.seraphim_choir ? 2 : w.immortal_vesper ? 1 : 0;
    const bibleLv = bibleTier === 2 ? 3 : bibleTier === 1 ? (w.immortal_vesper ?? 1) : (w.bible ?? 0);
    this.updateBibleOrbitals(time, dt, bibleLv, bibleTier);

    const axeTier = w.doomsday_guillotine ? 2 : w.eclipse_scythe ? 1 : 0;
    const axeLv = axeTier === 2 ? 3 : axeTier === 1 ? (w.eclipse_scythe ?? 1) : (w.axe ?? 0);
    if (axeLv > 0) {
      this.weaponTimers.axe -= dt;
      if (this.weaponTimers.axe <= 0) {
        const baseCd =
          axeTier === 2 ? 0.85 : axeTier === 1 ? 1.1 : Math.max(1.2, 1.8 - axeLv * 0.1);
        this.weaponTimers.axe = baseCd * this.stats.cooldown * this.getForgeBonus('axe').cooldownMult;
        this.fireAxesOrScythes(axeLv, axeTier);
      }
    }

    const thuribleTier = w.crimson_eclipse_aura ? 2 : w.devouring_shroud ? 1 : 0;
    const thuribleLv =
      thuribleTier === 2 ? 3 : thuribleTier === 1 ? (w.devouring_shroud ?? 1) : (w.thurible ?? 0);
    this.updateThuribleAura(time, dt, thuribleLv, thuribleTier);

    const lightTier = w.wrath_of_solaris ? 2 : w.seven_judgment ? 1 : 0;
    const lightLv =
      lightTier === 2 ? 3 : lightTier === 1 ? (w.seven_judgment ?? 1) : (w.lightning ?? 0);
    if (lightLv > 0) {
      this.weaponTimers.lightning -= dt;
      if (this.weaponTimers.lightning <= 0) {
        const baseCd =
          lightTier === 2 ? 0.92 : lightTier === 1 ? 1.25 : Math.max(1.55, 2.45 - lightLv * 0.16);
        this.weaponTimers.lightning =
          baseCd * this.stats.cooldown * this.getForgeBonus('lightning').cooldownMult;
        this.fireLightningStrikes(lightLv, lightTier);
      }
    }

    const daggersTier = w.phantom_storm ? 2 : w.thousand_fangs ? 1 : 0;
    const daggersLv =
      daggersTier === 2 ? 3 : daggersTier === 1 ? (w.thousand_fangs ?? 1) : (w.daggers ?? 0);
    if (daggersLv > 0) {
      this.weaponTimers.daggers -= dt;
      if (this.weaponTimers.daggers <= 0) {
        const baseCd =
          daggersTier === 2 ? 0.18 : daggersTier === 1 ? 0.22 : Math.max(0.55, 0.95 - daggersLv * 0.08);
        this.weaponTimers.daggers =
          baseCd * this.stats.cooldown * this.getForgeBonus('daggers').cooldownMult;
        this.firePhantomDaggers(daggersLv, daggersTier);
      }
    }

    const flaskTier = w.gehenna_inferno ? 2 : w.purifying_tide ? 1 : 0;
    const flaskLv =
      flaskTier === 2 ? 3 : flaskTier === 1 ? (w.purifying_tide ?? 1) : (w.flask ?? 0);
    if (flaskLv > 0) {
      this.weaponTimers.flask -= dt;
      if (this.weaponTimers.flask <= 0) {
        const baseCd =
          flaskTier === 2 ? 1.45 : flaskTier === 1 ? 1.8 : Math.max(2.1, 3.0 - flaskLv * 0.16);
        this.weaponTimers.flask = baseCd * this.stats.cooldown * this.getForgeBonus('flask').cooldownMult;
        this.fireAlchemicalFlasks(flaskLv, flaskTier);
      }
    }

    const crossTier = w.excalibur_zenith ? 2 : w.celestial_blade ? 1 : 0;
    const crossLv =
      crossTier === 2 ? 3 : crossTier === 1 ? (w.celestial_blade ?? 1) : (w.cross ?? 0);
    if (crossLv > 0) {
      this.weaponTimers.cross -= dt;
      if (this.weaponTimers.cross <= 0) {
        const baseCd =
          crossTier === 2 ? 0.85 : crossTier === 1 ? 1.05 : Math.max(1.15, 1.75 - crossLv * 0.1);
        this.weaponTimers.cross = baseCd * this.stats.cooldown * this.getForgeBonus('cross').cooldownMult;
        this.fireJudgmentCrosses(crossLv, crossTier);
      }
    }
  }

  private fireWhipSlash(lv: number, tier: 0 | 1 | 2): void {
    this.triggerHeroAttackAnim();
    gothicAudio.playWhip(tier > 0);
    const fb = this.getForgeBonus('whip');
    const slashes =
      (tier === 2 ? 4 : tier === 1 ? (lv >= 3 ? 3 : 2) : lv >= 2 ? 2 : 1) +
      Math.min(2, this.stats.amount) +
      fb.bonusAmount;
    const baseDamage =
      (tier === 2 ? 92 : tier === 1 ? 48 + lv * 10 : 20 + lv * 7.5) *
      this.stats.might *
      fb.damageMult;
    const areaScale =
      (tier === 2 ? 1.95 : tier === 1 ? 1.38 + lv * 0.1 : 1 + lv * 0.08) *
      this.stats.area *
      fb.areaMult;

    for (let i = 0; i < slashes; i++) {
      const dir = i % 2 === 0 ? this.facing : -this.facing;
      const offsetY = i >= 2 ? (i % 2 === 0 ? -34 : 34) : -6 + i * 14;
      this.time.delayedCall(i * 65, () => {
        if (this.isSimulationPaused()) return;
        const sx = this.heroX + dir * (74 * areaScale);
        const sy = this.heroY + offsetY;

        const slash = this.add
          .image(sx, sy, 'vfx_whip_slash')
          .setDepth(22)
          .setFlipX(dir < 0)
          .setScale(0.2 * areaScale, 0.58 * areaScale)
          .setTint(tier === 2 ? 0xffbe55 : tier === 1 ? 0xff2a55 : 0xfff6dc)
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
        const reachY = 42 * areaScale;
        this.damageBreakablesInRadius(sx, sy, reachX * 0.85, baseDamage);

        const candidates = this.grid.queryRadius(sx, sy, reachX);
        for (const enemy of candidates) {
          if (
            Math.abs(enemy.x - sx) <= reachX + enemy.radius &&
            Math.abs(enemy.y - sy) <= reachY + enemy.radius
          ) {
            const isCrit = this.rollCrit(tier > 0, this.getForgeBonus('whip').critBonus);
            this.damageEnemy(
              enemy,
              isCrit ? baseDamage * (tier === 2 ? 1.75 : 1.55) : baseDamage,
              dir * 225,
              0,
              isCrit,
              tier === 2 ? 2.4 : tier === 1 ? 1.6 : 0
            );
          }
        }
      });
    }
  }

  private fireWandBolts(lv: number, tier: 0 | 1 | 2): void {
    const nearest = this.grid.findNearest(this.heroX, this.heroY, 640);
    if (!nearest) return;

    this.triggerHeroAttackAnim();
    const fb = this.getForgeBonus('wand');
    const count =
      (tier === 2 ? 3 : tier === 1 ? 1 + Math.floor(lv / 2) : 1 + Math.floor(lv / 2)) +
      this.stats.amount +
      fb.bonusAmount;
    const damage =
      (tier === 2 ? 42 : tier === 1 ? 26 + lv * 6 : 15 + lv * 5.5) *
      this.stats.might *
      fb.damageMult;
    const pierce = tier === 2 ? 6 : tier === 1 ? 3 + lv : lv >= 3 ? 2 : 1;

    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * (tier === 2 ? 28 : tier === 1 ? 40 : 72), () => {
        if (this.isSimulationPaused()) return;
        const target = this.grid.findNearest(this.heroX, this.heroY, 640) ?? nearest;
        const spread = tier === 2 ? (i - (count - 1) / 2) * 0.08 : Phaser.Math.FloatBetween(-0.06, 0.06);
        const angle = Math.atan2(target.y - this.heroY, target.x - this.heroX) + spread;
        const speed = (tier === 2 ? 680 : tier === 1 ? 560 : 430 + lv * 20) * this.stats.projSpeed;

        gothicAudio.playWand(tier > 0);
        const sprite = this.add
          .image(this.heroX, this.heroY - 6, 'vfx_wand_bolt')
          .setDepth(20)
          .setScale(this.stats.area * fb.areaMult * (tier === 2 ? 1.55 : tier === 1 ? 1.25 : 1))
          .setRotation(angle)
          .setTint(tier === 2 ? 0x00e5ff : tier === 1 ? 0x9ef0ff : 0xffffff)
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
          radius: 13 * this.stats.area * fb.areaMult,
          life: 1.5,
          crit: this.rollCrit(tier === 2, fb.critBonus),
          lifeSteal: 0,
          aoeBurstRadius: tier === 2 ? 64 * this.stats.area * fb.areaMult : undefined,
          hitIds: new Set(),
        });
      });
    }
  }

  private firePhantomDaggers(lv: number, tier: 0 | 1 | 2): void {
    this.triggerHeroAttackAnim();
    const fb = this.getForgeBonus('daggers');
    const count =
      (tier === 2 ? 7 : tier === 1 ? 3 + lv : 2 + Math.floor(lv * 0.8)) +
      this.stats.amount +
      fb.bonusAmount;
    const damage =
      (tier === 2 ? 44 : tier === 1 ? 26 + lv * 6 : 14 + lv * 5) *
      this.stats.might *
      fb.damageMult;
    const baseAngle = Math.atan2(this.aimY, this.aimX);
    const speed = (tier === 2 ? 780 : tier === 1 ? 680 : 520 + lv * 25) * this.stats.projSpeed;

    gothicAudio.playWand(true);
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * (tier === 2 ? 0.14 : 0.11);
      const angle = baseAngle + spread;
      const sprite = this.add
        .image(this.heroX, this.heroY - 4, 'vfx_dagger')
        .setDepth(20)
        .setScale(this.stats.area * fb.areaMult * (tier === 2 ? 1.5 : tier === 1 ? 1.3 : 1.05))
        .setRotation(angle)
        .setTint(tier === 2 ? 0x9ef0ff : tier === 1 ? 0xffffff : 0xcaf0f8)
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
        pierce: tier === 2 ? 7 : tier === 1 ? 4 + lv : lv >= 3 ? 2 : 1,
        radius: 12 * this.stats.area * fb.areaMult,
        life: 1.18,
        crit: this.rollCrit(tier === 2 || (tier === 1 && Math.random() < 0.45), fb.critBonus),
        lifeSteal: 0,
        hitIds: new Set(),
      });
    }
  }

  private fireAlchemicalFlasks(lv: number, tier: 0 | 1 | 2): void {
    const fb = this.getForgeBonus('flask');
    const count =
      (tier === 2 ? 4 : tier === 1 ? 2 + lv : 1 + Math.floor(lv / 2)) +
      Math.min(2, this.stats.amount) +
      fb.bonusAmount;
    const poolRadius =
      (tier === 2 ? 130 : tier === 1 ? 85 + lv * 10 : 54 + lv * 7) *
      this.stats.area *
      fb.areaMult;
    const poolDamage =
      (tier === 2 ? 44 : tier === 1 ? 22 + lv * 5 : 9 + lv * 3.8) *
      this.stats.might *
      fb.damageMult;
    const duration = tier === 2 ? 5.2 : tier === 1 ? 4.4 : 2.8 + lv * 0.25;
    const palette: FirePoolRuntime['palette'] =
      tier === 2 ? 'hellfire' : tier === 1 ? 'purifying' : 'alchemical';

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.9;
      const dist = Phaser.Math.Between(90, tier === 2 ? 250 : 210);
      const tx = this.heroX + Math.cos(angle) * dist;
      const ty = this.heroY + Math.sin(angle) * dist;

      const bottle = this.add
        .image(this.heroX, this.heroY - 12, 'vfx_particle')
        .setDepth(21)
        .setScale(1.15)
        .setTint(tier === 2 ? 0xff7b00 : tier === 1 ? 0x00f5d4 : 0x52ff9a);

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
            .setTint(tier === 2 ? 0xff5a1f : tier === 1 ? 0x00bbf9 : 0x52ff9a)
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
            flameEmitTimer: 0,
            homing: tier > 0,
            palette,
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
      fp.flameEmitTimer -= dt;

      if (fp.homing) {
        const dx = this.heroX - fp.x;
        const dy = this.heroY - fp.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > 35) {
          const followSpd = fp.palette === 'hellfire' ? 68 : 44;
          fp.x += (dx / dist) * followSpd * dt;
          fp.y += (dy / dist) * followSpd * dt;
        }
      }

      // Emit real live-physics buoyant tongues of flame across the fire pool!
      if (fp.flameEmitTimer <= 0) {
        fp.flameEmitTimer = fp.palette === 'hellfire' ? 0.045 : 0.075;
        const ang = Math.random() * Math.PI * 2;
        const rDist = Math.sqrt(Math.random()) * fp.radius * 0.85;
        const fx = fp.x + Math.cos(ang) * rDist;
        const fy = fp.y + Math.sin(ang) * rDist * 0.72;
        this.spawnPhysicsFlame(
          fx,
          fy,
          Phaser.Math.FloatBetween(-24, 24),
          Phaser.Math.FloatBetween(-55, -25),
          fp.palette,
          fp.palette === 'hellfire' ? Phaser.Math.FloatBetween(0.75, 1.35) : Phaser.Math.FloatBetween(0.55, 1.05)
        );
      }

      fp.sprite
        .setPosition(fp.x, fp.y)
        .setRotation(time * 0.0018)
        .setAlpha(Math.min(0.65, (fp.life / 0.5) * 0.65));

      if (fp.tickTimer <= 0) {
        fp.tickTimer = 0.34;
        this.damageBreakablesInRadius(fp.x, fp.y, fp.radius, fp.damage);
        const victims = this.grid.queryRadius(fp.x, fp.y, fp.radius);
        for (const v of victims) {
          v.burnTimer = Math.max(v.burnTimer, fp.palette === 'hellfire' ? 3.2 : 1.8);
          this.damageEnemy(v, fp.damage, 0, 0, fp.palette === 'hellfire', 0);
        }
      }

      if (fp.life <= 0) {
        fp.sprite.destroy();
        this.firePools.splice(i, 1);
      }
    }
  }

  private spawnPhysicsFlame(
    x: number,
    y: number,
    vx: number,
    vy: number,
    palette: FlamePalette,
    baseScale = 0.75
  ): void {
    const MAX_FLAMES = 320;
    if (this.flames.length >= MAX_FLAMES) {
      const oldest = this.flames.shift();
      oldest?.sprite.destroy();
    }

    const useTongue = Math.random() < 0.72;
    const sprite = this.add
      .image(x, y, useTongue ? 'vfx_flame_tongue' : 'vfx_ember_spark')
      .setDepth(ySortDepth(y + 12, 0.5))
      .setOrigin(0.5, 0.85)
      .setScale(baseScale)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.flames.push({
      sprite,
      x,
      y,
      vx,
      vy,
      life: Phaser.Math.FloatBetween(0.36, 0.72),
      maxLife: 0.72,
      buoyancy: Phaser.Math.FloatBetween(115, 185),
      drag: Phaser.Math.FloatBetween(2.2, 3.6),
      turbulenceSeed: Math.random() * Math.PI * 2,
      baseScale,
      palette,
    });
  }

  private updateFirePhysics(time: number, dt: number): void {
    const cam = this.cameras.main;
    const padX = cam.width * 0.65;
    const padY = cam.height * 0.65;

    // 1. Emit live flames from on-screen torches (Braziers & intact Candelabras)
    this.sceneryFireTimer -= dt;
    if (this.sceneryFireTimer <= 0) {
      this.sceneryFireTimer = 0.085;
      for (let i = 0; i < this.ruins.length; i++) {
        const r = this.ruins[i];
        if (!r.isBrazier) continue;
        if (Math.abs(r.x - this.heroX) < padX && Math.abs(r.y - this.heroY) < padY) {
          this.spawnPhysicsFlame(
            r.x + Phaser.Math.FloatBetween(-6, 6),
            r.y - 18,
            Phaser.Math.FloatBetween(-16, 16),
            Phaser.Math.FloatBetween(-50, -24),
            'torch',
            Phaser.Math.FloatBetween(0.55, 0.9)
          );
        }
      }
      for (let i = 0; i < this.breakables.length; i++) {
        const b = this.breakables[i];
        if (b.broken || b.key !== 'break_candelabra') continue;
        if (Math.abs(b.x - this.heroX) < padX && Math.abs(b.y - this.heroY) < padY) {
          const candleX = b.x + Phaser.Math.Between(-10, 10);
          this.spawnPhysicsFlame(
            candleX,
            b.y - 22,
            Phaser.Math.FloatBetween(-10, 10),
            Phaser.Math.FloatBetween(-36, -18),
            'torch',
            0.42
          );
        }
      }
    }

    // 2. Integrate thermal buoyancy, aerodynamic drag, curl turbulence & airflow wake displacement!
    const heroSpeed = Math.hypot(this.heroVx, this.heroVy);
    const windX = Math.sin(time * 0.0012) * 18;

    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i];
      f.life -= dt;
      if (f.life <= 0) {
        f.sprite.destroy();
        this.flames.splice(i, 1);
        continue;
      }

      // Thermal upward buoyancy + global atmospheric drift + vorticity flicker
      f.vy -= f.buoyancy * dt;
      f.vx += (windX + Math.sin(time * 0.011 + f.turbulenceSeed + f.y * 0.045) * 95) * dt;

      // Physical wake turbulence from Hero running or Spectral Dashing through flames!
      if (heroSpeed > 25) {
        const hdx = f.x - this.heroX;
        const hdy = f.y - this.heroY;
        const hdSq = hdx * hdx + hdy * hdy;
        if (hdSq < 96 * 96) {
          const wake = (1 - Math.sqrt(hdSq) / 96) * (this.dashActiveTimer > 0 ? 5.2 : 2.1) * dt;
          f.vx += this.heroVx * wake + (hdx >= 0 ? 45 : -45) * dt;
          f.vy += this.heroVy * wake * 0.55;
        }
      }

      // Physical air displacement from flying Projectiles passing near flames!
      for (let pIdx = 0; pIdx < Math.min(20, this.projectiles.length); pIdx++) {
        const p = this.projectiles[pIdx];
        const pdx = f.x - p.x;
        const pdy = f.y - p.y;
        if (pdx * pdx + pdy * pdy < 62 * 62) {
          f.vx += p.vx * 0.16 * dt;
          f.vy += p.vy * 0.12 * dt;
        }
      }

      // Exponential aerodynamic drag
      const damp = Math.exp(-f.drag * dt);
      f.vx *= damp;
      f.vy *= damp;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      const lifeFrac = Phaser.Math.Clamp(f.life / f.maxLife, 0, 1);
      const age = 1 - lifeFrac;

      // Thermal color ramp by normalized age
      let tint = 0xffb703;
      if (f.palette === 'torch' || f.palette === 'hellfire') {
        tint = age < 0.25 ? 0xfff5d6 : age < 0.58 ? 0xffae2b : age < 0.84 ? 0xff451a : 0x801c1c;
      } else if (f.palette === 'purifying') {
        tint = age < 0.25 ? 0xe6ffff : age < 0.6 ? 0x00e5ff : 0x0077b6;
      } else {
        tint = age < 0.25 ? 0xe8fff0 : age < 0.6 ? 0x52ff9a : 0x15803d;
      }

      const stretch = f.baseScale * (1.05 - age * 0.55);
      f.sprite
        .setPosition(f.x, f.y)
        .setDepth(ySortDepth(f.y + 12, 0.5))
        .setRotation(Math.atan2(f.vx, -Math.min(-18, f.vy)) * 0.65)
        .setScale(stretch * 0.82, stretch * (1 + Math.min(0.45, Math.abs(f.vy) / 220)))
        .setTint(tint)
        .setAlpha(lifeFrac * 0.88);
    }
  }

  private fireJudgmentCrosses(lv: number, tier: 0 | 1 | 2): void {
    this.triggerHeroAttackAnim();
    gothicAudio.playAxe();
    const fb = this.getForgeBonus('cross');
    const count =
      (tier === 2 ? 5 : tier === 1 ? 2 + (lv >= 2 ? 1 : 0) : lv >= 3 ? 2 : 1) +
      this.stats.amount +
      fb.bonusAmount;
    const damage =
      (tier === 2 ? 85 : tier === 1 ? 42 + lv * 9 : 20 + lv * 7) *
      this.stats.might *
      fb.damageMult;
    const nearest = this.grid.findNearest(this.heroX, this.heroY, 540);
    const baseAngle = nearest
      ? Math.atan2(nearest.y - this.heroY, nearest.x - this.heroX)
      : Math.atan2(this.aimY, this.aimX);

    for (let i = 0; i < count; i++) {
      const spreadStep = tier === 2 ? (Math.PI * 2) / count : 0.35;
      const angle =
        tier === 2
          ? baseAngle + i * spreadStep
          : baseAngle + (i - (count - 1) / 2) * spreadStep;
      const outSpeed = (tier === 2 ? 450 : 340 + lv * 20) * this.stats.projSpeed;
      const vx = Math.cos(angle) * outSpeed;
      const vy = Math.sin(angle) * outSpeed;

      const sprite = this.add
        .image(this.heroX, this.heroY, tier > 0 ? 'vfx_celestial_blade' : 'vfx_cross')
        .setDepth(21)
        .setScale(this.stats.area * fb.areaMult * (tier === 2 ? 1.65 : tier === 1 ? 1.28 : 1.05))
        .setTint(tier === 2 ? 0xfff59d : 0xffffff)
        .setBlendMode(Phaser.BlendModes.ADD);

      this.projectiles.push({
        sprite,
        x: this.heroX,
        y: this.heroY,
        vx,
        vy,
        accelX: -vx * 1.95,
        accelY: -vy * 1.95,
        gravity: 0,
        spinSpeed: tier === 2 ? 16 : 12,
        damage,
        pierce: 99,
        radius: (tier === 2 ? 36 : tier === 1 ? 28 : 20) * this.stats.area * fb.areaMult,
        life: 2.35,
        crit: this.rollCrit(tier > 0, fb.critBonus),
        lifeSteal: 0,
        hitIds: new Set(),
      });
    }
  }

  private updateBibleOrbitals(
    time: number,
    dt: number,
    lv: number,
    tier: 0 | 1 | 2
  ): void {
    if (lv <= 0 && tier === 0) {
      if (this.orbitalSprites.length > 0) {
        this.orbitalSprites.forEach((s) => s.destroy());
        this.orbitalSprites = [];
      }
      return;
    }

    const fb = this.getForgeBonus('bible');
    const desiredCount =
      (tier === 2 ? 10 : tier === 1 ? 5 + lv : 1 + lv) + this.stats.amount + fb.bonusAmount;
    while (this.orbitalSprites.length < desiredCount) {
      const spr = this.add
        .image(this.heroX, this.heroY, 'vfx_bible')
        .setDepth(21)
        .setTint(tier === 2 ? 0xfff0a0 : tier === 1 ? 0xffe066 : 0xffffff);
      this.orbitalSprites.push(spr);
    }

    const cycle = (time * 0.001) % 5.0;
    const visibility =
      tier > 0
        ? 1
        : cycle < 0.35
          ? cycle / 0.35
          : cycle < 3.65
            ? 1
            : cycle < 4.0
              ? 1 - (cycle - 3.65) / 0.35
              : 0;

    const angularSpeed =
      (tier === 2 ? 5.6 : tier === 1 ? 4.2 + lv * 0.3 : 2.7 + lv * 0.25) /
      Math.max(0.7, fb.cooldownMult);
    this.orbitalAngle += angularSpeed * dt;
    const baseOrbitRadius =
      (tier === 2 ? 128 : tier === 1 ? 114 + lv * 6 : 84 + lv * 7) *
      this.stats.area *
      fb.areaMult *
      (0.4 + 0.6 * visibility);
    const damage =
      (tier === 2 ? 54 : tier === 1 ? 30 + lv * 6 : 14 + lv * 5) *
      this.stats.might *
      fb.damageMult;

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
      spr.setTint(tier === 2 ? 0xfff59d : tier === 1 ? 0xffe066 : 0xffffff);

      const outerRing = tier === 2 && i % 2 === 1;
      const ringRadius = outerRing ? baseOrbitRadius * 1.48 : baseOrbitRadius;
      const ringDir = outerRing ? -1 : 1;
      const theta = this.orbitalAngle * ringDir + (i / desiredCount) * Math.PI * 2;
      const ox = this.heroX + Math.cos(theta) * ringRadius;
      const oy = this.heroY + Math.sin(theta) * ringRadius;
      spr
        .setVisible(true)
        .setPosition(ox, oy)
        .setAlpha(visibility)
        .setScale(visibility * this.stats.area * fb.areaMult * (tier === 2 ? 1.35 : tier === 1 ? 1.2 : 1))
        .setRotation(theta + Math.PI / 2);

      if (visibility > 0.5) {
        const hitRad = 22 * this.stats.area * fb.areaMult;
        this.damageBreakablesInRadius(ox, oy, hitRad, damage);
        const hitList = this.grid.queryRadius(ox, oy, hitRad);
        for (const enemy of hitList) {
          if (!this.orbitalHitCooldowns.has(enemy.id)) {
            this.orbitalHitCooldowns.set(enemy.id, 0.32 * fb.cooldownMult);
            const pushAngle = Math.atan2(enemy.y - this.heroY, enemy.x - this.heroX);
            this.damageEnemy(
              enemy,
              damage,
              Math.cos(pushAngle) * 195,
              Math.sin(pushAngle) * 195,
              this.rollCrit(tier === 2, fb.critBonus),
              0
            );
          }
        }
      }
    }
  }

  private fireAxesOrScythes(lv: number, tier: 0 | 1 | 2): void {
    this.triggerHeroAttackAnim();
    gothicAudio.playAxe();
    const fb = this.getForgeBonus('axe');
    const count =
      (tier === 2 ? 8 : tier === 1 ? 3 + lv : 1 + Math.floor(lv / 2)) +
      this.stats.amount +
      fb.bonusAmount;
    const damage =
      (tier === 2 ? 96 : tier === 1 ? 50 + lv * 10 : 29 + lv * 10) *
      this.stats.might *
      fb.damageMult;

    for (let i = 0; i < count; i++) {
      if (tier > 0) {
        const angle = (i / count) * Math.PI * 2 + this.elapsedSeconds * (tier === 2 ? 1.4 : 0.9);
        const speed = (tier === 2 ? 410 : 330) * this.stats.projSpeed;
        const sprite = this.add
          .image(this.heroX, this.heroY, 'vfx_scythe')
          .setDepth(21)
          .setScale((tier === 2 ? 1.65 : 1.25) * this.stats.area * fb.areaMult)
          .setTint(tier === 2 ? 0xe8a0ff : 0xffffff)
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
          spinSpeed: tier === 2 ? 15 : 11,
          damage,
          pierce: 99,
          radius: (tier === 2 ? 34 : 26) * this.stats.area * fb.areaMult,
          life: 2.35,
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
          .setDepth(21)
          .setScale(1.05 * this.stats.area * fb.areaMult);
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
          radius: 21 * this.stats.area * fb.areaMult,
          life: 2.1,
          crit: this.rollCrit(Math.random() < 0.25, fb.critBonus),
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
    tier: 0 | 1 | 2
  ): void {
    if (lv <= 0 && tier === 0) {
      this.thuribleAura.setAlpha(0);
      return;
    }

    const fb = this.getForgeBonus('thurible');
    const radius =
      (tier === 2 ? 195 : tier === 1 ? 122 + lv * 14 : 70 + lv * 11) *
      this.stats.area *
      fb.areaMult;
    const pulse = 1 + Math.sin(time * 0.006) * 0.045;
    this.thuribleAura
      .setPosition(this.heroX, this.heroY + 4)
      .setDisplaySize(radius * 2 * pulse, radius * 2 * pulse)
      .setTint(tier === 2 ? 0xff1744 : tier === 1 ? 0xff3b6b : 0x9ef7c6)
      .setAlpha(tier === 2 ? 0.68 : tier === 1 ? 0.58 : 0.42)
      .setRotation(time * 0.0004);

    if (tier === 2 && Math.random() < 0.35) {
      const ang = Math.random() * Math.PI * 2;
      this.spawnPhysicsFlame(
        this.heroX + Math.cos(ang) * radius * 0.85,
        this.heroY + Math.sin(ang) * radius * 0.72,
        Math.cos(ang) * 45,
        -35,
        'hellfire',
        0.7
      );
    }

    const tickDamage =
      (tier === 2 ? 36 : tier === 1 ? 18 + lv * 4 : 6.5 + lv * 3) *
      this.stats.might *
      fb.damageMult;
    this.damageBreakablesInRadius(this.heroX, this.heroY, radius, tickDamage * 0.7);

    const candidates = this.grid.queryRadius(this.heroX, this.heroY, radius);
    for (const enemy of candidates) {
      enemy.auraContactTimer -= dt;
      if (enemy.auraContactTimer <= 0) {
        enemy.auraContactTimer = (tier === 2 ? 0.25 : tier === 1 ? 0.32 : 0.46) * fb.cooldownMult;
        const pushAngle = Math.atan2(enemy.y - this.heroY, enemy.x - this.heroX);
        if (tier === 2) {
          enemy.burnTimer = Math.max(enemy.burnTimer, 1.8);
        }
        this.damageEnemy(
          enemy,
          tickDamage,
          Math.cos(pushAngle) * 75,
          Math.sin(pushAngle) * 75,
          this.rollCrit(tier === 2, fb.critBonus),
          tier === 2 ? 0.55 : tier === 1 ? 0.35 : 0
        );
      }
    }
  }

  private fireLightningStrikes(lv: number, tier: 0 | 1 | 2): void {
    const inRange = this.grid.queryRadius(this.heroX, this.heroY, 540);
    if (inRange.length === 0) return;

    const fb = this.getForgeBonus('lightning');
    const strikes =
      (tier === 2 ? 7 : tier === 1 ? 3 + lv : 1 + Math.floor(lv / 2)) +
      this.stats.amount +
      fb.bonusAmount;
    const damage =
      (tier === 2 ? 108 : tier === 1 ? 60 + lv * 10 : 28 + lv * 9) *
      this.stats.might *
      fb.damageMult;
    const blastRadius =
      (tier === 2 ? 124 : tier === 1 ? 82 + lv * 8 : 58 + lv * 6) *
      this.stats.area *
      fb.areaMult;

    gothicAudio.playThunder();

    for (let i = 0; i < strikes; i++) {
      const pick = inRange[Phaser.Math.Between(0, inRange.length - 1)];
      if (!pick) continue;
      const tx = pick.x;
      const ty = pick.y;

      this.time.delayedCall(i * (tier === 2 ? 55 : 85), () => {
        if (this.isSimulationPaused()) return;
        const bolt = this.add
          .image(tx, ty - 105, 'vfx_lightning')
          .setDepth(24)
          .setScale(tier === 2 ? 1.65 : tier === 1 ? 1.35 : 1, 1.1)
          .setTint(tier === 2 ? 0xffe066 : tier === 1 ? 0xffb74d : 0xffffff)
          .setBlendMode(Phaser.BlendModes.ADD);

        const ring = this.add
          .image(tx, ty, 'vfx_aura_ring')
          .setDepth(5)
          .setScale(0.15)
          .setTint(tier === 2 ? 0xffc300 : tier === 1 ? 0xff9e44 : 0xff4d6d)
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

        this.damageBreakablesInRadius(tx, ty, blastRadius, damage);
        const victims = this.grid.queryRadius(tx, ty, blastRadius);
        for (const v of victims) {
          this.damageEnemy(v, damage, 0, -60, this.rollCrit(tier > 0, fb.critBonus), 0);
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

      this.damageBreakablesInRadius(p.x, p.y, p.radius, p.damage);

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
        if (p.aoeBurstRadius) {
          this.spawnRingBurst(p.x, p.y, 0x00e5ff, 8);
          const splash = this.grid.queryRadius(p.x, p.y, p.aoeBurstRadius);
          for (const sv of splash) {
            if (sv.id !== enemy.id) {
              this.damageEnemy(sv, p.damage * 0.55, 0, 0, false, 0);
            }
          }
        }
        if (p.pierce <= 0) break;
      }

      if (p.life <= 0 || p.pierce <= 0) {
        p.sprite.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateEnemies(time: number, dt: number): void {
    const esc = this.getActEscalation();
    const cam = this.cameras.main;
    const maxEnemyDist = Math.hypot(cam.width, cam.height) * 0.62 + 180;
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
      const isBossUnit = e.bossRole !== 'none' || Boolean(e.def.isBoss);
      if (!isBossUnit && distHero > maxEnemyDist) {
        const angle = Math.random() * Math.PI * 2;
        e.x = this.heroX + Math.cos(angle) * (cam.width / 2 + 68);
        e.y = this.heroY + Math.sin(angle) * (cam.height / 2 + 68);
        continue;
      }

      if (e.spawnProgress < 1) {
        e.spawnProgress = Math.min(1, e.spawnProgress + dt * 2.9);
      }

      let moveSpeed = e.def.speed * (isBossUnit ? Math.max(1.0, esc.spdMult * 0.85) : esc.spdMult);
      let dirX = dxHero / distHero;
      let dirY = dyHero / distHero;

      if (e.kind === 'bat' || e.kind === 'banshee' || e.kind === 'magma_imp' || e.kind === 'gargoyle') {
        const perpX = -dirY;
        const perpY = dirX;
        const wave = Math.sin(time * 0.006 + e.animSeed) * 0.42;
        dirX += perpX * wave;
        dirY += perpY * wave;
      } else if (e.kind === 'bone_crawler' || e.kind === 'abyssal_worm') {
        const perpX = -dirY;
        const perpY = dirX;
        const wave = Math.sin(time * 0.011 + e.animSeed) * 0.62;
        dirX += perpX * wave;
        dirY += perpY * wave;
      } else if (e.kind === 'werewolf') {
        e.bossChargeTimer -= dt;
        if (e.bossChargeTimer <= 0 && !e.bossCharging) {
          e.bossCharging = true;
          e.bossChargeTimer = 0.42;
          e.bossChargeDirX = dirX;
          e.bossChargeDirY = dirY;
        } else if (e.bossCharging) {
          dirX = e.bossChargeDirX;
          dirY = e.bossChargeDirY;
          moveSpeed *= 1.95;
          if (e.bossChargeTimer <= 0) {
            e.bossCharging = false;
            e.bossChargeTimer = 3.1;
          }
        }
      } else if (e.kind === 'necromancer') {
        e.bossChargeTimer -= dt;
        if (e.bossChargeTimer <= 0 && distHero < 480 && this.enemies.length < 580) {
          e.bossChargeTimer = 7.2 * this.difficultyDef.bossAbilityCdMult;
          this.spawnRingBurst(e.x, e.y, 0x52ff9a, 8);
          this.spawnEnemyAt(Math.random() < 0.5 ? 'skeleton' : 'bone_crawler', e.x + 28, e.y + 12, 'none');
        }
      } else if (e.kind === 'ash_wraith' || e.kind === 'inquisitor') {
        if (Math.random() < 0.16 && distHero < 560) {
          this.spawnPhysicsFlame(
            e.x,
            e.y - 6,
            -e.vx * 0.18,
            -28,
            e.kind === 'ash_wraith' ? 'hellfire' : 'torch',
            0.55
          );
        }
      }

      if (isBossUnit) {
        e.bossChargeTimer -= dt;
        if (e.bossChargeTimer <= 0 && !e.bossCharging) {
          e.bossCharging = true;
          e.bossChargeTimer = 0.65;
          e.bossChargeDirX = dirX;
          e.bossChargeDirY = dirY;
          this.spawnRingBurst(e.x, e.y, 0xff2a55, 10);

          // Difficulty & Major Boss variations: emit fire ring + summon skirmishers on Hard+ / Major Bosses!
          if (
            this.difficultyId !== 'normal' ||
            e.bossRole === 'major_20_boss' ||
            e.bossRole === 'major_30_boss' ||
            e.bossRole === 'final_40_boss'
          ) {
            for (let f = 0; f < 6; f++) {
              const fa = (f / 6) * Math.PI * 2;
              this.spawnPhysicsFlame(
                e.x + Math.cos(fa) * 26,
                e.y + Math.sin(fa) * 20,
                Math.cos(fa) * 95,
                Math.sin(fa) * 75 - 20,
                'hellfire',
                0.85
              );
            }
          }
          if (
            (e.bossRole === 'major_20_boss' ||
              e.bossRole === 'major_30_boss' ||
              e.bossRole === 'final_40_boss' ||
              this.difficultyId === 'holi_shit') &&
            this.enemies.length < 560
          ) {
            const minionKind = this.stageDef.enemyPool[0];
            this.spawnEnemyAt(minionKind, e.x + 36, e.y - 24, 'none');
            this.spawnEnemyAt(minionKind, e.x - 36, e.y + 24, 'none');
          }
        } else if (e.bossCharging) {
          dirX = e.bossChargeDirX;
          dirY = e.bossChargeDirY;
          moveSpeed *= 2.4;
          if (e.bossChargeTimer <= 0) {
            e.bossCharging = false;
            e.bossChargeTimer = 3.8 * this.difficultyDef.bossAbilityCdMult;
          }
        }
      }

      if (e.burnTimer > 0) {
        e.burnTimer = Math.max(0, e.burnTimer - dt);
        e.burnTickTimer -= dt;
        if (Math.random() < 0.25) {
          this.spawnPhysicsFlame(e.x + Phaser.Math.Between(-8, 8), e.y - 6, 0, -25, 'hellfire', 0.48);
        }
        if (e.burnTickTimer <= 0) {
          e.burnTickTimer = 0.5;
          this.damageEnemy(e, Math.max(6, Math.round(e.maxHp * 0.035 + 10)), 0, 0, false, 0);
          if (e.dying) continue;
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
      const isColossal = e.bossRole !== 'none' || Boolean(e.def.isBoss);
      const visualBase = isColossal
        ? (e.def.isBoss ? e.def.scale : e.def.scale * 1.45) * 0.84
        : (e.isElite ? e.def.scale * 1.24 : e.def.scale) * 0.78;
      let sx = visualBase * (0.45 + 0.55 * emergeEase);
      let sy = visualBase * (0.15 + 0.85 * emergeEase);

      if (e.squashTimer > 0) {
        e.squashTimer = Math.max(0, e.squashTimer - dt);
        const sq = e.squashTimer / 0.14;
        sx *= 1 + 0.2 * sq;
        sy *= 1 - 0.16 * sq;
      }

      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        e.sprite.setTintFill(0xffffff);
      } else if (e.spawnProgress < 1) {
        e.sprite.setTint(0x7c5a8a);
      } else if (e.burnTimer > 0) {
        e.sprite.setTint(0xff9f43);
      } else if (e.isElite) {
        e.sprite.setTint(0xffb703);
      } else {
        e.sprite.clearTint();
      }

      e.sprite
        .setPosition(e.x, e.y)
        .setDepth(ySortDepth(e.y + 28, e.def.isBoss ? 2 : 0))
        .setScale(sx, sy)
        .setAlpha(emergeEase)
        .setFlipX(dxHero < 0)
        .setRotation((dxHero >= 0 ? 1 : -1) * 0.03 * Math.sin(time * 0.008 + e.animSeed));

      e.shadow
        .setPosition(e.x, e.y + (e.def.isBoss ? 52 : 30) * e.def.scale)
        .setAlpha(0.58 * emergeEase);

      if (e.spawnProgress >= 0.85 && this.invulnTimer <= 0) {
        const hitDist = e.radius + 14;
        if (dxHero * dxHero + dyHero * dyHero <= hitDist * hitDist) {
          this.damageHero(
            Math.round(
              e.def.damage * esc.dmgMult * (0.85 + this.stageDef.difficultyMult * 0.15)
            )
          );
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

    const esc = this.getActEscalation();
    const resist = Math.min(0.96, enemy.def.knockbackResist + esc.knockbackBonus);
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
    const isBossUnit = enemy.bossRole !== 'none' || Boolean(enemy.def.isBoss);
    const soulGain =
      enemy.bossRole === 'final_40_boss'
        ? 300
        : enemy.bossRole === 'major_30_boss'
          ? 180
          : enemy.bossRole === 'major_20_boss'
            ? 120
            : isBossUnit
              ? 60
              : enemy.isElite
                ? 6
                : 1;
    this.inventory.souls += Math.round(soulGain * this.difficultyDef.soulMult);

    const esc = this.getActEscalation();
    const eliteXpMult = enemy.isElite ? 3.0 : isBossUnit ? 2.2 : 1.0;
    const xpReward = Math.max(1, Math.round(enemy.def.xpValue * esc.xpMult * eliteXpMult));
    this.spawnXpGem(enemy.x, enemy.y, xpReward, isBossUnit || enemy.isElite ? 'ruby' : enemy.def.gemTier);

    if (isBossUnit) {
      this.cameras.main.shake(460, 0.01);
      this.spawnRingBurst(enemy.x, enemy.y, 0xffd166, 30);

      if (enemy.bossRole === 'final_40_boss') {
        this.spawnFloatingNotice(enemy.x, enemy.y - 36, 'VICTORIA SUPREMA!', '#ffe79e');
        this.time.delayedCall(650, () => this.finishRun(true));
      } else if (enemy.bossRole === 'major_30_boss') {
        this.spawnRelicChest(enemy.x, enemy.y);
        const partialSummary: RunSummary = {
          victory: true,
          heroId: this.heroId,
          stageId: this.stageDef.id,
          difficultyId: this.difficultyId,
          elapsedSeconds: this.elapsedSeconds,
          level: this.inventory.level,
          kills: this.kills,
          souls: this.inventory.souls,
          inventory: this.inventory,
        };
        this.time.delayedCall(550, () => {
          if (this.runEnded) return;
          this.modalPaused = true;
          this.pushHudUpdate();
          this.callbacks?.onStage30MinBossCleared(
            partialSummary,
            () => {
              this.modalPaused = false;
              this.hp = Math.min(this.stats.maxHp, this.hp + Math.round(this.stats.maxHp * 0.5));
              this.callbacks?.onBannerAnnouncement(
                'ATO IV DESBLOQUEADO · RUMO AOS 40:00!',
                'Sobreviva até o Chefão Supremo aos 40 minutos para finalizar de vez a fase!'
              );
              this.pushHudUpdate();
            },
            () => {
              this.finishRun(true);
            }
          );
        });
      } else if (enemy.bossRole === 'major_20_boss') {
        this.spawnRelicChest(enemy.x - 24, enemy.y);
        this.spawnRelicChest(enemy.x + 24, enemy.y);
        this.callbacks?.onBannerAnnouncement(
          '1º CHEFÃO DERROTADO!',
          '2 Relicários Dourados obtidos! O 2º Chefão aguarda aos 30:00!'
        );
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
    const sprite = this.add.image(x, y - 24, 'relic_chest').setDepth(16).setScale(0.3);

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

    while (this.inventory.xp >= this.inventory.xpToNext) {
      this.inventory.xp -= this.inventory.xpToNext;
      this.inventory.level += 1;
      this.inventory.xpToNext = xpRequiredForLevel(this.inventory.level);
      this.pendingLevelUps += 1;
    }

    if (!this.modalPaused && this.pendingLevelUps > 0) {
      this.triggerLevelUpCeremony();
    }
  }

  private triggerLevelUpCeremony(): void {
    if (this.pendingLevelUps <= 0 || this.runEnded) return;
    this.pendingLevelUps -= 1;
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
      this.callbacks?.onSaveRunCheckpoint?.(this.exportRunCheckpoint());
      this.pushHudUpdate();

      if (this.pendingLevelUps > 0 && !this.runEnded) {
        this.time.delayedCall(90, () => this.triggerLevelUpCeremony());
      }
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
    this.callbacks?.onSaveRunCheckpoint?.(this.exportRunCheckpoint());
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
    this.callbacks?.onSaveRunCheckpoint?.(null);
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
        difficultyId: this.difficultyId,
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

  private spawnFloatingNotice(x: number, y: number, text: string, color: string): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color,
        stroke: '#120710',
        strokeThickness: 3.5,
      })
      .setOrigin(0.5)
      .setDepth(32);

    this.tweens.add({
      targets: label,
      y: y - 34,
      alpha: 0,
      duration: 780,
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
        .setDepth(23)
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
        .setDepth(24)
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
      if (e.active && !e.dying && (e.bossRole !== 'none' || e.def.isBoss)) {
        activeBoss = e;
        break;
      }
    }

    const esc = this.getActEscalation();
    gothicSoundtrack.setBattleIntensity(esc.act, Boolean(activeBoss));

    const altarPos = this.stageDef.hiddenAltarPos;
    const dxAltar = altarPos.x - this.heroX;
    const dyAltar = altarPos.y - this.heroY;
    const hiddenWeaponId = this.stageDef.hiddenWeapon;

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
      dashReadyRatio: 1 - Phaser.Math.Clamp(this.dashCooldownTimer / 2.4, 0, 1),
      dashCooldownRemaining: Math.max(0, this.dashCooldownTimer),
      stageName: this.stageDef.name,
      stageRoman: this.stageDef.roman,
      difficultyId: this.difficultyId,
      difficultyLabel: this.difficultyDef.label,
      actNumber: esc.act,
      actName: esc.actName,
      inventory: this.inventory,
      boss: activeBoss
        ? {
            name: activeBoss.displayName,
            hp: Math.max(0, Math.ceil(activeBoss.hp)),
            maxHp: activeBoss.maxHp,
          }
        : undefined,
      hiddenWeapon: {
        weaponId: hiddenWeaponId,
        weaponName: WEAPONS[hiddenWeaponId].name,
        altarName: this.stageDef.hiddenAltarName,
        alreadyUnlocked: this.metaUnlockedWeapons.includes(hiddenWeaponId),
        claimedInRun: this.hiddenAltarClaimed,
        distanceMeters: Math.max(0, Math.round(Math.hypot(dxAltar, dyAltar) / 28)),
        angleDeg: Math.round((Math.atan2(dyAltar, dxAltar) * 180) / Math.PI),
      },
    });
  }
}
