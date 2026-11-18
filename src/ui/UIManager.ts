import { gothicAudio } from '../audio/GothicAudio';
import { gothicSoundtrack } from '../audio/GothicSoundtrack';
import {
  ENEMIES,
  getRelicIconUrl,
  getWeaponIconUrl,
  HEROES,
  HeroId,
  LORE_CHAPTERS,
  RELICS,
  RelicId,
  StageId,
  STAGES,
  WEAPONS,
  WeaponId,
} from '../data/loreData';
import { ALL_BASE_WEAPONS, UpgradeChoice } from '../game/UpgradeLogic';
import { ArenaCallbacks, HudSnapshot, RunSummary } from '../scenes/ArenaScene';
import { ViewportManager } from './ViewportManager';

const RECORDS_STORAGE_KEY = 'crimson_vesper.records.v2';

interface SavedRecords {
  bestSeconds: number;
  bestKills: number;
  totalSouls: number;
  victories: number;
  clearedStages: StageId[];
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
  private inspectedPower: InspectedPower = { kind: 'weapon', id: 'whip' };
  private selectedLoreIndex = 0;

  private onStartRun: (heroId: HeroId, stageId: StageId, callbacks: ArenaCallbacks) => void;
  private onSetVirtualJoystick: (dx: number, dy: number) => void;
  private onTriggerDash: () => void;
  private onTogglePause: () => void;
  private onResumeFromPause: () => void;
  private onStopArena: () => void;

  // Live HUD Elements
  private hudRoot: HTMLElement | null = null;
  private xpFillEl: HTMLElement | null = null;
  private xpLevelEl: HTMLElement | null = null;
  private weaponRowEl: HTMLElement | null = null;
  private relicRowEl: HTMLElement | null = null;
  private clockTimeEl: HTMLElement | null = null;
  private clockPhaseEl: HTMLElement | null = null;
  private killsEl: HTMLElement | null = null;
  private soulsEl: HTMLElement | null = null;
  private dashBtnEl: HTMLButtonElement | null = null;
  private bannerEl: HTMLElement | null = null;
  private bannerTitleEl: HTMLElement | null = null;
  private bannerSubEl: HTMLElement | null = null;
  private bossWrapEl: HTMLElement | null = null;
  private bossNameEl: HTMLElement | null = null;
  private bossFillEl: HTMLElement | null = null;
  private modalHostEl: HTMLElement | null = null;
  private bannerTimeout: number | null = null;
  private keyPickHandler: ((ev: KeyboardEvent) => void) | null = null;

  constructor(
    root: HTMLElement,
    viewport: ViewportManager,
    hooks: {
      onStartRun: (heroId: HeroId, stageId: StageId, callbacks: ArenaCallbacks) => void;
      onSetVirtualJoystick: (dx: number, dy: number) => void;
      onTriggerDash: () => void;
      onTogglePause: () => void;
      onResumeFromPause: () => void;
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
    this.onStopArena = hooks.onStopArena;

    this.curtain = document.createElement('div');
    this.curtain.className = 'eclipse-curtain';
    document.getElementById('game-root')?.appendChild(this.curtain);

    this.renderMenu();
  }

  private loadRecords(): SavedRecords {
    try {
      const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedRecords>;
        return {
          bestSeconds: Number(parsed.bestSeconds) || 0,
          bestKills: Number(parsed.bestKills) || 0,
          totalSouls: Number(parsed.totalSouls) || 0,
          victories: Number(parsed.victories) || 0,
          clearedStages: Array.isArray(parsed.clearedStages) ? parsed.clearedStages : [],
        };
      }
    } catch {
      // ignore
    }
    return { bestSeconds: 0, bestKills: 0, totalSouls: 0, victories: 0, clearedStages: [] };
  }

