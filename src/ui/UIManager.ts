import { gothicAudio } from '../audio/GothicAudio';
import {
  ENEMIES,
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
import { ALL_BASE_WEAPONS, ALL_RELICS, UpgradeChoice } from '../game/UpgradeLogic';
import { ArenaCallbacks, HudSnapshot, RunSummary } from '../scenes/ArenaScene';

const RECORDS_STORAGE_KEY = 'crimson_vesper.records.v2';

interface SavedRecords {
  bestSeconds: number;
  bestKills: number;
  totalSouls: number;
  victories: number;
  clearedStages: StageId[];
}

type HubTab = 'play' | 'powers' | 'lore';

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export class UIManager {
  private readonly root: HTMLElement;
  private readonly curtain: HTMLElement;
  private selectedHero: HeroId = 'alaric';
  private selectedStage: StageId = 'forest';
  private activeTab: HubTab = 'play';

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
    this.onStartRun = hooks.onStartRun;
    this.onSetVirtualJoystick = hooks.onSetVirtualJoystick;
    this.onTriggerDash = hooks.onTriggerDash;
    this.onTogglePause = hooks.onTogglePause;
    this.onResumeFromPause = hooks.onResumeFromPause;
    this.onStopArena = hooks.onStopArena;

    this.curtain = document.createElement('div');
    this.curtain.className = 'eclipse-curtain';
    document.getElementById('game-root')?.appendChild(this.curtain);

    this.renderTitleScreen();
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
    }, 320);
  }

  renderTitleScreen(): void {
    this.clearKeyPickHandler();
    const rec = this.loadRecords();

    const screen = document.createElement('div');
    screen.className = 'title-screen';
    screen.dataset.testid = 'title-screen';

    const bgArt = document.createElement('div');
    bgArt.className = 'title-bg-art';
    bgArt.style.backgroundImage = "url('./art/intro-cover.jpg')";
    const bgVignette = document.createElement('div');
    bgVignette.className = 'title-bg-vignette';
    screen.append(bgArt, bgVignette);

    const scrollBody = document.createElement('div');
    scrollBody.className = 'title-scroll-body';

    const header = document.createElement('div');
    header.className = 'title-header';
    header.innerHTML = `
      <div class="title-kicker">Crônicas dos Juramentados da Cinza</div>
      <h1 class="title-main">VESPERA</h1>
      <p class="title-sub">Eclipse Carmesim</p>
    `;
    scrollBody.appendChild(header);

    // Navigation Tabs
    const tabs = document.createElement('div');
    tabs.className = 'hub-tabs';
    const tabDefs: Array<{ id: HubTab; label: string; testId: string }> = [
      { id: 'play', label: '⚔ Vigília & 7 Fases', testId: 'tab-play' },
      { id: 'powers', label: '✦ Lista de Poderes (27)', testId: 'tab-powers' },
      { id: 'lore', label: '📜 Grimório & Lore', testId: 'tab-lore' },
    ];
    for (const t of tabDefs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.testid = t.testId;
      btn.className = `hub-tab-btn ${this.activeTab === t.id ? 'active' : ''}`;
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        this.activeTab = t.id;
        this.renderTitleScreen();
      });
      tabs.appendChild(btn);
    }
    scrollBody.appendChild(tabs);

    const contentHost = document.createElement('div');
    contentHost.className = 'hub-section';

    if (this.activeTab === 'play') {
      this.populatePlayTab(contentHost, rec, () => this.updateFooterSummary(footerSummary));
    } else if (this.activeTab === 'powers') {
      this.populatePowersTab(contentHost);
    } else {
      this.populateLoreTab(contentHost);
    }

    scrollBody.appendChild(contentHost);
    screen.appendChild(scrollBody);

    // Sticky Footer Action Bar
    const footer = document.createElement('div');
    footer.className = 'title-footer-bar';

    const footerSummary = document.createElement('div');
    footerSummary.className = 'selection-summary';
    this.updateFooterSummary(footerSummary);

    const footerBtns = document.createElement('div');
    footerBtns.className = 'footer-buttons';

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'btn-gothic';
    startBtn.dataset.testid = 'start-run-btn';
    startBtn.textContent = 'Iniciar Vigília';
    startBtn.addEventListener('click', () => this.beginArenaRun());

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'btn-gothic secondary';
    muteBtn.textContent = gothicAudio.isMuted() ? '🔇 Mudo' : '🔊 Áudio';
    muteBtn.addEventListener('click', () => {
      const m = gothicAudio.toggleMute();
      muteBtn.textContent = m ? '🔇 Mudo' : '🔊 Áudio';
    });

    footerBtns.append(startBtn, muteBtn);
    footer.append(footerSummary, footerBtns);
    screen.appendChild(footer);

    this.root.replaceChildren(screen);
  }

  private updateFooterSummary(container: HTMLElement): void {
    const hero = HEROES[this.selectedHero];
    const stage = STAGES.find((s) => s.id === this.selectedStage) ?? STAGES[0];
    const rec = this.loadRecords();
    container.innerHTML = `
      <div class="selection-main">
        ${hero.name} · Fase ${stage.roman}: ${stage.name}
      </div>
      <div class="selection-sub">
        Regiões Purificadas: <strong>${rec.clearedStages.length}/7</strong> ·
        Recorde de Abates: <strong>${rec.bestKills}</strong> ·
        Almas: <strong>${rec.totalSouls}</strong>
      </div>
    `;
  }

  private populatePlayTab(
    host: HTMLElement,
    rec: SavedRecords,
    onSelectionChange: () => void
  ): void {
    const heroHeading = document.createElement('div');
    heroHeading.className = 'section-heading';
    heroHeading.textContent = '1. Escolha seu Juramentado da Cinza';
    host.appendChild(heroHeading);

    const heroGrid = document.createElement('div');
    heroGrid.className = 'hero-grid';
    const heroIds: HeroId[] = ['alaric', 'seraphina', 'kaelen', 'valeria'];

    for (const hId of heroIds) {
      const hero = HEROES[hId];
      const weapon = WEAPONS[hero.startingWeapon];
      const card = document.createElement('button');
      card.type = 'button';
      card.dataset.testid = `hero-card-${hId}`;
      card.className = `hero-card ${this.selectedHero === hId ? 'selected' : ''}`;

      card.innerHTML = `
        <div class="hero-card-top">
          <img class="hero-portrait" src="${hero.portraitUrl}" alt="${hero.name}" loading="eager" />
          <div>
            <h3 class="hero-name">${hero.name}</h3>
            <div class="hero-epithet">${hero.epithet}</div>
            <span class="hero-weapon-pill">${weapon.glyph} ${weapon.name}</span>
          </div>
        </div>
        <div class="hero-perk">${hero.perkSummary}</div>
        <p class="hero-lore">${hero.lore}</p>
      `;

      card.addEventListener('click', () => {
        this.selectedHero = hId;
        heroGrid.querySelectorAll('.hero-card').forEach((el) => el.classList.remove('selected'));
        card.classList.add('selected');
        onSelectionChange();
      });
      heroGrid.appendChild(card);
    }
    host.appendChild(heroGrid);

    const stageHeading = document.createElement('div');
    stageHeading.className = 'section-heading';
    stageHeading.textContent = '2. Escolha a Região da Peregrinação (7 Fases)';
    host.appendChild(stageHeading);

    const stageGrid = document.createElement('div');
    stageGrid.className = 'stage-grid';

    for (const st of STAGES) {
      const cleared = rec.clearedStages.includes(st.id);
      const bossName = ENEMIES[st.finalBoss].name;
      const card = document.createElement('button');
      card.type = 'button';
      card.dataset.testid = `stage-card-${st.id}`;
      card.className = `stage-card ${this.selectedStage === st.id ? 'selected' : ''}`;

      card.innerHTML = `
        <div class="stage-banner-wrap">
          <img class="stage-banner-img" src="${st.bannerUrl}" alt="${st.name}" loading="lazy" />
          <span class="stage-roman-badge">FASE ${st.roman}</span>
          ${cleared ? `<span class="stage-crown-badge">👑 Purificada</span>` : ''}
        </div>
        <div class="stage-card-body">
          <h4 class="stage-title">${st.name}</h4>
          <div class="stage-threat">${st.threatLabel} · Guardião: ${bossName}</div>
          <p class="stage-desc">${st.lore}</p>
        </div>
      `;

      card.addEventListener('click', () => {
        this.selectedStage = st.id;
        stageGrid.querySelectorAll('.stage-card').forEach((el) => el.classList.remove('selected'));
        card.classList.add('selected');
        onSelectionChange();
      });
      stageGrid.appendChild(card);
    }
    host.appendChild(stageGrid);
  }

  private populatePowersTab(host: HTMLElement): void {
    const h1 = document.createElement('div');
    h1.className = 'section-heading';
    h1.textContent = 'Armas Sagradas (9) & Suas Evoluções Ancestrais (9)';
    host.appendChild(h1);

    const weaponGrid = document.createElement('div');
    weaponGrid.className = 'codex-grid';

    for (const wId of ALL_BASE_WEAPONS) {
      const w = WEAPONS[wId];
      const cat = w.catalystRelic ? RELICS[w.catalystRelic] : null;
      const evo = w.evolvesInto ? WEAPONS[w.evolvesInto] : null;

      const card = document.createElement('div');
      card.className = 'codex-card';
      card.innerHTML = `
        <div class="codex-card-head">
          <h4 class="codex-title" style="color:${w.iconColor}">${w.glyph} ${w.name}</h4>
          <span class="codex-cat">${w.category}</span>
        </div>
        <p class="codex-desc">${w.tagline}</p>
        <p class="codex-desc" style="color:#b8a9b5; font-size:0.75rem">Como funciona: ${w.mechanicSummary}</p>
        ${
          evo && cat
            ? `<div class="codex-formula">
                <strong>Evolução (Baú no Nv.5):</strong> + ${cat.glyph} ${cat.name} ➔
                <span style="color:${evo.iconColor}">${evo.glyph} ${evo.name}</span>
                <div style="color:#d8ccd6; margin-top:2px">${evo.tagline}</div>
              </div>`
            : ''
        }
      `;
      weaponGrid.appendChild(card);
    }
    host.appendChild(weaponGrid);

    const h2 = document.createElement('div');
    h2.className = 'section-heading';
    h2.textContent = 'Relíquias Passivas & Catalisadores (9)';
    host.appendChild(h2);

    const relicGrid = document.createElement('div');
    relicGrid.className = 'codex-grid';

    for (const rId of ALL_RELICS) {
      const r = RELICS[rId];
      const synW = WEAPONS[r.synergyWeapon];
      const card = document.createElement('div');
      card.className = 'codex-card';
      card.innerHTML = `
        <div class="codex-card-head">
          <h4 class="codex-title" style="color:${r.iconColor}">${r.glyph} ${r.name}</h4>
          <span class="codex-cat">Máx Nv.${r.maxLevel}</span>
        </div>
        <p class="codex-desc">${r.bonusPerLevel}</p>
        <div class="codex-formula">Catalisador da arma: <strong>${synW.glyph} ${synW.name}</strong></div>
      `;
      relicGrid.appendChild(card);
    }
    host.appendChild(relicGrid);
  }

  private populateLoreTab(host: HTMLElement): void {
    const h1 = document.createElement('div');
    h1.className = 'section-heading';
    h1.textContent = 'O Mito do Eclipse Carmesim';
    host.appendChild(h1);

    const loreGrid = document.createElement('div');
    loreGrid.className = 'codex-grid';
    for (const ch of LORE_CHAPTERS) {
      const card = document.createElement('div');
      card.className = 'codex-card';
      card.innerHTML = `
        <h4 class="codex-title">${ch.title}</h4>
        <div style="font-size:0.74rem; color:#ff9ebb; margin-bottom:6px">${ch.subtitle}</div>
        <p class="codex-desc" style="font-family:var(--font-lore); font-size:0.98rem">${ch.body}</p>
      `;
      loreGrid.appendChild(card);
    }
    host.appendChild(loreGrid);

    const h2 = document.createElement('div');
    h2.className = 'section-heading';
    h2.textContent = 'Atlas das Sete Regiões Amaldiçoadas';
    host.appendChild(h2);

    const atlasGrid = document.createElement('div');
    atlasGrid.className = 'codex-grid';
    for (const st of STAGES) {
      const card = document.createElement('div');
      card.className = 'codex-card';
      card.innerHTML = `
        <h4 class="codex-title">Fase ${st.roman} · ${st.name}</h4>
        <div style="font-size:0.73rem; color:#ffd166; margin-bottom:5px">${st.subtitle}</div>
        <p class="codex-desc" style="font-family:var(--font-lore); font-size:0.96rem">${st.lore}</p>
      `;
      atlasGrid.appendChild(card);
    }
    host.appendChild(atlasGrid);
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
          <div class="clock-phase" data-clock-phase>Fase I</div>
        </div>

        <div class="stats-right">
          <div class="stat-pill">☠ <strong data-kills>0</strong></div>
          <div class="stat-pill">✦ <strong data-souls>0</strong></div>
          <button type="button" class="hud-icon-btn" data-mute-btn>${gothicAudio.isMuted() ? '🔇' : '🔊'}</button>
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
    const maxRadius = 42;

    const updateMove = (ev: PointerEvent) => {
      let dx = ev.clientX - originX;
      let dy = ev.clientY - originY;
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
      originX = ev.clientX;
      originY = ev.clientY;
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
    if (this.clockTimeEl) this.clockTimeEl.textContent = formatClock(snap.elapsedSeconds);
    if (this.clockPhaseEl) {
      this.clockPhaseEl.textContent = `Fase ${snap.stageRoman} · ${snap.stageName}`;
    }
    if (this.killsEl) this.killsEl.textContent = `${snap.kills}`;
    if (this.soulsEl) this.soulsEl.textContent = `${snap.souls}`;

    if (this.dashBtnEl) {
      this.dashBtnEl.style.opacity = snap.dashReadyRatio >= 1 ? '1' : '0.45';
    }

    if (this.weaponRowEl) {
      const entries = Object.entries(snap.inventory.weapons) as Array<[WeaponId, number]>;
      let html = '';
      for (let i = 0; i < 6; i++) {
        const entry = entries[i];
        if (entry) {
          const [wId, lv] = entry;
          const def = WEAPONS[wId];
          html += `
            <div class="item-slot ${def.isEvolved ? 'evolved' : ''}" title="${def.name}">
              <span style="color:${def.iconColor}">${def.glyph}</span>
              <span class="slot-lvl">${def.isEvolved ? '★' : `Nv${lv}`}</span>
            </div>
          `;
        } else {
          html += `<div class="item-slot" style="opacity:0.28"></div>`;
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
              <span style="color:${def.iconColor}">${def.glyph}</span>
              <span class="slot-lvl">Nv${lv}</span>
            </div>
          `;
        } else {
          html += `<div class="item-slot" style="opacity:0.22"></div>`;
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
    }, 3400);
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
      <p class="modal-subtitle">Escolha uma dádiva sagrada para fortalecer sua vigília</p>
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
      const glyph = c.weaponId
        ? WEAPONS[c.weaponId].glyph
        : c.relicId
          ? RELICS[c.relicId].glyph
          : '✦';

      card.innerHTML = `
        <span class="upgrade-badge" style="color:${c.accentColor}">[${idx + 1}] ${c.subtitle}</span>
        <h3 class="upgrade-name">${glyph} ${c.title}</h3>
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

    const glyph = reward.weaponId
      ? WEAPONS[reward.weaponId].glyph
      : reward.relicId
        ? RELICS[reward.relicId].glyph
        : '✦';

    backdrop.innerHTML = `
      <div class="modal-panel" style="max-width:460px">
        <h2 class="modal-title">Relicário Dourado Aberto</h2>
        <p class="modal-subtitle">${reward.subtitle}</p>
        <div class="upgrade-card" style="cursor:default; margin-bottom:18px; text-align:center">
          <div style="font-size:2.3rem; margin-bottom:6px">${glyph}</div>
          <h3 class="upgrade-name" style="font-size:1.25rem">${reward.title}</h3>
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
        <div style="display:flex; flex-direction:column; gap:12px">
          <button type="button" class="btn-gothic" data-resume-btn>Retomar Vigília</button>
          <button type="button" class="btn-gothic secondary" data-quit-btn>Sair e retornar ao menu</button>
        </div>
      </div>
    `;

    backdrop.querySelector('[data-resume-btn]')?.addEventListener('click', () => {
      backdrop.remove();
      this.onResumeFromPause();
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
      <div class="modal-panel" style="max-width:520px">
        <h2 class="modal-title" style="color:${summary.victory ? '#ffe599' : '#ff4d6d'}">
          ${summary.victory ? `FASE ${currentStage.roman} PURIFICADA!` : 'CONSUMIDO PELO ECLIPSE'}
        </h2>
        <p class="modal-subtitle">${hero.name} · ${currentStage.name}</p>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px; text-align:left">
          <div class="stat-pill">Tempo: <strong>${formatClock(summary.elapsedSeconds)}</strong></div>
          <div class="stat-pill">Nível: <strong>${summary.level}</strong></div>
          <div class="stat-pill">Abates: <strong>${summary.kills}</strong></div>
          <div class="stat-pill">Almas: <strong>${summary.souls}</strong></div>
        </div>

        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap">
          ${
            summary.victory && nextStage
              ? `<button type="button" class="btn-gothic" data-next-stage-btn>Avançar: Fase ${nextStage.roman} (${nextStage.name})</button>`
              : ''
          }
          <button type="button" class="btn-gothic ${summary.victory && nextStage ? 'secondary' : ''}" data-retry-btn>Repetir Fase</button>
          <button type="button" class="btn-gothic secondary" data-menu-btn>Mapa das 7 Fases</button>
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
