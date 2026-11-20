import { gothicAudio } from '../audio/GothicAudio';
import { gothicSoundtrack } from '../audio/GothicSoundtrack';
import {
  BaseWeaponId,
  DEFAULT_UNLOCKED_WEAPONS,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  DifficultyId,
  ENEMIES,
  ExclusiveWeaponId,
  ForgeableWeaponId,
  getRelicIconUrl,
  getWeaponDiscoveryStage,
  getWeaponIconUrl,
  HERO_ORDER,
  HERO_STAT_UPGRADE_META,
  HERO_STAT_UPGRADE_ORDER,
  HEROES,
  HeroId,
  HeroStatUpgradeKey,
  HeroUpgradeLevels,
  LORE_CHAPTERS,
  RELICS,
  RelicId,
  StageId,
  STAGES,
  WEAPONS,
  WeaponId,
} from '../data/loreData';
import {
  ALL_BASE_WEAPONS,
  ALL_EXCLUSIVE_WEAPONS,
  computeHeroWithUpgrades,
  computeWeaponForgeBonus,
  HERO_UPGRADE_GOLD_COSTS,
  MAX_HERO_UPGRADE_LEVEL,
  MAX_WEAPON_FORGE_LEVEL,
  UpgradeChoice,
  WEAPON_FORGE_COSTS,
  WEAPON_FORGE_GOLD_COSTS,
} from '../game/UpgradeLogic';
import { ArenaCallbacks, HudSnapshot, RunSummary, SavedActiveRun } from '../scenes/ArenaScene';
import { ViewportManager } from './ViewportManager';

const RECORDS_STORAGE_KEY = 'crimson_vesper.records.v2';
const ACTIVE_SLOT_KEY = 'crimson_vesper.active_slot.v1';
const SAVE_SLOTS = [0, 1, 2] as const;
type SaveSlotIndex = (typeof SAVE_SLOTS)[number];

interface SavedRecords {
  bestSeconds: number;
  bestKills: number;
  totalSouls: number;
  totalGold: number;
  victories: number;
  clearedStages: StageId[];
  unlockedWeapons: BaseWeaponId[];
  purchasedExclusiveWeapons: ExclusiveWeaponId[];
  heroUpgrades: Partial<Record<HeroId, HeroUpgradeLevels>>;
  weaponForge: Partial<Record<ForgeableWeaponId, number>>;
  lastSavedAt?: string;
  activeRun?: SavedActiveRun | null;
}

type MenuScreen = 'splash' | 'hero_select' | 'stage_select' | 'arsenal' | 'lore';
type InspectedPower = { kind: 'weapon'; id: WeaponId } | { kind: 'relic'; id: RelicId };

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function renderLevelPips(lv: number, maxLv: number): string {
  let dots = '';
  const total = Math.min(5, maxLv);
  for (let i = 1; i <= total; i++) {
    dots += `<span class="pip-dot ${i <= lv ? 'filled' : ''}"></span>`;
  }
  return `<div class="slot-pips">${dots}</div>`;
}

export class UIManager {
  private readonly root: HTMLElement;
  private readonly viewport: ViewportManager;
  private readonly curtain: HTMLElement;

  private currentScreen: MenuScreen = 'splash';
  private lastRenderedScreen: MenuScreen | null = null;
  private selectedHero: HeroId = 'alaric';
  private selectedStage: StageId = 'forest';
  private selectedDifficulty: DifficultyId = 'normal';
  private inspectedPower: InspectedPower = { kind: 'weapon', id: 'whip' };
  private selectedLoreIndex = 0;

  private onStartRun: (
    heroId: HeroId,
    stageId: StageId,
    difficultyId: DifficultyId,
    callbacks: ArenaCallbacks,
    metaProgression?: {
      unlockedWeapons: BaseWeaponId[];
      purchasedExclusiveWeapons?: ExclusiveWeaponId[];
      heroUpgrades?: HeroUpgradeLevels;
      weaponForge: Partial<Record<ForgeableWeaponId, number>>;
    },
    resumeCheckpoint?: SavedActiveRun
  ) => void;
  private onSetVirtualJoystick: (dx: number, dy: number) => void;
  private onTriggerDash: () => boolean;
  private onTogglePause: () => void;
  private onResumeFromPause: () => void;
  private onSaveActiveRun: () => SavedActiveRun | null;
  private onStopArena: () => void;

  // Live HUD Elements
  private hudRoot: HTMLElement | null = null;
  private menuModalHostEl: HTMLElement | null = null;
  private xpFillEl: HTMLElement | null = null;
  private xpLevelEl: HTMLElement | null = null;
  private weaponRowEl: HTMLElement | null = null;
  private relicRowEl: HTMLElement | null = null;
  private clockTimeEl: HTMLElement | null = null;
  private clockPhaseEl: HTMLElement | null = null;
  private weaponCompassEl: HTMLElement | null = null;
  private killsEl: HTMLElement | null = null;
  private soulsEl: HTMLElement | null = null;
  private goldEl: HTMLElement | null = null;
  private dashBtnEl: HTMLButtonElement | null = null;
  private dashLabelEl: HTMLElement | null = null;
  private bannerEl: HTMLElement | null = null;
  private bannerTitleEl: HTMLElement | null = null;
  private bannerSubEl: HTMLElement | null = null;
  private bossWrapEl: HTMLElement | null = null;
  private bossNameEl: HTMLElement | null = null;
  private bossFillEl: HTMLElement | null = null;
  private modalHostEl: HTMLElement | null = null;
  private bannerTimeout: number | null = null;
  private keyPickHandler: ((ev: KeyboardEvent) => void) | null = null;

  // Dirty-check HUD caches (avoid rebuilding 12 <img> DOM nodes & triggering layout 10x/sec during combat!)
  private hudLastXpPct = -1;
  private hudLastLevel = -1;
  private hudLastClock = '';
  private hudLastPhase = '';
  private hudLastCompassSig = '';
  private hudLastKills = -1;
  private hudLastSouls = -1;
  private hudLastGold = -1;
  private hudLastDashPct = -1;
  private hudLastDashLabel = '';
  private hudLastWeaponsSig = '';
  private hudLastRelicsSig = '';
  private hudLastBossSig = '';

  constructor(
    root: HTMLElement,
    viewport: ViewportManager,
    hooks: {
      onStartRun: (
        heroId: HeroId,
        stageId: StageId,
        difficultyId: DifficultyId,
        callbacks: ArenaCallbacks,
        metaProgression?: {
          unlockedWeapons: BaseWeaponId[];
          purchasedExclusiveWeapons?: ExclusiveWeaponId[];
          heroUpgrades?: HeroUpgradeLevels;
          weaponForge: Partial<Record<ForgeableWeaponId, number>>;
        },
        resumeCheckpoint?: SavedActiveRun
      ) => void;
      onSetVirtualJoystick: (dx: number, dy: number) => void;
      onTriggerDash: () => boolean;
      onTogglePause: () => void;
      onResumeFromPause: () => void;
      onSaveActiveRun: () => SavedActiveRun | null;
      onStopArena: () => void;
    }
  ) {
    this.root = root;
    this.viewport = viewport;
    this.onStartRun = hooks.onStartRun;
    this.onSetVirtualJoystick = hooks.onSetVirtualJoystick;
    this.onTriggerDash = hooks.onTriggerDash;
    this.onTogglePause = hooks.onTogglePause;
    this.onResumeFromPause = hooks.onResumeFromPause;
    this.onSaveActiveRun = hooks.onSaveActiveRun;
    this.onStopArena = hooks.onStopArena;

    this.curtain = document.createElement('div');
    this.curtain.className = 'eclipse-curtain';
    document.getElementById('game-root')?.appendChild(this.curtain);

    this.renderMenu();
  }

  private getActiveSaveSlot(): SaveSlotIndex {
    try {
      const n = Number(localStorage.getItem(ACTIVE_SLOT_KEY));
      if (n === 1 || n === 2) return n;
    } catch {
      // ignore
    }
    return 0;
  }

  private setActiveSaveSlot(slot: SaveSlotIndex): void {
    try {
      localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
    } catch {
      // ignore
    }
  }

  private getSlotStorageKey(slot: SaveSlotIndex): string {
    return slot === 0 ? RECORDS_STORAGE_KEY : `${RECORDS_STORAGE_KEY}.slot${slot}`;
  }