  private saveRunRecord(summary: RunSummary): void {
    const rec = this.loadRecords();
    rec.bestSeconds = Math.max(rec.bestSeconds, Math.floor(summary.elapsedSeconds));
    rec.bestKills = Math.max(rec.bestKills, summary.kills);
    rec.totalSouls += summary.souls;
    if (summary.victory) {
      rec.victories += 1;
      if (!rec.clearedStages.includes(summary.stageId)) {
        rec.clearedStages.push(summary.stageId);
      }
    }
    try {
      localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(rec));
    } catch {
      // ignore
    }
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

    // Top Game Chrome Bar (Fullscreen Landscape + Music + SFX)
    const topBar = document.createElement('div');
    topBar.className = 'menu-top-bar';

    const leftTag = document.createElement('div');
    leftTag.className = 'game-crest-tag';
    leftTag.textContent = '❖ Vespera · Vigília de 40 Minutos';

    const rightUtils = document.createElement('div');
    rightUtils.className = 'top-utility-btns';

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

    rightUtils.append(fsBtn, bgmBtn, muteBtn);
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
    arsenalBtn.textContent = '✦ Grade de Poderes';
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
      <span>☠ Recorde de Abates: <strong>${rec.bestKills}</strong></span>
      <span>✦ Almas Colhidas: <strong>${rec.totalSouls}</strong></span>
      <span>⏱ Melhor Tempo: <strong>${formatClock(rec.bestSeconds)}</strong></span>
    `;
    menu.appendChild(status);
  }

  private buildHeroSelectScreen(menu: HTMLElement): void {
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

    header.append(backBtn, title, document.createElement('div'));
    shell.appendChild(header);

    const body = document.createElement('div');
    body.className = 'subscreen-body';

    const roster = document.createElement('div');
    roster.className = 'roster-list';
    const heroIds: HeroId[] = ['alaric', 'seraphina', 'kaelen', 'valeria'];

    for (const hId of heroIds) {
      const h = HEROES[hId];
      const w = WEAPONS[h.startingWeapon];
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.dataset.testid = `hero-card-${hId}`;
      slot.className = `roster-slot ${this.selectedHero === hId ? 'selected' : ''}`;
      slot.innerHTML = `
        <img class="roster-thumb" src="${h.portraitUrl}" alt="${h.name}" />
        <div>
          <div class="roster-slot-name">${h.name}</div>
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
    const s = hero.baseStats;

    const hpPct = Math.min(100, Math.round((s.maxHp / 150) * 100));
    const dmgPct = Math.min(100, Math.round((s.might / 1.3) * 100));
    const spdPct = Math.min(100, Math.round((s.moveSpeed / 205) * 100));
    const critPct = Math.min(100, Math.round((s.critChance / 0.25) * 100));

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
            <div class="stat-bar-label"><span>VITALIDADE</span><span>${s.maxHp} PV</span></div>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${hpPct}%"></div></div>
          </div>
          <div class="stat-bar-item">
            <div class="stat-bar-label"><span>PODER DE DANO</span><span>${Math.round(s.might * 100)}%</span></div>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${dmgPct}%"></div></div>
          </div>
          <div class="stat-bar-item">
            <div class="stat-bar-label"><span>VELOCIDADE</span><span>${s.moveSpeed}</span></div>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${spdPct}%"></div></div>
          </div>
          <div class="stat-bar-item">
            <div class="stat-bar-label"><span>CHANCE CRÍTICA</span><span>${Math.round(s.critChance * 100)}%</span></div>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${critPct}%"></div></div>
          </div>
        </div>

        <p style="font-family:var(--font-lore); font-size:0.98rem; color:#dfd3dd; margin:6px 0 0">
          ${hero.lore} <em style="color:#f5c2cf">${hero.quote}</em>
        </p>
      </div>