  private loadRecords(slot: SaveSlotIndex = this.getActiveSaveSlot()): SavedRecords {
    try {
      const raw = localStorage.getItem(this.getSlotStorageKey(slot));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedRecords>;
        const rawUnlocked = Array.isArray(parsed.unlockedWeapons)
          ? parsed.unlockedWeapons.filter((w): w is BaseWeaponId =>
              ALL_BASE_WEAPONS.includes(w as BaseWeaponId)
            )
          : [];
        const rawPurchased = Array.isArray(parsed.purchasedExclusiveWeapons)
          ? parsed.purchasedExclusiveWeapons.filter((w): w is ExclusiveWeaponId =>
              ALL_EXCLUSIVE_WEAPONS.includes(w as ExclusiveWeaponId)
            )
          : [];
        return {
          bestSeconds: Number(parsed.bestSeconds) || 0,
          bestKills: Number(parsed.bestKills) || 0,
          totalSouls: typeof parsed.totalSouls === 'number' ? parsed.totalSouls : 200,
          totalGold: typeof parsed.totalGold === 'number' ? Math.max(0, parsed.totalGold) : 0,
          victories: Number(parsed.victories) || 0,
          clearedStages: Array.isArray(parsed.clearedStages) ? parsed.clearedStages : [],
          unlockedWeapons:
            rawUnlocked.length > 0
              ? Array.from(new Set([...DEFAULT_UNLOCKED_WEAPONS, ...rawUnlocked]))
              : [...DEFAULT_UNLOCKED_WEAPONS],
          purchasedExclusiveWeapons: Array.from(new Set(rawPurchased)),
          heroUpgrades:
            parsed.heroUpgrades && typeof parsed.heroUpgrades === 'object'
              ? parsed.heroUpgrades
              : {},
          weaponForge:
            parsed.weaponForge && typeof parsed.weaponForge === 'object' ? parsed.weaponForge : {},
          lastSavedAt: typeof parsed.lastSavedAt === 'string' ? parsed.lastSavedAt : undefined,
          activeRun:
            parsed.activeRun &&
            typeof parsed.activeRun === 'object' &&
            parsed.activeRun.heroId &&
            parsed.activeRun.stageId
              ? parsed.activeRun
              : null,
        };
      }
    } catch {
      // ignore
    }
    return {
      bestSeconds: 0,
      bestKills: 0,
      totalSouls: 200,
      totalGold: 0,
      victories: 0,
      clearedStages: [],
      unlockedWeapons: [...DEFAULT_UNLOCKED_WEAPONS],
      purchasedExclusiveWeapons: [],
      heroUpgrades: {},
      weaponForge: {},
      activeRun: null,
    };
  }

  private saveRecords(rec: SavedRecords, slot: SaveSlotIndex = this.getActiveSaveSlot()): void {
    const stamped: SavedRecords = {
      ...rec,
      lastSavedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(this.getSlotStorageKey(slot), JSON.stringify(stamped));
    } catch {
      // ignore
    }
  }

  private saveRunCheckpoint(checkpoint: SavedActiveRun | null): void {
    const rec = this.loadRecords();
    rec.activeRun = checkpoint;
    this.saveRecords(rec);
  }

  private exportActiveSlotJson(): string {
    return JSON.stringify(this.loadRecords(), null, 2);
  }

  private importActiveSlotJson(rawJson: string): { ok: boolean; error?: string } {
    try {
      const parsed = JSON.parse(rawJson) as Partial<SavedRecords>;
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: 'JSON inválido.' };
      }
      const unlocked = Array.isArray(parsed.unlockedWeapons)
        ? parsed.unlockedWeapons.filter((w): w is BaseWeaponId =>
            ALL_BASE_WEAPONS.includes(w as BaseWeaponId)
          )
        : [];
      const purchased = Array.isArray(parsed.purchasedExclusiveWeapons)
        ? parsed.purchasedExclusiveWeapons.filter((w): w is ExclusiveWeaponId =>
            ALL_EXCLUSIVE_WEAPONS.includes(w as ExclusiveWeaponId)
          )
        : [];
      const cleared = Array.isArray(parsed.clearedStages)
        ? parsed.clearedStages.filter((s): s is StageId => STAGES.some((st) => st.id === s))
        : [];
      const rec: SavedRecords = {
        bestSeconds: Math.max(0, Number(parsed.bestSeconds) || 0),
        bestKills: Math.max(0, Number(parsed.bestKills) || 0),
        totalSouls: Math.max(0, Number(parsed.totalSouls) || 0),
        totalGold: Math.max(0, Number(parsed.totalGold) || 0),
        victories: Math.max(0, Number(parsed.victories) || 0),
        clearedStages: cleared,
        unlockedWeapons: Array.from(new Set([...DEFAULT_UNLOCKED_WEAPONS, ...unlocked])),
        purchasedExclusiveWeapons: Array.from(new Set(purchased)),
        heroUpgrades:
          parsed.heroUpgrades && typeof parsed.heroUpgrades === 'object' ? parsed.heroUpgrades : {},
        weaponForge:
          parsed.weaponForge && typeof parsed.weaponForge === 'object' ? parsed.weaponForge : {},
        activeRun:
          parsed.activeRun &&
          typeof parsed.activeRun === 'object' &&
          parsed.activeRun.heroId &&
          parsed.activeRun.stageId
            ? parsed.activeRun
            : null,
      };
      this.saveRecords(rec);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Erro ao ler o JSON do Save.' };
    }
  }

  private saveRunRecord(summary: RunSummary): void {
    const rec = this.loadRecords();
    rec.bestSeconds = Math.max(rec.bestSeconds, Math.floor(summary.elapsedSeconds));
    rec.bestKills = Math.max(rec.bestKills, summary.kills);
    rec.totalSouls += summary.souls;
    rec.totalGold += Math.max(0, Math.round(summary.gold ?? 0));
    if (summary.victory) {
      rec.victories += 1;
      if (!rec.clearedStages.includes(summary.stageId)) {
        rec.clearedStages.push(summary.stageId);
      }
    }
    this.saveRecords(rec);
  }

  private unlockWeaponPermanently(weaponId: BaseWeaponId): void {
    const rec = this.loadRecords();
    if (!rec.unlockedWeapons.includes(weaponId)) {
      rec.unlockedWeapons.push(weaponId);
      this.saveRecords(rec);
    }
  }

  private buyExclusiveWeapon(weaponId: ExclusiveWeaponId): boolean {
    const rec = this.loadRecords();
    if (rec.purchasedExclusiveWeapons.includes(weaponId)) return false;
    const price = WEAPONS[weaponId].goldPrice ?? 99999;
    if (rec.totalGold < price) return false;

    rec.totalGold -= price;
    rec.purchasedExclusiveWeapons.push(weaponId);
    this.saveRecords(rec);
    gothicAudio.playLevelUp();
    return true;
  }

  private upgradeWeaponInForge(
    weaponId: ForgeableWeaponId,
    currency: 'souls' | 'gold' = 'souls'
  ): boolean {
    const rec = this.loadRecords();
    const isExclusive = ALL_EXCLUSIVE_WEAPONS.includes(weaponId as ExclusiveWeaponId);
    const unlocked = isExclusive
      ? rec.purchasedExclusiveWeapons.includes(weaponId as ExclusiveWeaponId)
      : rec.unlockedWeapons.includes(weaponId as BaseWeaponId);
    if (!unlocked) return false;

    const currentLv = rec.weaponForge[weaponId] ?? 0;
    if (currentLv >= MAX_WEAPON_FORGE_LEVEL) return false;

    if (currency === 'gold') {
      const goldCost = WEAPON_FORGE_GOLD_COSTS[currentLv];
      if (rec.totalGold < goldCost) return false;
      rec.totalGold -= goldCost;
    } else {
      if (isExclusive) return false;
      const soulCost = WEAPON_FORGE_COSTS[currentLv];
      if (rec.totalSouls < soulCost) return false;
      rec.totalSouls -= soulCost;
    }

    rec.weaponForge[weaponId] = currentLv + 1;
    this.saveRecords(rec);
    gothicAudio.playLevelUp();
    return true;
  }

  private upgradeHeroStat(heroId: HeroId, statKey: HeroStatUpgradeKey): boolean {
    const rec = this.loadRecords();
    const current = rec.heroUpgrades[heroId]?.[statKey] ?? 0;
    if (current >= MAX_HERO_UPGRADE_LEVEL) return false;
    const cost = HERO_UPGRADE_GOLD_COSTS[current];
    if (rec.totalGold < cost) return false;

    rec.totalGold -= cost;
    rec.heroUpgrades[heroId] = {
      ...(rec.heroUpgrades[heroId] ?? {}),
      [statKey]: current + 1,
    };
    this.saveRecords(rec);
    gothicAudio.playLevelUp();
    return true;
  }

  private transitionWithCurtain(swapDom: () => void): void {
    this.curtain.classList.add('active');
    window.setTimeout(() => {
      swapDom();
      window.setTimeout(() => {
        this.curtain.classList.remove('active');
      }, 90);
    }, 300);
  }

  renderTitleScreen(): void {
    this.currentScreen = 'splash';
    this.renderMenu();
  }

  private renderMenu(): void {
    this.clearKeyPickHandler();
    this.hudRoot = null;
    gothicSoundtrack.playMenuMusic();
    const activeSlot = this.getActiveSaveSlot();

    const menu = document.createElement('div');
    menu.className = 'menu-root';
    menu.dataset.testid = 'title-screen';

    const bgArt = document.createElement('div');
    bgArt.className = 'menu-bg-art';
    const stageArt =
      this.currentScreen === 'stage_select'
        ? (STAGES.find((s) => s.id === this.selectedStage)?.bannerUrl ?? './art/intro-cover.jpg')
        : './art/intro-cover.jpg';
    bgArt.style.backgroundImage = `url('${stageArt}')`;

    const bgVignette = document.createElement('div');
    bgVignette.className = 'menu-bg-vignette';

    const embers = document.createElement('div');
    embers.className = 'menu-embers';
    for (let i = 0; i < 16; i++) {
      const dot = document.createElement('span');
      dot.className = 'ember-dot';
      dot.style.left = `${(i * 6.3 + 3) % 98}%`;
      dot.style.animationDuration = `${5 + (i % 5) * 1.4}s`;
      dot.style.animationDelay = `-${(i * 0.8) % 6}s`;
      embers.appendChild(dot);
    }

    menu.append(bgArt, bgVignette, embers);

    // Top Game Chrome Bar (Save Game + Fullscreen Landscape + Music + SFX)
    const topBar = document.createElement('div');
    topBar.className = 'menu-top-bar';

    const leftTag = document.createElement('div');
    leftTag.className = 'game-crest-tag';
    leftTag.textContent = `❖ Vespera · Slot ${activeSlot + 1}`;

    const rightUtils = document.createElement('div');
    rightUtils.className = 'top-utility-btns';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn-utility';
    saveBtn.dataset.testid = 'open-save-modal-btn';
    saveBtn.textContent = '💾 Save Game';
    saveBtn.addEventListener('click', () => {
      gothicAudio.playHit();
      this.openSaveGameModal();
    });

    const fsBtn = document.createElement('button');
    fsBtn.type = 'button';
    fsBtn.dataset.testid = 'fullscreen-btn';
    const isMob = this.viewport.isMobileViewport();
    const isFs = this.viewport.isLandscapeActive();
    fsBtn.className = `btn-utility ${isMob && !isFs ? 'highlight-fs' : ''}`;
    fsBtn.textContent = isFs ? '⛶ Sair Tela Cheia' : '⛶ Tela Cheia (Deitada)';
    fsBtn.addEventListener('click', async () => {
      await this.viewport.toggleFullscreenLandscape();
      this.renderMenu();
    });

    const bgmBtn = document.createElement('button');
    bgmBtn.type = 'button';
    bgmBtn.className = 'btn-utility';
    bgmBtn.textContent = gothicSoundtrack.isMuted() ? '🎵 Música: Off' : '🎵 Música: On';
    bgmBtn.addEventListener('click', () => {
      const m = gothicSoundtrack.toggleMute();
      bgmBtn.textContent = m ? '🎵 Música: Off' : '🎵 Música: On';
    });

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'btn-utility';
    muteBtn.textContent = gothicAudio.isMuted() ? '🔇 Efeitos' : '🔊 Efeitos';
    muteBtn.addEventListener('click', () => {
      const m = gothicAudio.toggleMute();
      muteBtn.textContent = m ? '🔇 Efeitos' : '🔊 Efeitos';
    });

    rightUtils.append(saveBtn, fsBtn, bgmBtn, muteBtn);
    topBar.append(leftTag, rightUtils);
    menu.appendChild(topBar);

    const screenChanged = this.currentScreen !== this.lastRenderedScreen;
    this.lastRenderedScreen = this.currentScreen;

    if (this.currentScreen === 'splash') {
      this.buildSplashScreen(menu);
    } else if (this.currentScreen === 'hero_select') {
      this.buildHeroSelectScreen(menu);
    } else if (this.currentScreen === 'stage_select') {
      this.buildStageSelectScreen(menu);
    } else if (this.currentScreen === 'arsenal') {
      this.buildArsenalScreen(menu);
    } else {
      this.buildLoreScreen(menu);
    }

    if (screenChanged) {
      menu.querySelector('.splash-center, .subscreen-shell')?.classList.add('screen-enter');
    }

    const menuModalHost = document.createElement('div');
    menuModalHost.dataset.menuModalHost = 'true';
    this.menuModalHostEl = menuModalHost;
    menu.appendChild(menuModalHost);

    this.root.replaceChildren(menu);
  }

  private buildSplashScreen(menu: HTMLElement): void {
    const rec = this.loadRecords();

    const center = document.createElement('div');
    center.className = 'splash-center';
    center.innerHTML = `
      <div class="logo-emblem">
        <div class="logo-kicker">Crônicas dos Juramentados da Cinza</div>
        <h1 class="logo-title title-main">VESPERA</h1>
        <div class="logo-ribbon">Eclipse Carmesim</div>
      </div>
    `;

    const stack = document.createElement('div');
    stack.className = 'splash-menu-stack';

    if (rec.activeRun) {
      const savedRun = rec.activeRun;
      const rStage = STAGES.find((s) => s.id === savedRun.stageId) ?? STAGES[0];
      const rHero = HEROES[savedRun.heroId] ?? HEROES.alaric;
      const contBtn = document.createElement('button');
      contBtn.type = 'button';
      contBtn.className = 'game-plaque-btn continue-save';
      contBtn.dataset.testid = 'continue-saved-run-btn';
      contBtn.innerHTML = `▶ Continuar Vigília Salva <span class="continue-save-sub">${rHero.name} · Fase ${rStage.roman} · ${formatClock(savedRun.elapsedSeconds)}</span>`;
      contBtn.addEventListener('click', async () => {
        gothicAudio.playWand(false);
        if (this.viewport.isMobileViewport() && !this.viewport.isLandscapeActive()) {
          await this.viewport.enterFullscreenLandscape();
        }
        this.resumeSavedRun(savedRun);
      });
      stack.appendChild(contBtn);
    }

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'game-plaque-btn primary';
    playBtn.dataset.testid = 'menu-play-btn';
    playBtn.textContent = '⚔ Jogar';
    playBtn.addEventListener('click', async () => {
      gothicAudio.playWand(false);
      if (this.viewport.isMobileViewport() && !this.viewport.isLandscapeActive()) {
        await this.viewport.enterFullscreenLandscape();
      }
      this.currentScreen = 'hero_select';
      this.renderMenu();
    });

    const arsenalBtn = document.createElement('button');
    arsenalBtn.type = 'button';
    arsenalBtn.className = 'game-plaque-btn';
    arsenalBtn.dataset.testid = 'tab-powers';
    arsenalBtn.textContent = '✦ Grade de Poderes & Forja';
    arsenalBtn.addEventListener('click', () => {
      gothicAudio.playWand(false);
      this.currentScreen = 'arsenal';
      this.renderMenu();
    });

    const loreBtn = document.createElement('button');
    loreBtn.type = 'button';
    loreBtn.className = 'game-plaque-btn';
    loreBtn.dataset.testid = 'tab-lore';
    loreBtn.textContent = '📜 Grimório & Lore';
    loreBtn.addEventListener('click', () => {
      gothicAudio.playWand(false);
      this.currentScreen = 'lore';
      this.renderMenu();
    });

    stack.append(playBtn, arsenalBtn, loreBtn);
    center.appendChild(stack);
    menu.appendChild(center);

    const status = document.createElement('div');
    status.className = 'splash-status-strip';
    status.innerHTML = `
      <span>👑 Regiões Purificadas: <strong>${rec.clearedStages.length}/7</strong></span>
      <span>⚔ Armas: <strong>${rec.unlockedWeapons.length}/9</strong> · Exclusivas: <strong>${rec.purchasedExclusiveWeapons.length}/10</strong></span>
      <span>🪙 Ouro: <strong data-testid="splash-gold-balance">${rec.totalGold.toLocaleString('pt-BR')}</strong></span>
      <span>✦ Almas: <strong>${rec.totalSouls}</strong></span>
      <span>☠ Abates: <strong>${rec.bestKills}</strong></span>
      <span>⏱ Melhor: <strong>${formatClock(rec.bestSeconds)}</strong></span>
    `;
    menu.appendChild(status);
  }

  private buildDifficultyStrip(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'difficulty-bar-wrap';

    const tabs = document.createElement('div');
    tabs.className = 'difficulty-tabs';

    for (const dId of DIFFICULTY_ORDER) {
      const d = DIFFICULTIES[dId];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.testid = `difficulty-${dId}`;
      btn.className = `diff-pill ${dId === 'holi_shit' ? 'holy-tier' : ''} ${this.selectedDifficulty === dId ? 'selected' : ''}`;
      btn.style.setProperty('--diff-col', d.color);
      btn.innerHTML = `<span class="diff-name">${d.label}</span>`;
      btn.addEventListener('click', () => {
        gothicAudio.playHit();
        this.selectedDifficulty = dId;
        this.renderMenu();
      });
      tabs.appendChild(btn);
    }

    const active = DIFFICULTIES[this.selectedDifficulty];
    const meta = document.createElement('div');
    meta.className = 'difficulty-meta';
    meta.innerHTML = `
      <span style="color:${active.color}; font-weight:700">${active.subtitle}</span>
      <span>Vida ×${active.hpMult.toFixed(1)}</span>
      <span>Hordas ×${active.hordeMult.toFixed(1)}</span>
      <span>Almas ×${active.soulMult.toFixed(1)}</span>
      <span>Elites ${Math.round(active.eliteChance * 100)}%</span>
      <span>Sub-Chefes a cada ${active.subBossIntervalSec}s · Hordas a cada ${active.surgeIntervalSec}s</span>
    `;

    wrap.append(tabs, meta);
    return wrap;
  }

  private buildHeroSelectScreen(menu: HTMLElement): void {
    const rec = this.loadRecords();
    const shell = document.createElement('div');
    shell.className = 'subscreen-shell';

    const header = document.createElement('div');
    header.className = 'subscreen-header';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn-gothic secondary';
    backBtn.textContent = '← Menu';
    backBtn.addEventListener('click', () => {
      this.currentScreen = 'splash';
      this.renderMenu();
    });

    const title = document.createElement('h2');
    title.className = 'subscreen-title';
    title.textContent = 'Escolha seu Juramentado';

    const goldBadge = document.createElement('div');
    goldBadge.className = 'weapon-crest-badge gold-crest-badge';
    goldBadge.innerHTML = `🪙 Ouro: <strong data-testid="hero-gold-balance">${rec.totalGold.toLocaleString('pt-BR')}</strong>`;

    header.append(backBtn, title, goldBadge);
    shell.appendChild(header);

    const body = document.createElement('div');
    body.className = 'subscreen-body';

    const roster = document.createElement('div');
    roster.className = 'roster-list';

    for (const hId of HERO_ORDER) {
      const h = HEROES[hId];
      const w = WEAPONS[h.startingWeapon];
      const hUpgs = rec.heroUpgrades[hId];
      const totalUpgLv = HERO_STAT_UPGRADE_ORDER.reduce((acc, k) => acc + (hUpgs?.[k] ?? 0), 0);
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.dataset.testid = `hero-card-${hId}`;
      slot.className = `roster-slot ${this.selectedHero === hId ? 'selected' : ''}`;
      slot.innerHTML = `
        <img class="roster-thumb" src="${h.portraitUrl}" alt="${h.name}" />
        <div>
          <div class="roster-slot-name">${h.name}${totalUpgLv > 0 ? ` <span style="color:#ffd166;font-size:0.68rem">★+${totalUpgLv}</span>` : ''}</div>
          <div class="roster-slot-sub">
            <img class="mini-icon-inline" src="${getWeaponIconUrl(h.startingWeapon)}" alt="${w.name}" />
            ${w.name}
          </div>
        </div>
      `;
      slot.addEventListener('click', () => {
        gothicAudio.playHit();
        this.selectedHero = hId;
        this.renderMenu();
      });
      roster.appendChild(slot);
    }

    const hero = HEROES[this.selectedHero];
    const startWeapon = WEAPONS[hero.startingWeapon];
    const heroUpg = rec.heroUpgrades[hero.id] ?? {};
    const s = computeHeroWithUpgrades(hero.id, heroUpg);

    const hpPct = Math.min(100, Math.round((s.maxHp / 230) * 100));
    const dmgPct = Math.min(100, Math.round((s.might / 1.65) * 100));
    const spdPct = Math.min(100, Math.round((s.moveSpeed / 245) * 100));
    const critPct = Math.min(100, Math.round((s.critChance / 0.4) * 100));

    const showcase = document.createElement('div');
    showcase.className = 'showcase-panel';
    showcase.innerHTML = `
      <div>
        <div class="hero-showcase-top">
          <div class="hero-pedestal-box">
            <div class="hero-live-sprite" style="background-image:url('./art/sprites/hero_${hero.id}.webp')"></div>
          </div>
          <div class="hero-showcase-info">
            <h2>${hero.name}</h2>
            <div class="hero-showcase-epithet">${hero.epithet}</div>
            <div class="weapon-crest-badge">
              <img class="mini-icon-inline" src="${getWeaponIconUrl(hero.startingWeapon)}" alt="${startWeapon.name}" />
              Arma Inicial: ${startWeapon.name}
            </div>
            <div style="font-size:0.76rem; color:#98f5cb; margin-top:6px">${hero.perkSummary}</div>
          </div>
        </div>

        <div class="stat-bars-grid">
          <div class="stat-bar-item">
            <div class="stat-bar-label"><span>VITALIDADE</span><span data-testid="hero-stat-hp">${s.maxHp} PV</span></div>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${hpPct}%"></div></div>
          </div>
          <div class="stat-bar-item">
            <div class="stat-bar-label"><span>PODER DE DANO</span><span data-testid="hero-stat-might">${Math.round(s.might * 100)}%</span></div>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${dmgPct}%"></div></div>
          </div>
          <div class="stat-bar-item">
            <div class="stat-bar-label"><span>VELOCIDADE</span><span data-testid="hero-stat-speed">${s.moveSpeed}</span></div>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${spdPct}%"></div></div>
          </div>
          <div class="stat-bar-item">
            <div class="stat-bar-label"><span>CHANCE CRÍTICA</span><span data-testid="hero-stat-crit">${Math.round(s.critChance * 100)}%</span></div>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${critPct}%"></div></div>
          </div>
        </div>

        <p style="font-family:var(--font-lore); font-size:0.95rem; color:#dfd3dd; margin:4px 0 0">
          ${hero.lore} <em style="color:#f5c2cf">${hero.quote}</em>
        </p>
      </div>

      <div class="showcase-footer">
        <span style="font-size:0.75rem; color:var(--text-muted)">Dificuldade: <strong style="color:${DIFFICULTIES[this.selectedDifficulty].color}">${DIFFICULTIES[this.selectedDifficulty].label}</strong> · Passo Espectral [Espaço]</span>
        <button type="button" class="btn-gothic" data-testid="go-stage-select-btn">Escolher Região ➔</button>
      </div>
    `;

    // Permanent Per-Hero Gold Stat Upgrade Sanctuary
    const upgPanel = document.createElement('div');
    upgPanel.className = 'hero-upgrades-panel';
    upgPanel.dataset.testid = 'hero-upgrades-panel';
    upgPanel.innerHTML = `
      <div class="hero-upgrades-header">
        <span class="forge-title">⚜ Altar de Evolução · ${hero.name}</span>
        <span class="gold-inline-tag">🪙 <strong>${rec.totalGold.toLocaleString('pt-BR')}</strong> Ouro</span>
      </div>
      <div class="hero-upgrades-grid">
        ${HERO_STAT_UPGRADE_ORDER.map((statKey) => {
          const meta = HERO_STAT_UPGRADE_META[statKey];
          const lv = heroUpg[statKey] ?? 0;
          const isMax = lv >= MAX_HERO_UPGRADE_LEVEL;
          const cost = isMax ? 0 : HERO_UPGRADE_GOLD_COSTS[lv];
          const canBuy = !isMax && rec.totalGold >= cost;
          return `
            <div class="hero-upg-card" data-testid="hero-upg-${statKey}">
              <div class="hero-upg-top">
                <span>${meta.icon} <strong>${meta.label}</strong></span>
                <span class="hero-upg-lv" data-testid="hero-upg-lv-${statKey}">Nv.${lv}/${MAX_HERO_UPGRADE_LEVEL}</span>
              </div>
              <div class="hero-upg-bonus">${meta.bonusLabel}</div>
              <button type="button" class="btn-gothic secondary hero-upg-btn" data-hero-upg-btn="${statKey}" data-testid="hero-upg-btn-${statKey}" ${canBuy ? '' : 'disabled'}>
                ${isMax ? '👑 Máximo' : `🪙 ${cost.toLocaleString('pt-BR')} Ouro`}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
    HERO_STAT_UPGRADE_ORDER.forEach((statKey) => {
      upgPanel.querySelector(`[data-hero-upg-btn="${statKey}"]`)?.addEventListener('click', () => {
        if (this.upgradeHeroStat(hero.id, statKey)) {
          this.renderMenu();
        }
      });
    });

    const infoTop = showcase.firstElementChild;
    infoTop?.appendChild(upgPanel);
    infoTop?.appendChild(this.buildDifficultyStrip());

    showcase.querySelector('[data-testid="go-stage-select-btn"]')?.addEventListener('click', () => {
      gothicAudio.playWand(false);
      this.currentScreen = 'stage_select';
      this.renderMenu();
    });

    body.append(roster, showcase);
    shell.appendChild(body);
    menu.appendChild(shell);
  }

  private buildStageSelectScreen(menu: HTMLElement): void {
    const rec = this.loadRecords();
    const shell = document.createElement('div');
    shell.className = 'subscreen-shell';

    const header = document.createElement('div');
    header.className = 'subscreen-header';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn-gothic secondary';
    backBtn.textContent = '← Heróis';
    backBtn.addEventListener('click', () => {
      this.currentScreen = 'hero_select';
      this.renderMenu();
    });

    const title = document.createElement('h2');
    title.className = 'subscreen-title';
    title.textContent = 'Mapa das Sete Regiões (40 Minutos · 4 Atos)';

    const heroBadge = document.createElement('div');
    heroBadge.className = 'weapon-crest-badge';
    heroBadge.textContent = `⚔ ${HEROES[this.selectedHero].name}`;

    header.append(backBtn, title, heroBadge);
    shell.appendChild(header);

    const body = document.createElement('div');
    body.className = 'subscreen-body';

    const roster = document.createElement('div');
    roster.className = 'roster-list';

    for (const st of STAGES) {
      const cleared = rec.clearedStages.includes(st.id);
      const stHiddenW = WEAPONS[st.hiddenWeapon];
      const stHiddenCat = stHiddenW.catalystRelic ? RELICS[stHiddenW.catalystRelic] : undefined;
      const stUnlocked = rec.unlockedWeapons.includes(st.hiddenWeapon);
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.dataset.testid = `stage-card-${st.id}`;
      slot.className = `roster-slot ${this.selectedStage === st.id ? 'selected' : ''}`;
      slot.innerHTML = `
        <img class="roster-thumb" src="${st.bannerUrl}" alt="${st.name}" />
        <div style="flex:1">
          <div class="roster-slot-name">Fase ${st.roman} · ${st.name}</div>
          <div class="roster-slot-sub">${st.threatLabel} ${cleared ? '· 👑 Purificada' : ''}</div>
          <div class="roster-stage-weapon" style="color:${stUnlocked ? '#7be0ad' : '#ffd166'}">
            <img class="mini-icon-inline" src="${getWeaponIconUrl(st.hiddenWeapon)}" alt="${stHiddenW.name}" />
            ${stHiddenCat ? `<img class="mini-icon-inline" src="${getRelicIconUrl(stHiddenCat.id)}" alt="${stHiddenCat.name}" />` : ''}
            ${stUnlocked ? '✦ Liberados:' : '🔒 Libera:'} <strong>${stHiddenW.name}${stHiddenCat ? ` + ${stHiddenCat.name}` : ''}</strong>
          </div>
        </div>
      `;
      slot.addEventListener('click', () => {
        gothicAudio.playHit();
        this.selectedStage = st.id;
        this.renderMenu();
      });
      roster.appendChild(slot);
    }

    const st = STAGES.find((x) => x.id === this.selectedStage) ?? STAGES[0];
    const boss = ENEMIES[st.finalBoss];
    const cleared = rec.clearedStages.includes(st.id);
    const hiddenWeaponDef = WEAPONS[st.hiddenWeapon];
    const hiddenCatDef = hiddenWeaponDef.catalystRelic ? RELICS[hiddenWeaponDef.catalystRelic] : undefined;
    const hiddenUnlocked = rec.unlockedWeapons.includes(st.hiddenWeapon);
    const stageGuideItems = STAGES.map((s) => {
      const hw = WEAPONS[s.hiddenWeapon];
      const hCat = hw.catalystRelic ? RELICS[hw.catalystRelic] : undefined;
      const unlocked = rec.unlockedWeapons.includes(s.hiddenWeapon);
      return `
        <span class="stage-guide-chip ${unlocked ? 'unlocked' : 'locked'}">
          <img class="mini-icon-inline" src="${getWeaponIconUrl(s.hiddenWeapon)}" alt="${hw.name}" />
          ${hCat ? `<img class="mini-icon-inline" src="${getRelicIconUrl(hCat.id)}" alt="${hCat.name}" />` : ''}
          <strong>F.${s.roman}:</strong> ${hw.name}${hCat ? ` + ${hCat.name}` : ''} ${unlocked ? '✦' : '🔒'}
        </span>
      `;
    }).join('');

    const showcase = document.createElement('div');
    showcase.className = 'showcase-panel';
    showcase.innerHTML = `
      <div>
        <div class="stage-cinema-banner">
          <img src="${st.bannerUrl}" alt="${st.name}" />
          <div class="stage-cinema-overlay">
            <div>
              <div style="font-size:0.72rem; color:#ff9ebb; font-weight:700; text-transform:uppercase">
                FASE ${st.roman} · ${st.threatLabel} ${cleared ? '· 👑 PURIFICADA' : ''}
              </div>
              <h2 style="font-family:var(--font-display); font-size:1.35rem; color:var(--gold-bright); margin:2px 0 0">
                ${st.name}
              </h2>
            </div>
            <div class="boss-preview-chip">
              <div class="boss-mini-sprite" style="background-image:url('./art/sprites/enemy_${st.finalBoss}.webp')"></div>
              <div style="text-align:left">
                <div style="font-size:0.62rem; color:#ff8fa3; text-transform:uppercase">Guardião (40:00)</div>
                <div style="font-family:var(--font-display); font-size:0.76rem; color:#ffe79e">${boss.name}</div>
              </div>
            </div>
          </div>
        </div>

        <p style="font-family:var(--font-lore); font-size:1.02rem; line-height:1.36; color:#e2d7e0; margin:10px 0 6px">
          ${st.lore}
        </p>
        <div style="font-size:0.75rem; color:#ffe79e; margin-bottom:4px">
          ✦ 1º Chefão (20:00) · 2º Chefão (30:00 · Vencer ou Continuar) · Supremo (40:00) · ${st.enemyPool.length} Espécies
        </div>
        <div style="font-size:0.74rem; color:${hiddenUnlocked ? '#7be0ad' : '#ffd166'}; margin-bottom:6px" data-testid="stage-hidden-weapon-info">
          <img class="mini-icon-inline" src="${getWeaponIconUrl(st.hiddenWeapon)}" alt="${hiddenWeaponDef.name}" />
          ${hiddenCatDef ? `<img class="mini-icon-inline" src="${getRelicIconUrl(hiddenCatDef.id)}" alt="${hiddenCatDef.name}" />` : ''}
          ${
            hiddenUnlocked
              ? `✦ Arma & Catalisador Liberados: <strong>${hiddenWeaponDef.name}${hiddenCatDef ? ` + ${hiddenCatDef.name}` : ''}</strong>`
              : `🧭 Escondidos no Cenário: <strong>${hiddenWeaponDef.name}${hiddenCatDef ? ` + ${hiddenCatDef.name}` : ''}</strong> (${st.hiddenAltarName})`
          }
        </div>
        <div class="stage-weapons-guide" data-testid="stage-weapons-guide">
          <div class="stage-guide-title">🗺 Armas & Catalisadores por Fase (Iniciais: Açoite Consagrado + Coração Negro · Cetro de Estilhaços + Tomo Vazio)</div>
          <div class="stage-guide-grid">${stageGuideItems}</div>
        </div>
      </div>

      <div class="showcase-footer">
        <span style="font-size:0.75rem; color:var(--text-muted)">
          Vigília: <strong>${formatClock(st.durationSeconds)}</strong> · <strong style="color:${DIFFICULTIES[this.selectedDifficulty].color}">${DIFFICULTIES[this.selectedDifficulty].label}</strong>
        </span>
        <button type="button" class="btn-gothic" data-testid="start-run-btn">⚔ Iniciar Vigília</button>
      </div>
    `;

    showcase.firstElementChild?.appendChild(this.buildDifficultyStrip());

    showcase.querySelector('[data-testid="start-run-btn"]')?.addEventListener('click', async () => {
      if (this.viewport.isMobileViewport() && !this.viewport.isLandscapeActive()) {
        await this.viewport.enterFullscreenLandscape();
      }
      this.beginArenaRun();
    });

    body.append(roster, showcase);
    shell.appendChild(body);
    menu.appendChild(shell);
  }

  private buildArsenalScreen(menu: HTMLElement): void {
    const rec = this.loadRecords();
    const shell = document.createElement('div');
    shell.className = 'subscreen-shell';

    const header = document.createElement('div');
    header.className = 'subscreen-header';
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn-gothic secondary';
    backBtn.textContent = '← Menu';
    backBtn.addEventListener('click', () => {
      this.currentScreen = 'splash';
      this.renderMenu();
    });
    const title = document.createElement('h2');
    title.className = 'subscreen-title';
    title.textContent = 'Arsenal, Loja de Ouro & Forja (46)';
    const soulsTag = document.createElement('div');
    soulsTag.className = 'weapon-crest-badge';
    soulsTag.innerHTML = `🪙 Ouro: <strong data-testid="arsenal-gold-balance">${rec.totalGold.toLocaleString('pt-BR')}</strong> · ✦ Almas: <strong>${rec.totalSouls}</strong> · Exclusivas: <strong>${rec.purchasedExclusiveWeapons.length}/10</strong>`;
    header.append(backBtn, title, soulsTag);
    shell.appendChild(header);

    const body = document.createElement('div');
    body.className = 'subscreen-body';

    const leftCol = document.createElement('div');
    leftCol.className = 'arsenal-left-col';

    // Left Top: 9-Row Visual Synergy Matrix (Arma Base + Relíquia -> ★ Evolução -> 👑 Ultimate) — 36 icons!
    const matrix = document.createElement('div');
    matrix.className = 'synergy-matrix';

    for (const baseId of ALL_BASE_WEAPONS) {
      const baseW = WEAPONS[baseId];
      const catId = baseW.catalystRelic!;
      const catR = RELICS[catId];
      const evoId = baseW.evolvesInto!;
      const evoW = WEAPONS[evoId];
      const ultId = evoW.ultimateInto!;
      const ultW = WEAPONS[ultId];
      const isBaseUnlocked = rec.unlockedWeapons.includes(baseId);
      const forgeLv = rec.weaponForge[baseId] ?? 0;

      const row = document.createElement('div');
      row.className = 'synergy-row ultimate-matrix-row';

      const makeTile = (
        target: InspectedPower,
        iconUrl: string,
        label: string,
        tier: 'base' | 'evolved' | 'ultimate' = 'base'
      ) => {
        const isSel =
          this.inspectedPower.kind === target.kind && this.inspectedPower.id === target.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        const isLockedBase = tier === 'base' && !isBaseUnlocked;
        const tierCls =
          tier === 'ultimate' ? 'ultimate-tile' : tier === 'evolved' ? 'evolved-tile' : '';
        btn.className = `power-icon-tile ${tierCls} ${isLockedBase ? 'locked-tile' : ''} ${isSel ? 'selected' : ''}`;
        if (target.kind === 'weapon') {
          btn.dataset.testid = `power-tile-${target.id}`;
        } else {
          btn.dataset.testid = `relic-tile-${target.id}`;
        }
        btn.title = isLockedBase
          ? target.kind === 'relic'
            ? `${label} (🔒 Catalisador bloqueado — libere a arma da fase)`
            : `${label} (🔒 Escondida no cenário)`
          : label;
        btn.innerHTML = `
          <img class="power-icon-img" src="${iconUrl}" alt="${label}" />
          ${
            isLockedBase
              ? '<span class="lock-corner">🔒</span>'
              : tier === 'base' && target.kind === 'weapon' && forgeLv > 0
                ? `<span class="forge-lv-corner">⚒${forgeLv}</span>`
                : tier === 'ultimate'
                  ? '<span class="evo-star-corner ultimate">👑</span>'
                  : tier === 'evolved'
                    ? '<span class="evo-star-corner">★</span>'
                    : ''
          }
        `;
        btn.addEventListener('click', () => {
          gothicAudio.playHit();
          this.inspectedPower = target;
          this.renderMenu();
        });
        return btn;
      };

      const plus = document.createElement('span');
      plus.className = 'synergy-op';
      plus.textContent = '+';

      const arrow1 = document.createElement('span');
      arrow1.className = 'synergy-op';
      arrow1.textContent = '➔';

      const arrow2 = document.createElement('span');
      arrow2.className = 'synergy-op';
      arrow2.textContent = '➔';

      row.append(
        makeTile({ kind: 'weapon', id: baseId }, getWeaponIconUrl(baseId), baseW.name, 'base'),
        plus,
        makeTile({ kind: 'relic', id: catId }, getRelicIconUrl(catId), catR.name, 'base'),
        arrow1,
        makeTile({ kind: 'weapon', id: evoId }, getWeaponIconUrl(evoId), evoW.name, 'evolved'),
        arrow2,
        makeTile({ kind: 'weapon', id: ultId }, getWeaponIconUrl(ultId), ultW.name, 'ultimate')
      );
      matrix.appendChild(row);
    }

    // Left Bottom: 10 Exclusive Gold-Shop Legendary Weapons Shelf!
    const exclusiveSection = document.createElement('div');
    exclusiveSection.className = 'exclusive-arsenal-section';
    exclusiveSection.innerHTML = `
      <div class="exclusive-section-header">
        <span>🏪 Armas Exclusivas de Ouro (${rec.purchasedExclusiveWeapons.length}/10)</span>
        <span style="color:#ffd166; font-size:0.68rem">🪙 ${rec.totalGold.toLocaleString('pt-BR')}</span>
      </div>
    `;
    const exclusiveGrid = document.createElement('div');
    exclusiveGrid.className = 'exclusive-arsenal-grid';
    exclusiveGrid.dataset.testid = 'exclusive-arsenal-grid';

    for (const exId of ALL_EXCLUSIVE_WEAPONS) {
      const exW = WEAPONS[exId];
      const owned = rec.purchasedExclusiveWeapons.includes(exId);
      const forgeLv = rec.weaponForge[exId] ?? 0;
      const isSel = this.inspectedPower.kind === 'weapon' && this.inspectedPower.id === exId;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.testid = `exclusive-tile-${exId}`;
      btn.className = `power-icon-tile exclusive-tile ${owned ? 'owned' : 'locked-tile'} ${isSel ? 'selected' : ''}`;
      btn.title = `${exW.name} (${owned ? 'Adquirida' : `${(exW.goldPrice ?? 0).toLocaleString('pt-BR')} Ouro`})`;
      btn.innerHTML = `
        <img class="power-icon-img" src="${getWeaponIconUrl(exId)}" alt="${exW.name}" />
        ${
          owned
            ? forgeLv > 0
              ? `<span class="forge-lv-corner">⚒${forgeLv}</span>`
              : '<span class="evo-star-corner ultimate">✦</span>'
            : `<span class="gold-price-corner">${Math.round((exW.goldPrice ?? 0) / 100) / 10}k</span>`
        }
      `;
      btn.addEventListener('click', () => {
        gothicAudio.playHit();
        this.inspectedPower = { kind: 'weapon', id: exId };
        this.renderMenu();
      });
      exclusiveGrid.appendChild(btn);
    }
    exclusiveSection.appendChild(exclusiveGrid);
    leftCol.append(matrix, exclusiveSection);

    // Right: Rich Power Inspector Card
    const inspector = document.createElement('div');
    inspector.className = 'showcase-panel codex-card';

    if (this.inspectedPower.kind === 'weapon') {
      const w = WEAPONS[this.inspectedPower.id];
      const cat = w.catalystRelic ? RELICS[w.catalystRelic] : null;
      const evo = w.evolvesInto ? WEAPONS[w.evolvesInto] : null;
      const evoUlt = evo?.ultimateInto ? WEAPONS[evo.ultimateInto] : null;
      const fromBase = w.evolvesFrom ? WEAPONS[w.evolvesFrom] : null;
      const fromCat = fromBase?.catalystRelic ? RELICS[fromBase.catalystRelic] : null;
      const myUlt = w.ultimateInto ? WEAPONS[w.ultimateInto] : null;
      const ultFromEvo = w.ultimateOf ? WEAPONS[w.ultimateOf] : null;
      const ultFromBase = ultFromEvo?.evolvesFrom ? WEAPONS[ultFromEvo.evolvesFrom] : null;
      const ultFromCat = ultFromBase?.catalystRelic ? RELICS[ultFromBase.catalystRelic] : null;

      const levelsHtml = w.descriptions
        .map(
          (d, idx) =>
            `<div style="font-size:0.78rem; padding:3px 0; color:#e2d7e0"><strong>${w.isUltimate ? 'Forma Ultimate' : `Grau ${idx + 1}`}:</strong> ${d}</div>`
        )
        .join('');

      const chainHtml =
        cat && evo && evoUlt
          ? `<div class="evo-recipe-box">
              <span><img class="mini-icon-inline" src="${getWeaponIconUrl(w.id)}" alt="" /> <strong>${w.name} (Nv.5)</strong></span>
              <span>+</span>
              <span><img class="mini-icon-inline" src="${getRelicIconUrl(cat.id)}" alt="" /> <strong>${cat.name}</strong></span>
              <span>➔</span>
              <span><img class="mini-icon-inline" src="${getWeaponIconUrl(evo.id)}" alt="" /> <strong style="color:#ffe79e">★ ${evo.name} (Nv.3)</strong></span>
              <span>➔</span>
              <span><img class="mini-icon-inline" src="${getWeaponIconUrl(evoUlt.id)}" alt="" /> <strong style="color:#ffd166">👑 ${evoUlt.name}</strong></span>
            </div>`
          : fromBase && fromCat && myUlt
            ? `<div class="evo-recipe-box">
                <span>Evolui de <img class="mini-icon-inline" src="${getWeaponIconUrl(fromBase.id)}" alt="" /> <strong>${fromBase.name}</strong> + <img class="mini-icon-inline" src="${getRelicIconUrl(fromCat.id)}" alt="" /> <strong>${fromCat.name}</strong></span>
                <span>➔</span>
                <span>No Nv.3 (+ Relíquia Nv.2): <img class="mini-icon-inline" src="${getWeaponIconUrl(myUlt.id)}" alt="" /> <strong style="color:#ffd166">👑 ${myUlt.name}</strong></span>
              </div>`
            : ultFromEvo && ultFromCat
              ? `<div class="evo-recipe-box">
                  <span>Forma Ultimate Suprema de <img class="mini-icon-inline" src="${getWeaponIconUrl(ultFromEvo.id)}" alt="" /> <strong>${ultFromEvo.name} (Nv.3)</strong> + <img class="mini-icon-inline" src="${getRelicIconUrl(ultFromCat.id)}" alt="" /> <strong>${ultFromCat.name} (Nv.2+)</strong></span>
                </div>`
              : '';

      const badgeColor = w.isExclusive
        ? '#ffd166'
        : w.isUltimate
          ? '#ffd166'
          : w.isEvolved
            ? '#ff8fa3'
            : '#98f5cb';
      const tileClass = w.isExclusive
        ? 'ultimate-tile'
        : w.isUltimate
          ? 'ultimate-tile'
          : w.isEvolved
            ? 'evolved-tile'
            : '';

      inspector.innerHTML = `
        <div>
          <div style="display:flex; align-items:center; gap:14px; margin-bottom:10px">
            <div class="power-icon-tile ${tileClass} selected" style="width:72px; height:72px; margin:0; cursor:default">
              <img class="power-icon-img" src="${getWeaponIconUrl(w.id)}" alt="${w.name}" />
            </div>
            <div>
              <div style="font-size:0.72rem; color:${badgeColor}; text-transform:uppercase; font-weight:700">${w.category}</div>
              <h3 style="font-family:var(--font-display); font-size:1.4rem; color:var(--gold-bright); margin:2px 0">${w.name}</h3>
              <div style="font-size:0.76rem; color:var(--text-muted)">${w.mechanicSummary}</div>
            </div>
          </div>

          <p style="font-size:0.9rem; color:var(--text-ivory); margin:8px 0">${w.tagline}</p>
          <div style="margin:8px 0">${levelsHtml}</div>
          ${chainHtml}
        </div>
      `;
    } else {
      const r = RELICS[this.inspectedPower.id];
      const synW = WEAPONS[r.synergyWeapon];
      const evo = synW.evolvesInto ? WEAPONS[synW.evolvesInto] : null;
      const ult = evo?.ultimateInto ? WEAPONS[evo.ultimateInto] : null;
      const relicUnlocked = rec.unlockedWeapons.includes(r.synergyWeapon);
      const relicStage = getWeaponDiscoveryStage(r.synergyWeapon);
      inspector.innerHTML = `
        <div>
          <div style="display:flex; align-items:center; gap:14px; margin-bottom:10px">
            <div class="power-icon-tile ${relicUnlocked ? '' : 'locked-tile'} selected" style="width:72px; height:72px; margin:0; cursor:default">
              <img class="power-icon-img" src="${getRelicIconUrl(r.id)}" alt="${r.name}" />
              ${relicUnlocked ? '' : '<span class="lock-corner">🔒</span>'}
            </div>
            <div>
              <div style="font-size:0.72rem; color:#ffd166; text-transform:uppercase; font-weight:700">Relíquia Passiva · Máximo Grau ${r.maxLevel}</div>
              <h3 style="font-family:var(--font-display); font-size:1.4rem; color:var(--gold-bright); margin:2px 0">${r.name}</h3>
              <div style="font-size:0.76rem; color:var(--text-muted)">${r.tagline}</div>
            </div>
          </div>

          <div style="font-size:0.78rem; margin:6px 0; color:${relicUnlocked ? '#7be0ad' : '#ffb3c1'}" data-testid="relic-lock-status">
            ${
              relicUnlocked
                ? `✦ Catalisador Desbloqueado (liberado com ${synW.name})`
                : `🔒 Catalisador Bloqueado · Libera na Fase ${relicStage?.roman ?? '?'} junto com ${synW.name} (${relicStage?.hiddenAltarName ?? ''})`
            }
          </div>

          <p style="font-size:0.92rem; color:var(--text-ivory); margin:12px 0">${r.bonusPerLevel}</p>

          ${
            evo && ult
              ? `<div class="evo-recipe-box">
                  <span>Catalisa <img class="mini-icon-inline" src="${getWeaponIconUrl(synW.id)}" alt="" /> <strong>${synW.name}</strong></span>
                  <span>➔</span>
                  <span><img class="mini-icon-inline" src="${getWeaponIconUrl(evo.id)}" alt="" /> <strong style="color:#ffe79e">★ ${evo.name}</strong></span>
                  <span>➔</span>
                  <span><img class="mini-icon-inline" src="${getWeaponIconUrl(ult.id)}" alt="" /> <strong style="color:#ffd166">👑 ${ult.name}</strong></span>
                </div>`
              : ''
          }
        </div>
      `;
    }

    // Out-of-Game Weapon Evolution Forge & Gold Shop Panel for the selected weapon lineage
    const inspectedWeaponDef =
      this.inspectedPower.kind === 'weapon' ? WEAPONS[this.inspectedPower.id] : null;
    const isInspectingExclusive = Boolean(inspectedWeaponDef?.isExclusive);

    const forgeTargetId: ForgeableWeaponId = isInspectingExclusive
      ? (inspectedWeaponDef!.id as ExclusiveWeaponId)
      : this.inspectedPower.kind === 'weapon'
        ? (() => {
            const w = WEAPONS[this.inspectedPower.id];
            if (w.isUltimate && w.ultimateOf) {
              return WEAPONS[w.ultimateOf].evolvesFrom ?? 'whip';
            }
            if (w.isEvolved && w.evolvesFrom) return w.evolvesFrom;
            return w.id as BaseWeaponId;
          })()
        : RELICS[this.inspectedPower.id].synergyWeapon;

    const targetWDef = WEAPONS[forgeTargetId];
    const baseCatDef = targetWDef.catalystRelic ? RELICS[targetWDef.catalystRelic] : undefined;
    const isUnlocked = isInspectingExclusive
      ? rec.purchasedExclusiveWeapons.includes(forgeTargetId as ExclusiveWeaponId)
      : rec.unlockedWeapons.includes(forgeTargetId as BaseWeaponId);
    const forgeLv = rec.weaponForge[forgeTargetId] ?? 0;
    const fb = computeWeaponForgeBonus(forgeLv);
    const discStage = isInspectingExclusive
      ? undefined
      : getWeaponDiscoveryStage(forgeTargetId as BaseWeaponId);
    const nextSoulCost = forgeLv < MAX_WEAPON_FORGE_LEVEL ? WEAPON_FORGE_COSTS[forgeLv] : 0;
    const nextGoldCost = forgeLv < MAX_WEAPON_FORGE_LEVEL ? WEAPON_FORGE_GOLD_COSTS[forgeLv] : 0;
    const exclusivePrice = targetWDef.goldPrice ?? 0;
    const canBuyExclusive = isInspectingExclusive && !isUnlocked && rec.totalGold >= exclusivePrice;
    const canForgeSouls =
      !isInspectingExclusive &&
      isUnlocked &&
      forgeLv < MAX_WEAPON_FORGE_LEVEL &&
      rec.totalSouls >= nextSoulCost;
    const canForgeGold =
      isUnlocked && forgeLv < MAX_WEAPON_FORGE_LEVEL && rec.totalGold >= nextGoldCost;

    const forgeEl = document.createElement('div');
    forgeEl.className = 'weapon-forge-panel';
    forgeEl.dataset.testid = 'weapon-forge-panel';
    forgeEl.innerHTML = `
      <div class="forge-header-row">
        <span class="forge-title">⚒ Forja & Evolução Fora de Jogo · ${targetWDef.name}</span>
        <span class="forge-souls-tag">
          🪙 <strong data-testid="forge-gold-balance">${rec.totalGold.toLocaleString('pt-BR')}</strong> ·
          ✦ <strong data-testid="forge-souls-balance">${rec.totalSouls}</strong>
        </span>
      </div>
      <div class="forge-status-line" data-testid="forge-lock-status">
        ${
          isInspectingExclusive
            ? isUnlocked
              ? `<span style="color:#7be0ad">✦ Arma Exclusiva Adquirida! Disponível nos Level-Ups e na Forja de Ouro.</span>`
              : `<span style="color:#ffd166">🏪 Exclusiva da Loja de Ouro · Preço: <strong>${exclusivePrice.toLocaleString('pt-BR')} Ouro</strong></span>`
            : isUnlocked
              ? `<span style="color:#7be0ad">✦ Linhagem Desbloqueada (${targetWDef.name}${baseCatDef ? ` + ${baseCatDef.name}` : ''}) & Disponível nas Fases</span>`
              : `<span style="color:#ffb3c1">🔒 Oculta na Fase ${discStage?.roman ?? '?'}: ${discStage?.name ?? ''} — libera ${targetWDef.name}${baseCatDef ? ` + ${baseCatDef.name}` : ''} (${discStage?.hiddenAltarName ?? ''})</span>`
        }
      </div>
      <div class="forge-bonus-grid">
        <span>Grau: <strong data-testid="forge-level-val">${forgeLv} / ${MAX_WEAPON_FORGE_LEVEL}</strong></span>
        <span>Dano: <strong>+${Math.round((fb.damageMult - 1) * 100)}%</strong></span>
        <span>Área: <strong>+${Math.round((fb.areaMult - 1) * 100)}%</strong></span>
        <span>Recarga: <strong>-${Math.round((1 - fb.cooldownMult) * 100)}%</strong></span>
        <span>Projéteis: <strong>+${fb.bonusAmount}</strong></span>
        <span>Inicial: <strong>Nv.${fb.startingLevel}</strong>${!isInspectingExclusive && fb.earlyEvoDiscount > 0 ? ' · <strong style="color:#ffd166">Evolui -1 Nv!</strong>' : ''}</span>
      </div>
      <div class="forge-actions-row">
        ${
          isInspectingExclusive && !isUnlocked
            ? `<button type="button" class="btn-gothic forge-upgrade-btn gold-action-btn" data-testid="buy-exclusive-btn" ${canBuyExclusive ? '' : 'disabled'}>
                ${canBuyExclusive ? `🪙 Comprar Arma Exclusiva (${exclusivePrice.toLocaleString('pt-BR')} Ouro)` : `🔒 Precisa ${exclusivePrice.toLocaleString('pt-BR')} Ouro`}
              </button>`
            : `${
                !isInspectingExclusive
                  ? `<button type="button" class="btn-gothic forge-upgrade-btn" data-testid="forge-upgrade-btn" ${canForgeSouls ? '' : 'disabled'}>
                      ${
                        !isUnlocked
                          ? `🔒 Encontre na Fase ${discStage?.roman ?? '?'}`
                          : forgeLv >= MAX_WEAPON_FORGE_LEVEL
                            ? '👑 Forja Suprema Máxima (5/5)'
                            : rec.totalSouls >= nextSoulCost
                              ? `⚒ Evoluir na Forja (${nextSoulCost} ✦)`
                              : `Precisa ${nextSoulCost} Almas ✦`
                      }
                    </button>`
                  : ''
              }
              <button type="button" class="btn-gothic secondary forge-upgrade-btn gold-action-btn" data-testid="forge-upgrade-gold-btn" ${canForgeGold ? '' : 'disabled'}>
                ${
                  !isUnlocked
                    ? '🔒 Bloqueada'
                    : forgeLv >= MAX_WEAPON_FORGE_LEVEL
                      ? '👑 Forja Máxima (5/5)'
                      : `🪙 Forjar c/ Ouro (${nextGoldCost.toLocaleString('pt-BR')})`
                }
              </button>`
        }
      </div>
    `;
    forgeEl.querySelector('[data-testid="buy-exclusive-btn"]')?.addEventListener('click', () => {
      if (this.buyExclusiveWeapon(forgeTargetId as ExclusiveWeaponId)) {
        this.renderMenu();
      }
    });
    forgeEl.querySelector('[data-testid="forge-upgrade-btn"]')?.addEventListener('click', () => {
      if (this.upgradeWeaponInForge(forgeTargetId, 'souls')) {
        this.renderMenu();
      }
    });
    forgeEl
      .querySelector('[data-testid="forge-upgrade-gold-btn"]')
      ?.addEventListener('click', () => {
        if (this.upgradeWeaponInForge(forgeTargetId, 'gold')) {
          this.renderMenu();
        }
      });
    inspector.appendChild(forgeEl);

    // Compact Per-Stage Weapon & Catalyst Discovery Table
    const guideRowsHtml = [
      `<div class="arsenal-guide-row unlocked">
        <span><strong>Iniciais:</strong></span>
        <span>
          <img class="mini-icon-inline" src="${getWeaponIconUrl('whip')}" alt="" /> ${WEAPONS.whip.name} +
          <img class="mini-icon-inline" src="${getRelicIconUrl('black_heart')}" alt="" /> ${RELICS.black_heart.name} ·
          <img class="mini-icon-inline" src="${getWeaponIconUrl('wand')}" alt="" /> ${WEAPONS.wand.name} +
          <img class="mini-icon-inline" src="${getRelicIconUrl('empty_tome')}" alt="" /> ${RELICS.empty_tome.name}
        </span>
        <span class="guide-badge unlocked">✦ Iniciais</span>
      </div>`,
      ...STAGES.map((st) => {
        const w = WEAPONS[st.hiddenWeapon];
        const c = w.catalystRelic ? RELICS[w.catalystRelic] : undefined;
        const unlocked = rec.unlockedWeapons.includes(st.hiddenWeapon);
        return `
          <div class="arsenal-guide-row ${unlocked ? 'unlocked' : 'locked'}">
            <span><strong>Fase ${st.roman}</strong> (${st.name}):</span>
            <span><img class="mini-icon-inline" src="${getWeaponIconUrl(st.hiddenWeapon)}" alt="${w.name}" /> ${w.name}${c ? ` + <img class="mini-icon-inline" src="${getRelicIconUrl(c.id)}" alt="${c.name}" /> ${c.name}` : ''}</span>
            <span class="guide-badge ${unlocked ? 'unlocked' : 'locked'}">${unlocked ? '✦ Liberados' : '🔒 Ocultos'}</span>
          </div>
        `;
      }),
    ].join('');

    const stageListEl = document.createElement('div');
    stageListEl.className = 'arsenal-stage-weapons-list';
    stageListEl.dataset.testid = 'arsenal-stage-weapons-list';
    stageListEl.innerHTML = `
      <div class="forge-title" style="margin-bottom:6px">🗺 Guia: Onde Liberar Cada Arma & Catalisador por Fase</div>
      <div class="arsenal-guide-rows">${guideRowsHtml}</div>
    `;
    inspector.appendChild(stageListEl);

    body.append(leftCol, inspector);
    shell.appendChild(body);
    menu.appendChild(shell);
  }

  private buildLoreScreen(menu: HTMLElement): void {
    const shell = document.createElement('div');
    shell.className = 'subscreen-shell';

    const header = document.createElement('div');
    header.className = 'subscreen-header';
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn-gothic secondary';
    backBtn.textContent = '← Menu';
    backBtn.addEventListener('click', () => {
      this.currentScreen = 'splash';
      this.renderMenu();
    });
    const title = document.createElement('h2');
    title.className = 'subscreen-title';
    title.textContent = 'Grimório da Véspera & Crônicas';
    header.append(backBtn, title, document.createElement('div'));
    shell.appendChild(header);

    const entries: Array<{ title: string; subtitle: string; body: string; banner?: string }> = [
      ...LORE_CHAPTERS.map((c) => ({ title: c.title, subtitle: c.subtitle, body: c.body })),
      ...STAGES.map((s) => ({
        title: `Fase ${s.roman} · ${s.name}`,
        subtitle: s.subtitle,
        body: s.lore,
        banner: s.bannerUrl,
      })),
    ];

    const body = document.createElement('div');
    body.className = 'subscreen-body';

    const roster = document.createElement('div');
    roster.className = 'roster-list';
    entries.forEach((ent, idx) => {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = `roster-slot ${this.selectedLoreIndex === idx ? 'selected' : ''}`;
      slot.innerHTML = `
        <div>
          <div class="roster-slot-name">${ent.title}</div>
          <div class="roster-slot-sub">${ent.subtitle}</div>
        </div>
      `;
      slot.addEventListener('click', () => {
        this.selectedLoreIndex = idx;
        this.renderMenu();
      });
      roster.appendChild(slot);
    });

    const chosen = entries[this.selectedLoreIndex] ?? entries[0];
    const page = document.createElement('div');
    page.className = 'showcase-panel codex-card';
    page.innerHTML = `
      <div>
        ${
          chosen.banner
            ? `<div class="stage-cinema-banner" style="margin-bottom:12px"><img src="${chosen.banner}" alt="${chosen.title}" /></div>`
            : ''
        }
        <h3 style="font-family:var(--font-display); font-size:1.35rem; color:var(--gold-bright); margin:0 0 4px">${chosen.title}</h3>
        <div style="font-size:0.8rem; color:#ff9ebb; margin-bottom:12px">${chosen.subtitle}</div>
        <p style="font-family:var(--font-lore); font-size:1.12rem; line-height:1.5; color:#ebe1e9; margin:0">${chosen.body}</p>
      </div>
    `;

    body.append(roster, page);
    shell.appendChild(body);
    menu.appendChild(shell);
  }

  private beginArenaRun(resumeCheckpoint?: SavedActiveRun): void {
    const rec = this.loadRecords();
    const hero = resumeCheckpoint?.heroId ?? this.selectedHero;
    const stage = resumeCheckpoint?.stageId ?? this.selectedStage;
    const diff = resumeCheckpoint?.difficultyId ?? this.selectedDifficulty;
    this.selectedHero = hero;
    this.selectedStage = stage;
    this.selectedDifficulty = diff;

    this.transitionWithCurtain(() => {
      this.mountHudDom();
      this.onStartRun(
        hero,
        stage,
        diff,
        {
          onHudUpdate: (snap) => this.updateHud(snap),
          onLevelUpChoices: (choices, onPick) => this.showLevelUpModal(choices, onPick),
          onRelicChestOpen: (reward, onClose) => this.showRelicChestModal(reward, onClose),
          onBannerAnnouncement: (title, sub) => this.showBanner(title, sub),
          onPauseChanged: (paused) => this.handlePauseModal(paused),
          onStage30MinBossCleared: (summary, onContinue, onFinish) =>
            this.showStage30MinClearedModal(summary, onContinue, onFinish),
          onWeaponDiscovered: (wId) => this.unlockWeaponPermanently(wId),
          onSaveRunCheckpoint: (cp) => this.saveRunCheckpoint(cp),
          onRunEnded: (summary) => this.showRunSummaryModal(summary),
        },
        {
          unlockedWeapons: rec.unlockedWeapons,
          purchasedExclusiveWeapons: rec.purchasedExclusiveWeapons,
          heroUpgrades: rec.heroUpgrades[hero],
          weaponForge: rec.weaponForge,
        },
        resumeCheckpoint
      );
    });
  }

  private resumeSavedRun(savedRun: SavedActiveRun): void {
    this.beginArenaRun(savedRun);
  }

  private mountHudDom(): void {
    this.lastRenderedScreen = null;
    this.hudLastXpPct = -1;
    this.hudLastLevel = -1;
    this.hudLastClock = '';
    this.hudLastPhase = '';
    this.hudLastCompassSig = '';
    this.hudLastKills = -1;
    this.hudLastSouls = -1;
    this.hudLastGold = -1;
    this.hudLastDashPct = -1;
    this.hudLastDashLabel = '';
    this.hudLastWeaponsSig = '';
    this.hudLastRelicsSig = '';
    this.hudLastBossSig = '';
    const hud = document.createElement('div');
    hud.className = 'hud-root';
    hud.dataset.testid = 'arena-hud';

    hud.innerHTML = `
      <div class="xp-bar-wrap">
        <div class="xp-bar-fill" style="width: 0%"></div>
        <span class="xp-level-tag">NV 1</span>
      </div>

      <div class="hud-top-row">
        <div class="slots-panel">
          <div class="slot-row" data-weapon-slots></div>
          <div class="slot-row" data-relic-slots></div>
        </div>

        <div class="clock-panel">
          <div class="clock-time" data-clock-time>00:00</div>
          <div class="clock-phase" data-clock-phase>Fase I · Ato I</div>
          <div class="hud-weapon-compass" data-testid="hud-weapon-compass" style="display:none"></div>
        </div>

        <div class="stats-right">
          <div class="stat-pill">☠ <strong data-kills>0</strong></div>
          <div class="stat-pill hud-gold-pill">🪙 <strong data-gold data-testid="hud-gold">0</strong></div>
          <div class="stat-pill">✦ <strong data-souls>0</strong></div>
          <button type="button" class="hud-icon-btn" data-hud-fs title="Tela Cheia Deitada">⛶</button>
          <button type="button" class="hud-icon-btn" data-hud-bgm title="Música">${gothicSoundtrack.isMuted() ? '🎵✕' : '🎵'}</button>
          <button type="button" class="hud-icon-btn" data-mute-btn title="Efeitos">${gothicAudio.isMuted() ? '🔇' : '🔊'}</button>
          <button type="button" class="hud-icon-btn" data-pause-btn data-testid="pause-btn">❚❚</button>
        </div>
      </div>

      <div class="event-banner" data-banner>
        <div class="event-banner-title" data-banner-title></div>
        <div class="event-banner-sub" data-banner-sub></div>
      </div>

      <div class="boss-bar-container" data-boss-wrap style="display:none">
        <div class="boss-bar-name" data-boss-name></div>
        <div class="boss-bar-track">
          <div class="boss-bar-fill" data-boss-fill style="width:100%"></div>
        </div>
      </div>

      <div class="touch-drag-surface" data-touch-surface></div>
      <div class="floating-joystick" data-floating-joy>
        <div class="floating-joystick-knob" data-floating-knob></div>
      </div>

      <button type="button" class="dash-btn ready" data-dash-btn data-testid="dash-btn" title="Passo Espectral (Espaço)">
        <span class="dash-btn-inner" data-dash-label>PASSO<br/>ESPECTRAL</span>
      </button>

      <div data-modal-host></div>
    `;

    this.hudRoot = hud;
    this.xpFillEl = hud.querySelector('.xp-bar-fill');
    this.xpLevelEl = hud.querySelector('.xp-level-tag');
    this.weaponRowEl = hud.querySelector('[data-weapon-slots]');
    this.relicRowEl = hud.querySelector('[data-relic-slots]');
    this.clockTimeEl = hud.querySelector('[data-clock-time]');
    this.clockPhaseEl = hud.querySelector('[data-clock-phase]');
    this.weaponCompassEl = hud.querySelector('[data-testid="hud-weapon-compass"]');
    this.killsEl = hud.querySelector('[data-kills]');
    this.soulsEl = hud.querySelector('[data-souls]');
    this.goldEl = hud.querySelector('[data-gold]');
    this.dashBtnEl = hud.querySelector('[data-dash-btn]');
    this.dashLabelEl = hud.querySelector('[data-dash-label]');
    this.bannerEl = hud.querySelector('[data-banner]');
    this.bannerTitleEl = hud.querySelector('[data-banner-title]');
    this.bannerSubEl = hud.querySelector('[data-banner-sub]');
    this.bossWrapEl = hud.querySelector('[data-boss-wrap]');
    this.bossNameEl = hud.querySelector('[data-boss-name]');
    this.bossFillEl = hud.querySelector('[data-boss-fill]');
    this.modalHostEl = hud.querySelector('[data-modal-host]');

    const bindMultitouchTap = (btn: Element | null, action: () => void) => {
      if (!btn) return;
      let lastTriggerAt = 0;
      const fire = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
        const now = performance.now();
        if (now - lastTriggerAt < 80) return;
        lastTriggerAt = now;
        action();
      };
      btn.addEventListener('pointerdown', fire);
      btn.addEventListener('touchstart', fire, { passive: false });
      btn.addEventListener('click', (ev) => {
        // Fallback for keyboard activation (Enter/Space) or automated synthetic .click()
        if ((ev as MouseEvent).detail === 0 || performance.now() - lastTriggerAt > 250) {
          lastTriggerAt = performance.now();
          action();
        }
      });
    };

    bindMultitouchTap(hud.querySelector('[data-hud-fs]'), () => {
      this.viewport.toggleFullscreenLandscape();
    });

    const bgmBtn = hud.querySelector('[data-hud-bgm]') as HTMLButtonElement;
    bindMultitouchTap(bgmBtn, () => {
      const m = gothicSoundtrack.toggleMute();
      bgmBtn.textContent = m ? '🎵✕' : '🎵';
    });

    const muteBtn = hud.querySelector('[data-mute-btn]') as HTMLButtonElement;
    bindMultitouchTap(muteBtn, () => {
      const m = gothicAudio.toggleMute();
      muteBtn.textContent = m ? '🔇' : '🔊';
    });

    bindMultitouchTap(hud.querySelector('[data-pause-btn]'), () => this.onTogglePause());

    const fireDashFromUi = () => {
      const triggered = this.onTriggerDash();
      if (triggered && this.dashBtnEl) {
        this.dashBtnEl.classList.remove('dash-burst');
        void this.dashBtnEl.offsetWidth;
        this.dashBtnEl.classList.add('dash-burst');
      }
    };
    bindMultitouchTap(this.dashBtnEl, fireDashFromUi);

    this.setupDynamicFloatingJoystick(
      hud.querySelector('[data-touch-surface]') as HTMLElement,
      hud.querySelector('[data-floating-joy]') as HTMLElement,
      hud.querySelector('[data-floating-knob]') as HTMLElement,
      fireDashFromUi
    );

    this.root.replaceChildren(hud);
  }

  private setupDynamicFloatingJoystick(
    surface: HTMLElement,
    ring: HTMLElement,
    knob: HTMLElement,
    onSecondThumbDash: () => void
  ): void {
    let activePointerId: number | null = null;
    let originX = 0;
    let originY = 0;
    const maxRadius = 40;

    const updateMove = (ev: PointerEvent) => {
      const pt = this.viewport.mapClientToLogical(ev.clientX, ev.clientY);
      let dx = pt.x - originX;
      let dy = pt.y - originY;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.onSetVirtualJoystick(dx / maxRadius, dy / maxRadius);
    };

    const release = () => {
      activePointerId = null;
      ring.classList.remove('active');
      knob.style.transform = 'translate(0px, 0px)';
      this.onSetVirtualJoystick(0, 0);
    };

    surface.addEventListener('pointerdown', (ev) => {
      const pt = this.viewport.mapClientToLogical(ev.clientX, ev.clientY);
      const logical = this.viewport.getLogicalSize();

      // If left thumb is ALREADY steering the joystick, a second thumb tapping the right-hand dash zone triggers Passo Espectral!
      if (activePointerId !== null) {
        if (pt.x > logical.width * 0.62 && pt.y > logical.height * 0.45) {
          onSecondThumbDash();
        }
        return;
      }

      activePointerId = ev.pointerId;
      originX = pt.x;
      originY = pt.y;
      ring.style.left = `${originX}px`;
      ring.style.top = `${originY}px`;
      ring.classList.add('active');
      try {
        surface.setPointerCapture(ev.pointerId);
      } catch {
        // Ignore if synthetic pointer event has no active hardware pointerId
      }
      updateMove(ev);
    });

    surface.addEventListener('pointermove', (ev) => {
      if (ev.pointerId === activePointerId) updateMove(ev);
    });

    surface.addEventListener('pointerup', (ev) => {
      if (ev.pointerId === activePointerId) release();
    });

    surface.addEventListener('pointercancel', release);
  }

  private updateHud(snap: HudSnapshot): void {
    if (!this.hudRoot) return;

    const xpPct = Math.min(100, Math.round((snap.xp / Math.max(1, snap.xpToNext)) * 100));
    if (this.xpFillEl && xpPct !== this.hudLastXpPct) {
      this.hudLastXpPct = xpPct;
      this.xpFillEl.style.width = `${xpPct}%`;
    }
    if (this.xpLevelEl && snap.level !== this.hudLastLevel) {
      this.hudLastLevel = snap.level;
      this.xpLevelEl.textContent = `NV ${snap.level}`;
    }
    const clockText = `${formatClock(snap.elapsedSeconds)} / 40:00`;
    if (this.clockTimeEl && clockText !== this.hudLastClock) {
      this.hudLastClock = clockText;
      this.clockTimeEl.textContent = clockText;
    }
    const phaseText = `Fase ${snap.stageRoman} · ${snap.actName} · ${snap.difficultyLabel}`;
    if (this.clockPhaseEl && phaseText !== this.hudLastPhase) {
      this.hudLastPhase = phaseText;
      this.clockPhaseEl.textContent = phaseText;
    }
    if (this.weaponCompassEl) {
      if (snap.hiddenWeapon) {
        const hw = snap.hiddenWeapon;
        const compassSig = hw.claimedInRun
          ? `claimed:${hw.weaponName}`
          : `${hw.weaponName}:${hw.distanceMeters}:${Math.round(hw.angleDeg / 6) * 6}:${hw.alreadyUnlocked ? 1 : 0}`;
        if (compassSig !== this.hudLastCompassSig) {
          this.hudLastCompassSig = compassSig;
          this.weaponCompassEl.style.display = 'inline-flex';
          this.weaponCompassEl.className = `hud-weapon-compass ${hw.claimedInRun ? 'claimed' : ''}`;
          this.weaponCompassEl.innerHTML = hw.claimedInRun
            ? `✦ <strong>${hw.weaponName}</strong> Liberada!`
            : `<span class="compass-arrow" style="transform: rotate(${hw.angleDeg}deg)">➤</span><span>${hw.alreadyUnlocked ? '✦' : '🔒'} ${hw.weaponName} · <strong>${hw.distanceMeters}m</strong></span>`;
        }
      } else if (this.hudLastCompassSig !== 'none') {
        this.hudLastCompassSig = 'none';
        this.weaponCompassEl.style.display = 'none';
      }
    }
    if (this.killsEl && snap.kills !== this.hudLastKills) {
      this.hudLastKills = snap.kills;
      this.killsEl.textContent = `${snap.kills}`;
    }
    if (this.soulsEl && snap.souls !== this.hudLastSouls) {
      this.hudLastSouls = snap.souls;
      this.soulsEl.textContent = `${snap.souls}`;
    }
    const goldVal = snap.gold ?? 0;
    if (this.goldEl && goldVal !== this.hudLastGold) {
      this.hudLastGold = goldVal;
      this.goldEl.textContent = `${goldVal.toLocaleString('pt-BR')}`;
    }

    if (this.dashBtnEl) {
      const pct = Math.round(snap.dashReadyRatio * 100);
      if (pct !== this.hudLastDashPct) {
        this.hudLastDashPct = pct;
        this.dashBtnEl.style.setProperty('--dash-pct', `${pct}%`);
      }
      const nextDashLabel =
        snap.dashReadyRatio >= 0.999 ? 'PASSO<br/>ESPECTRAL' : `${snap.dashCooldownRemaining.toFixed(1)}s`;
      if (nextDashLabel !== this.hudLastDashLabel) {
        this.hudLastDashLabel = nextDashLabel;
        if (snap.dashReadyRatio >= 0.999) {
          this.dashBtnEl.classList.add('ready');
        } else {
          this.dashBtnEl.classList.remove('ready');
        }
        if (this.dashLabelEl) this.dashLabelEl.innerHTML = nextDashLabel;
      }
    }

    // Redesigned Illustrated HUD Power Rack (6 Weapons + 6 Relics) — ONLY rebuild DOM when inventory changes!
    if (this.weaponRowEl) {
      const entries = Object.entries(snap.inventory.weapons) as Array<[WeaponId, number]>;
      let sig = '';
      for (let i = 0; i < entries.length; i++) {
        const [wId, lv] = entries[i];
        const def = WEAPONS[wId];
        const baseCat = def.evolvesFrom ? WEAPONS[def.evolvesFrom].catalystRelic : def.catalystRelic;
        const catLv = baseCat ? (snap.inventory.relics[baseCat] ?? 0) : 0;
        sig += `${wId}:${lv}:${catLv}|`;
      }
      if (sig !== this.hudLastWeaponsSig) {
        this.hudLastWeaponsSig = sig;
        let html = '';
        for (let i = 0; i < 6; i++) {
          const entry = entries[i];
          if (entry) {
            const [wId, lv] = entry;
            const def = WEAPONS[wId];
            const baseCat = def.evolvesFrom ? WEAPONS[def.evolvesFrom].catalystRelic : def.catalystRelic;
            const readyEvo =
              !def.isUltimate &&
              lv >= def.maxLevel &&
              Boolean(baseCat && (snap.inventory.relics[baseCat] ?? 0) >= (def.isEvolved ? 2 : 1));
            const stateCls = def.isUltimate
              ? 'ultimate'
              : def.isEvolved
                ? readyEvo
                  ? 'evolved ready-evolve'
                  : 'evolved'
                : readyEvo
                  ? 'ready-evolve'
                  : '';
            html += `
              <div class="item-slot ${stateCls}" title="${def.name}">
                <img class="slot-icon-img" src="${getWeaponIconUrl(wId)}" alt="${def.name}" />
                ${
                  def.isUltimate
                    ? '<span class="slot-evo-badge ultimate">👑</span>'
                    : `${def.isEvolved ? '<span class="slot-evo-badge">★</span>' : ''}${renderLevelPips(lv, def.maxLevel)}`
                }
              </div>
            `;
          } else {
            html += `<div class="item-slot empty"></div>`;
          }
        }
        this.weaponRowEl.innerHTML = html;
      }
    }

    if (this.relicRowEl) {
      const entries = Object.entries(snap.inventory.relics) as Array<[RelicId, number]>;
      let sig = '';
      for (let i = 0; i < entries.length; i++) {
        sig += `${entries[i][0]}:${entries[i][1]}|`;
      }
      if (sig !== this.hudLastRelicsSig) {
        this.hudLastRelicsSig = sig;
        let html = '';
        for (let i = 0; i < 6; i++) {
          const entry = entries[i];
          if (entry) {
            const [rId, lv] = entry;
            const def = RELICS[rId];
            html += `
              <div class="item-slot" title="${def.name}">
                <img class="slot-icon-img" src="${getRelicIconUrl(rId)}" alt="${def.name}" />
                ${renderLevelPips(lv, def.maxLevel)}
              </div>
            `;
          } else {
            html += `<div class="item-slot empty"></div>`;
          }
        }
        this.relicRowEl.innerHTML = html;
      }
    }

    if (this.bossWrapEl && this.bossNameEl && this.bossFillEl) {
      if (snap.boss) {
        const pct = Math.max(0, Math.min(100, Math.round((snap.boss.hp / snap.boss.maxHp) * 1000) / 10));
        const bSig = `${snap.boss.name}:${pct}`;
        if (bSig !== this.hudLastBossSig) {
          this.hudLastBossSig = bSig;
          this.bossWrapEl.style.display = 'block';
          this.bossNameEl.textContent = `✦ ${snap.boss.name} ✦`;
          this.bossFillEl.style.width = `${pct}%`;
        }
      } else if (this.hudLastBossSig !== 'none') {
        this.hudLastBossSig = 'none';
        this.bossWrapEl.style.display = 'none';
      }
    }
  }

  private showBanner(title: string, subtitle: string): void {
    if (!this.bannerEl || !this.bannerTitleEl || !this.bannerSubEl) return;
    this.bannerTitleEl.textContent = title;
    this.bannerSubEl.textContent = subtitle;
    this.bannerEl.classList.add('visible');

    if (this.bannerTimeout !== null) window.clearTimeout(this.bannerTimeout);
    this.bannerTimeout = window.setTimeout(() => {
      this.bannerEl?.classList.remove('visible');
    }, 3600);
  }

  private clearKeyPickHandler(): void {
    if (this.keyPickHandler) {
      window.removeEventListener('keydown', this.keyPickHandler);
      this.keyPickHandler = null;
    }
  }

  private showLevelUpModal(
    choices: UpgradeChoice[],
    onPick: (choice: UpgradeChoice) => void
  ): void {
    if (!this.modalHostEl) return;
    this.clearKeyPickHandler();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.testid = 'levelup-modal';

    const panel = document.createElement('div');
    panel.className = 'modal-panel';
    panel.innerHTML = `
      <h2 class="modal-title">Ascensão de Éter</h2>
      <p class="modal-subtitle">Escolha uma dádiva sagrada (Teclas 1–${choices.length} ou toque)</p>
    `;

    const list = document.createElement('div');
    list.className = `upgrade-list ${choices.length === 2 ? 'two-choices' : ''}`;

    const selectChoice = (choice: UpgradeChoice) => {
      this.clearKeyPickHandler();
      backdrop.remove();
      onPick(choice);
    };

    choices.forEach((c, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `upgrade-card ${c.kind === 'ultimate' ? 'ultimate-card' : ''}`;
      card.dataset.testid = `upgrade-option-${idx}`;

      const tileTierCls = c.kind === 'ultimate' ? 'ultimate-tile' : c.kind === 'evolution' ? 'evolved-tile' : '';
      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px">
          <div class="power-icon-tile ${tileTierCls}" style="width:46px; height:46px; margin:0; flex-shrink:0; pointer-events:none">
            <img class="power-icon-img" src="${c.iconUrl}" alt="${c.title}" />
          </div>
          <div>
            <span class="upgrade-badge" style="color:${c.accentColor}; margin-bottom:2px">[${idx + 1}] ${c.subtitle}</span>
            <h3 class="upgrade-name" style="margin:0">${c.title}</h3>
          </div>
        </div>
        <p class="upgrade-desc">${c.description}</p>
        ${c.synergyHint ? `<div class="upgrade-synergy">${c.synergyHint}</div>` : ''}
      `;
      card.addEventListener('click', () => selectChoice(c));
      list.appendChild(card);
    });

    this.keyPickHandler = (ev: KeyboardEvent) => {
      const n = Number(ev.key);
      if (n >= 1 && n <= choices.length) {
        selectChoice(choices[n - 1]);
      }
    };
    window.addEventListener('keydown', this.keyPickHandler);

    panel.appendChild(list);
    backdrop.appendChild(panel);
    this.modalHostEl.replaceChildren(backdrop);
  }

  private showRelicChestModal(reward: UpgradeChoice, onClose: () => void): void {
    if (!this.modalHostEl) return;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.testid = 'chest-modal';

    backdrop.innerHTML = `
      <div class="modal-panel" style="max-width:440px">
        <h2 class="modal-title">Relicário Dourado Aberto</h2>
        <p class="modal-subtitle">${reward.subtitle}</p>
        <div class="upgrade-card" style="cursor:default; margin-bottom:14px; text-align:center">
          <div class="power-icon-tile ${reward.kind === 'ultimate' ? 'ultimate-tile' : reward.kind === 'evolution' ? 'evolved-tile' : ''} selected" style="width:78px; height:78px; margin:0 auto 10px; pointer-events:none">
            <img class="power-icon-img" src="${reward.iconUrl}" alt="${reward.title}" />
          </div>
          <h3 class="upgrade-name" style="font-size:1.2rem">${reward.title}</h3>
          <p class="upgrade-desc">${reward.description}</p>
        </div>
        <button type="button" class="btn-gothic" data-claim-chest>Reivindicar Poder</button>
      </div>
    `;

    backdrop.querySelector('[data-claim-chest]')?.addEventListener('click', () => {
      backdrop.remove();
      onClose();
    });
    this.modalHostEl.replaceChildren(backdrop);
  }

  private handlePauseModal(paused: boolean): void {
    if (!this.modalHostEl) return;
    if (!paused) {
      this.modalHostEl.replaceChildren();
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.testid = 'pause-modal';
    backdrop.innerHTML = `
      <div class="modal-panel" style="max-width:400px">
        <h2 class="modal-title">Vigília Suspensa</h2>
        <p class="modal-subtitle">A Névoa Rubra aguarda no escuro.</p>
        <div style="display:flex; flex-direction:column; gap:10px">
          <button type="button" class="btn-gothic" data-resume-btn>Retomar Vigília</button>
          <button type="button" class="btn-gothic secondary" data-testid="pause-save-run-btn">💾 Salvar Vigília Agora</button>
          <button type="button" class="btn-gothic secondary" data-fs-pause-btn>⛶ Alternar Tela Cheia (Deitada)</button>
          <button type="button" class="btn-gothic secondary" data-quit-btn>Sair e retornar ao menu</button>
        </div>
        <div data-testid="pause-save-status" style="font-size:0.76rem; color:#7be0ad; margin-top:8px; min-height:1.1em"></div>
      </div>
    `;

    backdrop.querySelector('[data-resume-btn]')?.addEventListener('click', () => {
      backdrop.remove();
      this.onResumeFromPause();
    });
    backdrop.querySelector('[data-testid="pause-save-run-btn"]')?.addEventListener('click', () => {
      const cp = this.onSaveActiveRun();
      this.saveRunCheckpoint(cp);
      gothicAudio.playHit();
      const statusEl = backdrop.querySelector('[data-testid="pause-save-status"]');
      if (statusEl) {
        statusEl.textContent = cp
          ? `✓ Vigília salva no Slot ${this.getActiveSaveSlot() + 1} (${formatClock(cp.elapsedSeconds)})!`
          : '✓ Progresso da conta salvo!';
      }
    });
    backdrop.querySelector('[data-fs-pause-btn]')?.addEventListener('click', () => {
      this.viewport.toggleFullscreenLandscape();
    });
    backdrop.querySelector('[data-quit-btn]')?.addEventListener('click', () => {
      const cp = this.onSaveActiveRun();
      if (cp) this.saveRunCheckpoint(cp);
      this.transitionWithCurtain(() => {
        this.onStopArena();
        this.renderTitleScreen();
      });
    });

    this.modalHostEl.replaceChildren(backdrop);
  }

  private showRunSummaryModal(summary: RunSummary): void {
    this.saveRunRecord(summary);
    if (!this.modalHostEl) return;

    const hero = HEROES[summary.heroId];
    const currentStageIdx = STAGES.findIndex((s) => s.id === summary.stageId);
    const currentStage = STAGES[currentStageIdx] ?? STAGES[0];
    const nextStage = STAGES[currentStageIdx + 1];

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.testid = 'summary-modal';

    backdrop.innerHTML = `
      <div class="modal-panel" style="max-width:500px">
        <h2 class="modal-title" style="color:${summary.victory ? '#ffe79e' : '#ff4d6d'}">
          ${summary.victory ? `FASE ${currentStage.roman} PURIFICADA!` : 'CONSUMIDO PELO ECLIPSE'}
        </h2>
        <p class="modal-subtitle">${hero.name} · ${currentStage.name} · ${DIFFICULTIES[summary.difficultyId].label}</p>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px; text-align:left">
          <div class="stat-pill">Tempo: <strong>${formatClock(summary.elapsedSeconds)} / 40:00</strong></div>
          <div class="stat-pill">Nível: <strong>${summary.level}</strong></div>
          <div class="stat-pill">Abates: <strong>${summary.kills}</strong></div>
          <div class="stat-pill">Almas: <strong>${summary.souls}</strong> · 🪙 Ouro: <strong style="color:#ffd166">+${(summary.gold ?? 0).toLocaleString('pt-BR')}</strong></div>
        </div>

        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap">
          ${
            summary.victory && nextStage
              ? `<button type="button" class="btn-gothic" data-next-stage-btn>Avançar: Fase ${nextStage.roman}</button>`
              : ''
          }
          <button type="button" class="btn-gothic ${summary.victory && nextStage ? 'secondary' : ''}" data-retry-btn>Repetir Fase</button>
          <button type="button" class="btn-gothic secondary" data-menu-btn>Sair e retornar ao menu</button>
        </div>
      </div>
    `;

    backdrop.querySelector('[data-next-stage-btn]')?.addEventListener('click', () => {
      if (nextStage) {
        this.selectedStage = nextStage.id;
        this.beginArenaRun();
      }
    });
    backdrop.querySelector('[data-retry-btn]')?.addEventListener('click', () => this.beginArenaRun());
    backdrop.querySelector('[data-menu-btn]')?.addEventListener('click', () => {
      this.transitionWithCurtain(() => {
        this.onStopArena();
        this.renderTitleScreen();
      });
    });

    this.modalHostEl.replaceChildren(backdrop);
  }

  private showStage30MinClearedModal(
    summary: RunSummary,
    onContinueTo40: () => void,
    onFinishStageNow: () => void
  ): void {
    this.saveRunRecord({ ...summary, victory: true });
    if (!this.modalHostEl) return;

    const hero = HEROES[summary.heroId];
    const currentStage = STAGES.find((s) => s.id === summary.stageId) ?? STAGES[0];
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.testid = 'stage-30min-modal';

    backdrop.innerHTML = `
      <div class="modal-panel" style="max-width:520px; border-color: rgba(255,215,130,0.6)">
        <h2 class="modal-title" style="color:#ffe79e">
          ✦ 2º CHEFÃO DOS 30 MINUTOS ABATIDO!
        </h2>
        <p class="modal-subtitle">
          A Fase ${currentStage.roman} (${currentStage.name}) já pode ser finalizada agora com Vitória, ou você pode enfrentar o Ato IV Supremo até os 40:00!
        </p>
        <p style="font-size:0.8rem; color:#cbbad8; margin:-4px 0 12px">
          ${hero.name} · ${DIFFICULTIES[summary.difficultyId].label} · +180 Almas conquistadas
        </p>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px; text-align:left">
          <div class="stat-pill">Tempo: <strong>${formatClock(summary.elapsedSeconds)} / 40:00</strong></div>
          <div class="stat-pill">Nível: <strong>${summary.level}</strong></div>
          <div class="stat-pill">Abates: <strong>${summary.kills}</strong></div>
          <div class="stat-pill">Almas: <strong>${summary.souls}</strong> · 🪙 Ouro: <strong style="color:#ffd166">+${(summary.gold ?? 0).toLocaleString('pt-BR')}</strong></div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px">
          <button type="button" class="btn-gothic" data-testid="continue-to-40-btn">
            ⚔ Continuar até 40:00 (Ato IV · Sobrevivência Suprema)
          </button>
          <button type="button" class="btn-gothic secondary" data-testid="finish-at-30-btn">
            👑 Finalizar de Vez a Fase (Vitória)
          </button>
        </div>
      </div>
    `;

    backdrop.querySelector('[data-testid="continue-to-40-btn"]')?.addEventListener('click', () => {
      backdrop.remove();
      onContinueTo40();
    });
    backdrop.querySelector('[data-testid="finish-at-30-btn"]')?.addEventListener('click', () => {
      backdrop.remove();
      onFinishStageNow();
    });

    this.modalHostEl.replaceChildren(backdrop);
  }

  private openSaveGameModal(statusMessage = ''): void {
    if (!this.menuModalHostEl) return;
    const activeSlot = this.getActiveSaveSlot();
    const rec = this.loadRecords(activeSlot);

    const slotsHtml = SAVE_SLOTS.map((slot) => {
      const data = this.loadRecords(slot);
      const isSelected = slot === activeSlot;
      const runInfo = data.activeRun
        ? `${HEROES[data.activeRun.heroId]?.name ?? 'Herói'} · ${formatClock(data.activeRun.elapsedSeconds)}`
        : 'Nenhuma vigília ativa';
      const dateStr = data.lastSavedAt
        ? new Date(data.lastSavedAt).toLocaleString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
          })
        : 'Ainda não salvo';
      return `
        <button type="button" class="save-slot-card ${isSelected ? 'selected' : ''}" data-testid="save-slot-${slot}">
          <div class="save-slot-top">
            <strong>Slot ${slot + 1} ${isSelected ? '✦ ATIVO' : ''}</strong>
            <span>${dateStr}</span>
          </div>
          <div class="save-slot-stats">
            <span>🪙 Ouro: <strong style="color:#ffd166">${(data.totalGold ?? 0).toLocaleString('pt-BR')}</strong></span>
            <span>✦ Almas: <strong>${data.totalSouls}</strong></span>
            <span>⚔ Armas: <strong>${data.unlockedWeapons.length}/9</strong></span>
            <span>🏪 Excl: <strong>${(data.purchasedExclusiveWeapons ?? []).length}/10</strong></span>
          </div>
          <div class="save-slot-run">Vigília: ${runInfo}</div>
        </button>
      `;
    }).join('');

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.testid = 'save-game-modal';
    backdrop.innerHTML = `
      <div class="modal-panel" style="max-width:600px; text-align:left">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:6px">
          <h2 class="modal-title" style="margin:0">💾 Sistema de Save Game</h2>
          <button type="button" class="btn-gothic secondary" data-close-save-modal style="padding:6px 12px">✖ Fechar</button>
        </div>
        <p class="modal-subtitle" style="margin-bottom:10px">
          Gerencie seus 3 slots de progresso, salve manualmente, exporte ou importe seu arquivo JSON.
        </p>

        <div class="save-slots-grid">${slotsHtml}</div>

        <div style="display:flex; flex-wrap:wrap; gap:8px; margin:12px 0">
          <button type="button" class="btn-gothic" data-testid="manual-save-btn">💾 Salvar Progresso Agora</button>
          <button type="button" class="btn-gothic secondary" data-testid="export-save-btn">⬇ Exportar Save (JSON)</button>
          <button type="button" class="btn-gothic secondary" data-testid="import-save-btn">⬆ Importar Save (JSON)</button>
        </div>

        <div data-testid="save-status-msg" style="font-size:0.78rem; color:#7be0ad; min-height:1.2em; margin-bottom:6px">${statusMessage}</div>

        <textarea class="save-json-textarea" data-testid="save-json-textarea" rows="5" spellcheck="false">${JSON.stringify(rec, null, 2)}</textarea>
      </div>
    `;

    SAVE_SLOTS.forEach((slot) => {
      backdrop.querySelector(`[data-testid="save-slot-${slot}"]`)?.addEventListener('click', () => {
        gothicAudio.playHit();
        this.setActiveSaveSlot(slot);
        this.renderMenu();
        this.openSaveGameModal(`✓ Slot ${slot + 1} carregado.`);
      });
    });

    backdrop.querySelector('[data-testid="manual-save-btn"]')?.addEventListener('click', () => {
      const cur = this.loadRecords(this.getActiveSaveSlot());
      this.saveRecords(cur);
      gothicAudio.playLevelUp();
      this.renderMenu();
      this.openSaveGameModal(`✓ Jogo salvo no Slot ${this.getActiveSaveSlot() + 1}!`);
    });

    backdrop.querySelector('[data-testid="export-save-btn"]')?.addEventListener('click', () => {
      const json = this.exportActiveSlotJson();
      const area = backdrop.querySelector('[data-testid="save-json-textarea"]') as HTMLTextAreaElement | null;
      if (area) area.value = json;
      const statusEl = backdrop.querySelector('[data-testid="save-status-msg"]');
      if (statusEl) statusEl.textContent = '✓ Save exportado em JSON no quadro abaixo!';
      try {
        void navigator.clipboard?.writeText(json);
      } catch {
        // Ignore clipboard errors in headless environments
      }
    });

    backdrop.querySelector('[data-testid="import-save-btn"]')?.addEventListener('click', () => {
      const area = backdrop.querySelector('[data-testid="save-json-textarea"]') as HTMLTextAreaElement | null;
      const res = this.importActiveSlotJson(area?.value ?? '');
      if (res.ok) {
        gothicAudio.playLevelUp();
        this.renderMenu();
        this.openSaveGameModal(`✓ Save importado com sucesso para o Slot ${this.getActiveSaveSlot() + 1}!`);
      } else {
        const statusEl = backdrop.querySelector('[data-testid="save-status-msg"]');
        if (statusEl) {
          statusEl.textContent = `⚠ ${res.error ?? 'JSON inválido.'}`;
          (statusEl as HTMLElement).style.color = '#ff8fa3';
        }
      }
    });

    backdrop.querySelector('[data-close-save-modal]')?.addEventListener('click', () => {
      backdrop.remove();
    });

    this.menuModalHostEl.replaceChildren(backdrop);
  }
}