      <div class="showcase-footer">
        <span style="font-size:0.75rem; color:var(--text-muted)">6 Slots de Armas Evoluíveis · Passo Espectral [Espaço]</span>
        <button type="button" class="btn-gothic" data-testid="go-stage-select-btn">Escolher Região ➔</button>
      </div>
    `;

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
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.dataset.testid = `stage-card-${st.id}`;
      slot.className = `roster-slot ${this.selectedStage === st.id ? 'selected' : ''}`;
      slot.innerHTML = `
        <img class="roster-thumb" src="${st.bannerUrl}" alt="${st.name}" />
        <div style="flex:1">
          <div class="roster-slot-name">Fase ${st.roman} · ${st.name}</div>
          <div class="roster-slot-sub">${st.threatLabel} ${cleared ? '· 👑 Purificada' : ''}</div>
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
        <div style="font-size:0.75rem; color:#ffe79e">
          ✦ Escalada em 4 Atos de 10 min (00:00 · 10:00 · 20:00 · 30:00) + 11 Relicários para evoluir todas as 6 armas!
        </div>
      </div>

      <div class="showcase-footer">
        <span style="font-size:0.75rem; color:var(--text-muted)">
          Partida Completa: <strong>${formatClock(st.durationSeconds)}</strong>
        </span>
        <button type="button" class="btn-gothic" data-testid="start-run-btn">⚔ Iniciar Vigília</button>
      </div>
    `;

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
    title.textContent = 'Grade de Poderes & Matriz de Evoluções (27)';
    header.append(backBtn, title, document.createElement('div'));
    shell.appendChild(header);

    const body = document.createElement('div');
    body.className = 'subscreen-body';

    // Left: 9-Row Visual Synergy Matrix (Arma Base + Relíquia Catalisadora -> Evolução Ancestral!)
    const matrix = document.createElement('div');
    matrix.className = 'synergy-matrix';

    for (const baseId of ALL_BASE_WEAPONS) {
      const baseW = WEAPONS[baseId];
      const catId = baseW.catalystRelic!;
      const catR = RELICS[catId];
      const evoId = baseW.evolvesInto!;
      const evoW = WEAPONS[evoId];

      const row = document.createElement('div');
      row.className = 'synergy-row';

      const makeTile = (
        target: InspectedPower,
        iconUrl: string,
        label: string,
        isEvolved = false
      ) => {
        const isSel =
          this.inspectedPower.kind === target.kind && this.inspectedPower.id === target.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `power-icon-tile ${isEvolved ? 'evolved-tile' : ''} ${isSel ? 'selected' : ''}`;
        btn.title = label;
        btn.innerHTML = `
          <img class="power-icon-img" src="${iconUrl}" alt="${label}" />
          ${isEvolved ? '<span class="evo-star-corner">★</span>' : ''}
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

      const arrow = document.createElement('span');
      arrow.className = 'synergy-op';
      arrow.textContent = '➔';

      row.append(
        makeTile({ kind: 'weapon', id: baseId }, getWeaponIconUrl(baseId), baseW.name),
        plus,
        makeTile({ kind: 'relic', id: catId }, getRelicIconUrl(catId), catR.name),
        arrow,
        makeTile({ kind: 'weapon', id: evoId }, getWeaponIconUrl(evoId), evoW.name, true)
      );
      matrix.appendChild(row);
    }

    // Right: Rich Power Inspector Card
    const inspector = document.createElement('div');
    inspector.className = 'showcase-panel codex-card';

    if (this.inspectedPower.kind === 'weapon') {
      const w = WEAPONS[this.inspectedPower.id];
      const cat = w.catalystRelic ? RELICS[w.catalystRelic] : null;
      const evo = w.evolvesInto ? WEAPONS[w.evolvesInto] : null;
      const fromBase = w.evolvesFrom ? WEAPONS[w.evolvesFrom] : null;
      const fromCat = fromBase?.catalystRelic ? RELICS[fromBase.catalystRelic] : null;

      const levelsHtml = w.descriptions
        .map(
          (d, idx) =>
            `<div style="font-size:0.78rem; padding:3px 0; color:#e2d7e0"><strong>${w.isEvolved ? 'Poder Supremo' : `Grau ${idx + 1}`}:</strong> ${d}</div>`
        )
        .join('');

      inspector.innerHTML = `
        <div>
          <div style="display:flex; align-items:center; gap:14px; margin-bottom:10px">
            <div class="power-icon-tile ${w.isEvolved ? 'evolved-tile' : ''} selected" style="width:72px; height:72px; margin:0; cursor:default">
              <img class="power-icon-img" src="${getWeaponIconUrl(w.id)}" alt="${w.name}" />
            </div>
            <div>
              <div style="font-size:0.72rem; color:${w.isEvolved ? '#ff8fa3' : '#98f5cb'}; text-transform:uppercase; font-weight:700">${w.category}</div>
              <h3 style="font-family:var(--font-display); font-size:1.4rem; color:var(--gold-bright); margin:2px 0">${w.name}</h3>
              <div style="font-size:0.76rem; color:var(--text-muted)">${w.mechanicSummary}</div>
            </div>
          </div>

          <p style="font-size:0.9rem; color:var(--text-ivory); margin:8px 0">${w.tagline}</p>
          <div style="margin:8px 0">${levelsHtml}</div>

          ${
            cat && evo
              ? `<div class="evo-recipe-box">
                  <span><img class="mini-icon-inline" src="${getWeaponIconUrl(w.id)}" alt="" /> <strong>${w.name} (Nv.5)</strong></span>
                  <span>+</span>
                  <span><img class="mini-icon-inline" src="${getRelicIconUrl(cat.id)}" alt="" /> <strong>${cat.name}</strong></span>
                  <span>➔</span>
                  <span><img class="mini-icon-inline" src="${getWeaponIconUrl(evo.id)}" alt="" /> <strong style="color:#ffe79e">★ ${evo.name}</strong></span>
                </div>`
              : fromBase && fromCat
                ? `<div class="evo-recipe-box">
                    <span>Desperta ao unir <img class="mini-icon-inline" src="${getWeaponIconUrl(fromBase.id)}" alt="" /> <strong>${fromBase.name} (Nv.5)</strong> + <img class="mini-icon-inline" src="${getRelicIconUrl(fromCat.id)}" alt="" /> <strong>${fromCat.name}</strong> em um Relicário Dourado.</span>
                  </div>`
                : ''
          }
        </div>
      `;
    } else {
      const r = RELICS[this.inspectedPower.id];
      const synW = WEAPONS[r.synergyWeapon];
      const evo = synW.evolvesInto ? WEAPONS[synW.evolvesInto] : null;
      inspector.innerHTML = `
        <div>
          <div style="display:flex; align-items:center; gap:14px; margin-bottom:10px">
            <div class="power-icon-tile selected" style="width:72px; height:72px; margin:0; cursor:default">
              <img class="power-icon-img" src="${getRelicIconUrl(r.id)}" alt="${r.name}" />
            </div>
            <div>
              <div style="font-size:0.72rem; color:#ffd166; text-transform:uppercase; font-weight:700">Relíquia Passiva · Máximo Grau ${r.maxLevel}</div>
              <h3 style="font-family:var(--font-display); font-size:1.4rem; color:var(--gold-bright); margin:2px 0">${r.name}</h3>
              <div style="font-size:0.76rem; color:var(--text-muted)">${r.tagline}</div>
            </div>
          </div>

          <p style="font-size:0.92rem; color:var(--text-ivory); margin:12px 0">${r.bonusPerLevel}</p>

          ${
            evo
              ? `<div class="evo-recipe-box">
                  <span>Catalisa <img class="mini-icon-inline" src="${getWeaponIconUrl(synW.id)}" alt="" /> <strong>${synW.name} (Nv.5)</strong></span>
                  <span>➔</span>
                  <span><img class="mini-icon-inline" src="${getWeaponIconUrl(evo.id)}" alt="" /> <strong style="color:#ffe79e">★ ${evo.name}</strong></span>
                </div>`
              : ''
          }
        </div>
      `;
    }

    body.append(matrix, inspector);
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

  private beginArenaRun(): void {
    this.transitionWithCurtain(() => {
      this.mountHudDom();
      this.onStartRun(this.selectedHero, this.selectedStage, {
        onHudUpdate: (snap) => this.updateHud(snap),
        onLevelUpChoices: (choices, onPick) => this.showLevelUpModal(choices, onPick),
        onRelicChestOpen: (reward, onClose) => this.showRelicChestModal(reward, onClose),
        onBannerAnnouncement: (title, sub) => this.showBanner(title, sub),
        onPauseChanged: (paused) => this.handlePauseModal(paused),
        onRunEnded: (summary) => this.showRunSummaryModal(summary),
      });
    });
  }

  private mountHudDom(): void {
    this.lastRenderedScreen = null;
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
        </div>

        <div class="stats-right">
          <div class="stat-pill">☠ <strong data-kills>0</strong></div>
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

      <button type="button" class="dash-btn" data-dash-btn title="Passo Espectral (Espaço)">
        PASSO<br/>ESPECTRAL
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
    this.killsEl = hud.querySelector('[data-kills]');
    this.soulsEl = hud.querySelector('[data-souls]');
    this.dashBtnEl = hud.querySelector('[data-dash-btn]');
    this.bannerEl = hud.querySelector('[data-banner]');
    this.bannerTitleEl = hud.querySelector('[data-banner-title]');
    this.bannerSubEl = hud.querySelector('[data-banner-sub]');
    this.bossWrapEl = hud.querySelector('[data-boss-wrap]');
    this.bossNameEl = hud.querySelector('[data-boss-name]');
    this.bossFillEl = hud.querySelector('[data-boss-fill]');
    this.modalHostEl = hud.querySelector('[data-modal-host]');

    hud.querySelector('[data-hud-fs]')?.addEventListener('click', () => {
      this.viewport.toggleFullscreenLandscape();
    });

    const bgmBtn = hud.querySelector('[data-hud-bgm]') as HTMLButtonElement;
    bgmBtn.addEventListener('click', () => {
      const m = gothicSoundtrack.toggleMute();
      bgmBtn.textContent = m ? '🎵✕' : '🎵';
    });

    const muteBtn = hud.querySelector('[data-mute-btn]') as HTMLButtonElement;
    muteBtn.addEventListener('click', () => {
      const m = gothicAudio.toggleMute();
      muteBtn.textContent = m ? '🔇' : '🔊';
    });

    hud.querySelector('[data-pause-btn]')?.addEventListener('click', () => this.onTogglePause());
    this.dashBtnEl?.addEventListener('click', () => this.onTriggerDash());

    this.setupDynamicFloatingJoystick(
      hud.querySelector('[data-touch-surface]') as HTMLElement,
      hud.querySelector('[data-floating-joy]') as HTMLElement,
      hud.querySelector('[data-floating-knob]') as HTMLElement
    );

    this.root.replaceChildren(hud);
  }

  private setupDynamicFloatingJoystick(
    surface: HTMLElement,
    ring: HTMLElement,
    knob: HTMLElement
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
      if (activePointerId !== null) return;
      activePointerId = ev.pointerId;
      const pt = this.viewport.mapClientToLogical(ev.clientX, ev.clientY);
      originX = pt.x;
      originY = pt.y;
      ring.style.left = `${originX}px`;
      ring.style.top = `${originY}px`;
      ring.classList.add('active');
      surface.setPointerCapture(ev.pointerId);
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
    if (this.xpFillEl) this.xpFillEl.style.width = `${xpPct}%`;
    if (this.xpLevelEl) this.xpLevelEl.textContent = `NV ${snap.level}`;
    if (this.clockTimeEl) {
      this.clockTimeEl.textContent = `${formatClock(snap.elapsedSeconds)} / 40:00`;
    }
    if (this.clockPhaseEl) {
      this.clockPhaseEl.textContent = `Fase ${snap.stageRoman} · ${snap.actName}`;
    }
    if (this.killsEl) this.killsEl.textContent = `${snap.kills}`;
    if (this.soulsEl) this.soulsEl.textContent = `${snap.souls}`;

    if (this.dashBtnEl) {
      this.dashBtnEl.style.opacity = snap.dashReadyRatio >= 1 ? '1' : '0.45';
    }

    // Redesigned Illustrated HUD Power Rack (6 Weapons + 6 Relics)
    if (this.weaponRowEl) {
      const entries = Object.entries(snap.inventory.weapons) as Array<[WeaponId, number]>;
      let html = '';
      for (let i = 0; i < 6; i++) {
        const entry = entries[i];
        if (entry) {
          const [wId, lv] = entry;
          const def = WEAPONS[wId];
          const readyEvo =
            !def.isEvolved &&
            lv >= def.maxLevel &&
            Boolean(def.catalystRelic && (snap.inventory.relics[def.catalystRelic] ?? 0) > 0);
          const stateCls = def.isEvolved ? 'evolved' : readyEvo ? 'ready-evolve' : '';
          html += `
            <div class="item-slot ${stateCls}" title="${def.name}">
              <img class="slot-icon-img" src="${getWeaponIconUrl(wId)}" alt="${def.name}" />
              ${def.isEvolved ? '<span class="slot-evo-badge">★</span>' : renderLevelPips(lv, def.maxLevel)}
            </div>
          `;
        } else {
          html += `<div class="item-slot empty"></div>`;
        }
      }
      this.weaponRowEl.innerHTML = html;
    }

    if (this.relicRowEl) {
      const entries = Object.entries(snap.inventory.relics) as Array<[RelicId, number]>;
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

    if (this.bossWrapEl && this.bossNameEl && this.bossFillEl) {
      if (snap.boss) {
        this.bossWrapEl.style.display = 'block';
        this.bossNameEl.textContent = `✦ ${snap.boss.name} ✦`;
        const pct = Math.max(0, Math.min(100, (snap.boss.hp / snap.boss.maxHp) * 100));
        this.bossFillEl.style.width = `${pct}%`;
      } else {
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
    list.className = 'upgrade-list';

    const selectChoice = (choice: UpgradeChoice) => {
      this.clearKeyPickHandler();
      backdrop.remove();
      onPick(choice);
    };

    choices.forEach((c, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'upgrade-card';
      card.dataset.testid = `upgrade-option-${idx}`;

      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px">
          <div class="power-icon-tile" style="width:46px; height:46px; margin:0; flex-shrink:0; pointer-events:none">
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
          <div class="power-icon-tile ${reward.kind === 'evolution' ? 'evolved-tile' : ''} selected" style="width:78px; height:78px; margin:0 auto 10px; pointer-events:none">
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
      <div class="modal-panel" style="max-width:380px">
        <h2 class="modal-title">Vigília Suspensa</h2>
        <p class="modal-subtitle">A Névoa Rubra aguarda no escuro.</p>
        <div style="display:flex; flex-direction:column; gap:10px">
          <button type="button" class="btn-gothic" data-resume-btn>Retomar Vigília</button>
          <button type="button" class="btn-gothic secondary" data-fs-pause-btn>⛶ Alternar Tela Cheia (Deitada)</button>
          <button type="button" class="btn-gothic secondary" data-quit-btn>Sair e retornar ao menu</button>
        </div>
      </div>
    `;

    backdrop.querySelector('[data-resume-btn]')?.addEventListener('click', () => {
      backdrop.remove();
      this.onResumeFromPause();
    });
    backdrop.querySelector('[data-fs-pause-btn]')?.addEventListener('click', () => {
      this.viewport.toggleFullscreenLandscape();
    });
    backdrop.querySelector('[data-quit-btn]')?.addEventListener('click', () => {
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
        <p class="modal-subtitle">${hero.name} · ${currentStage.name}</p>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px; text-align:left">
          <div class="stat-pill">Tempo: <strong>${formatClock(summary.elapsedSeconds)} / 40:00</strong></div>
          <div class="stat-pill">Nível: <strong>${summary.level}</strong></div>
          <div class="stat-pill">Abates: <strong>${summary.kills}</strong></div>
          <div class="stat-pill">Almas: <strong>${summary.souls}</strong></div>
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
}
