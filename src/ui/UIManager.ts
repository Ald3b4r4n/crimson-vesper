import { createHeroPortraitDataUrl } from '../art/SpriteForge';
import { gothicAudio } from '../audio/GothicAudio';
import {
  HEROES,
  HeroId,
  LORE_CHAPTERS,
  RELICS,
  RelicId,
  WEAPONS,
  WeaponId,
} from '../data/loreData';
import { UpgradeChoice } from '../game/UpgradeLogic';
import { ArenaCallbacks, HudSnapshot, RunSummary } from '../scenes/ArenaScene';

const RECORDS_STORAGE_KEY = 'crimson_vesper.records.v1';

interface SavedRecords {
  bestSeconds: number;
  bestKills: number;
  totalSouls: number;
  victories: number;
}

const WEAPON_GLYPHS: Record<WeaponId, string> = {
  whip: '〰',
  wand: '✦',
  bible: '❖',
  axe: '🪓',
  thurible: '❂',
  lightning: '⚡',
  blood_rose: '🌹',
  star_torrent: '☄',
  immortal_vesper: '☀',
  eclipse_scythe: '🌙',
  devouring_shroud: '◉',
  seven_judgment: '🌩',
};

const RELIC_GLYPHS: Record<RelicId, string> = {
  black_heart: '♥',
  empty_tome: '📖',
  amber_seal: '◈',
  crimson_candelabra: '🕯',
  mercury_blood: '💧',
  duplicator_ring: '◎',
};

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
  private onStartRun: (heroId: HeroId, callbacks: ArenaCallbacks) => void;
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
      onStartRun: (heroId: HeroId, callbacks: ArenaCallbacks) => void;
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
        };
      }
    } catch {
      // ignore storage errors
    }
    return { bestSeconds: 0, bestKills: 0, totalSouls: 0, victories: 0 };
  }

  private saveRunRecord(summary: RunSummary): void {
    const rec = this.loadRecords();
    rec.bestSeconds = Math.max(rec.bestSeconds, Math.floor(summary.elapsedSeconds));
    rec.bestKills = Math.max(rec.bestKills, summary.kills);
    rec.totalSouls += summary.souls;
    if (summary.victory) rec.victories += 1;
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
    }, 340);
  }

  renderTitleScreen(): void {
    this.clearKeyPickHandler();
    const rec = this.loadRecords();
    const heroIds: HeroId[] = ['alaric', 'seraphina', 'kaelen'];

    const screen = document.createElement('div');
    screen.className = 'title-screen';
    screen.dataset.testid = 'title-screen';

    const sun = document.createElement('div');
    sun.className = 'eclipse-sun';
    screen.appendChild(sun);

    const header = document.createElement('div');
    header.className = 'title-header';
    header.innerHTML = `
      <div class="title-kicker">Crônicas dos Juramentados da Cinza</div>
      <h1 class="title-main">VESPERA</h1>
      <p class="title-sub">Eclipse Carmesim</p>
    `;
    screen.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'hero-grid';

    for (const hId of heroIds) {
      const hero = HEROES[hId];
      const weapon = WEAPONS[hero.startingWeapon];
      const card = document.createElement('button');
      card.type = 'button';
      card.dataset.testid = `hero-card-${hId}`;
      card.className = `hero-card ${this.selectedHero === hId ? 'selected' : ''}`;
      const portraitUrl = createHeroPortraitDataUrl(hId);

      card.innerHTML = `
        <div class="hero-card-top">
          <img class="hero-portrait" src="${portraitUrl}" alt="${hero.name}" />
          <div>
            <h3 class="hero-name">${hero.name}</h3>
            <div class="hero-epithet">${hero.epithet}</div>
            <span class="hero-weapon-pill">${WEAPON_GLYPHS[hero.startingWeapon]} ${weapon.name}</span>
          </div>
        </div>
        <div class="hero-perk">${hero.perkSummary}</div>
        <p class="hero-lore">${hero.lore}</p>
      `;

      card.addEventListener('click', () => {
        this.selectedHero = hId;
        grid.querySelectorAll('.hero-card').forEach((el) => el.classList.remove('selected'));
        card.classList.add('selected');
      });
      grid.appendChild(card);
    }
    screen.appendChild(grid);

    const actionsWrap = document.createElement('div');
    const actions = document.createElement('div');
    actions.className = 'title-actions';

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'btn-gothic';
    startBtn.dataset.testid = 'start-run-btn';
    startBtn.textContent = 'Iniciar Vigília';
    startBtn.addEventListener('click', () => this.beginArenaRun());

    const loreBtn = document.createElement('button');
    loreBtn.type = 'button';
    loreBtn.className = 'btn-gothic secondary';
    loreBtn.dataset.testid = 'open-lore-btn';
    loreBtn.textContent = 'Grimório & Lore';
    loreBtn.addEventListener('click', () => this.openLoreModal(screen));

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'btn-gothic secondary';
    muteBtn.textContent = gothicAudio.isMuted() ? 'Áudio: Mudo' : 'Áudio: Ativo';
    muteBtn.addEventListener('click', () => {
      const muted = gothicAudio.toggleMute();
      muteBtn.textContent = muted ? 'Áudio: Mudo' : 'Áudio: Ativo';
    });

    actions.append(startBtn, loreBtn, muteBtn);
    actionsWrap.appendChild(actions);

    const recordsBar = document.createElement('div');
    recordsBar.className = 'records-bar';
    recordsBar.innerHTML = `
      Melhor Tempo: <strong>${formatClock(rec.bestSeconds)}</strong> ·
      Recorde de Abates: <strong>${rec.bestKills}</strong> ·
      Almas Colhidas: <strong>${rec.totalSouls}</strong> ·
      Eclipses Vencidos: <strong>${rec.victories}</strong>
    `;
    actionsWrap.appendChild(recordsBar);
    screen.appendChild(actionsWrap);

    this.root.replaceChildren(screen);
  }

  private openLoreModal(parent: HTMLElement): void {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.testid = 'lore-modal';

    const chaptersHtml = LORE_CHAPTERS.map(
      (ch) => `
      <div class="lore-section">
        <h4>${ch.title} — <small style="color:#b8a9b5">${ch.subtitle}</small></h4>
        <p>${ch.body}</p>
      </div>
    `
    ).join('');

    const synergiesHtml = (['whip', 'wand', 'bible', 'axe', 'thurible', 'lightning'] as const)
      .map((wId) => {
        const w = WEAPONS[wId];
        const r = w.catalystRelic ? RELICS[w.catalystRelic] : null;
        const evo = w.evolvesInto ? WEAPONS[w.evolvesInto] : null;
        return `
          <div style="font-size:0.84rem; padding:4px 0; color:#e2d7e0;">
            <strong style="color:${w.iconColor}">${WEAPON_GLYPHS[wId]} ${w.name} (Nv.5)</strong>
            + <span>${r ? `${RELIC_GLYPHS[r.id]} ${r.name}` : ''}</span>
            ➔ <strong style="color:#ffd166">${evo ? `${WEAPON_GLYPHS[evo.id]} ${evo.name}` : ''}</strong>
          </div>
        `;
      })
      .join('');

    backdrop.innerHTML = `
      <div class="modal-panel">
        <h2 class="modal-title">Grimório da Véspera</h2>
        <p class="modal-subtitle">Os Segredos do Conclave Caído e das Armas Ancestrais</p>
        ${chaptersHtml}
        <div class="lore-section" style="border-bottom:none">
          <h4>IV. Tábuas de Transmutação (Evoluções em Baús)</h4>
          ${synergiesHtml}
        </div>
        <div style="margin-top:18px">
          <button type="button" class="btn-gothic secondary" data-close-lore>Fechar Grimório</button>
        </div>
      </div>
    `;

    backdrop.querySelector('[data-close-lore]')?.addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop) backdrop.remove();
    });
    parent.appendChild(backdrop);
  }

  private beginArenaRun(): void {
    this.transitionWithCurtain(() => {
      this.mountHudDom();
      this.onStartRun(this.selectedHero, {
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

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

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
          <div class="clock-phase" data-clock-phase>I · Crepúsculo Cinzento</div>
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

      <div class="touch-controls">
        <div class="joystick-zone" data-joystick style="${isTouch ? '' : 'opacity:0.32'}">
          <div class="joystick-knob" data-joystick-knob></div>
        </div>
        <button type="button" class="dash-btn" data-dash-btn title="Passo Espectral (Espaço)">
          PASSO<br/>[ESPAÇO]
        </button>
      </div>

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

    this.setupVirtualJoystick(
      hud.querySelector('[data-joystick]') as HTMLElement,
      hud.querySelector('[data-joystick-knob]') as HTMLElement
    );

    this.root.replaceChildren(hud);
  }

  private setupVirtualJoystick(zone: HTMLElement, knob: HTMLElement): void {
    let activePointerId: number | null = null;
    const radius = 38;

    const updateFromEvent = (ev: PointerEvent) => {
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = ev.clientX - cx;
      let dy = ev.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.onSetVirtualJoystick(dx / radius, dy / radius);
    };

    const resetJoystick = () => {
      activePointerId = null;
      knob.style.transform = 'translate(0px, 0px)';
      this.onSetVirtualJoystick(0, 0);
    };

    zone.addEventListener('pointerdown', (ev) => {
      activePointerId = ev.pointerId;
      zone.setPointerCapture(ev.pointerId);
      updateFromEvent(ev);
    });
    zone.addEventListener('pointermove', (ev) => {
      if (ev.pointerId === activePointerId) updateFromEvent(ev);
    });
    zone.addEventListener('pointerup', (ev) => {
      if (ev.pointerId === activePointerId) resetJoystick();
    });
    zone.addEventListener('pointercancel', resetJoystick);
  }

  private updateHud(snap: HudSnapshot): void {
    if (!this.hudRoot) return;

    const xpPct = Math.min(100, Math.round((snap.xp / Math.max(1, snap.xpToNext)) * 100));
    if (this.xpFillEl) this.xpFillEl.style.width = `${xpPct}%`;
    if (this.xpLevelEl) this.xpLevelEl.textContent = `NV ${snap.level}`;
    if (this.clockTimeEl) this.clockTimeEl.textContent = formatClock(snap.elapsedSeconds);
    if (this.clockPhaseEl) this.clockPhaseEl.textContent = snap.phaseName;
    if (this.killsEl) this.killsEl.textContent = `${snap.kills}`;
    if (this.soulsEl) this.soulsEl.textContent = `${snap.souls}`;

    if (this.dashBtnEl) {
      this.dashBtnEl.style.opacity = snap.dashReadyRatio >= 1 ? '1' : '0.45';
    }

    // Render weapon & relic slots
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
              <span style="color:${def.iconColor}">${WEAPON_GLYPHS[wId]}</span>
              <span class="slot-lvl">${def.isEvolved ? '★' : `Nv${lv}`}</span>
            </div>
          `;
        } else {
          html += `<div class="item-slot" style="opacity:0.3"></div>`;
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
              <span style="color:${def.iconColor}">${RELIC_GLYPHS[rId]}</span>
              <span class="slot-lvl">Nv${lv}</span>
            </div>
          `;
        } else {
          html += `<div class="item-slot" style="opacity:0.25"></div>`;
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
      <p class="modal-subtitle">Escolha uma dádiva sagrada para enfrentar a noite (Teclas 1–${choices.length})</p>
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
        ? WEAPON_GLYPHS[c.weaponId]
        : c.relicId
          ? RELIC_GLYPHS[c.relicId]
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
      ? WEAPON_GLYPHS[reward.weaponId]
      : reward.relicId
        ? RELIC_GLYPHS[reward.relicId]
        : '✦';

    backdrop.innerHTML = `
      <div class="modal-panel" style="max-width:480px">
        <h2 class="modal-title">Relicário Dourado Aberto</h2>
        <p class="modal-subtitle">${reward.subtitle}</p>
        <div class="upgrade-card" style="cursor:default; margin-bottom:18px; text-align:center">
          <div style="font-size:2.4rem; margin-bottom:6px">${glyph}</div>
          <h3 class="upgrade-name" style="font-size:1.3rem">${reward.title}</h3>
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
      <div class="modal-panel" style="max-width:420px">
        <h2 class="modal-title">Vigília Suspensa</h2>
        <p class="modal-subtitle">A Névoa Rubra aguarda no escuro.</p>
        <div style="display:flex; flex-direction:column; gap:12px">
          <button type="button" class="btn-gothic" data-resume-btn>Retomar Vigília</button>
          <button type="button" class="btn-gothic secondary" data-quit-btn>Retornar ao Conclave</button>
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
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.dataset.testid = 'summary-modal';

    backdrop.innerHTML = `
      <div class="modal-panel" style="max-width:520px">
        <h2 class="modal-title" style="color:${summary.victory ? '#ffe494' : '#ff4d6d'}">
          ${summary.victory ? 'ALVORADA RECONQUISTADA' : 'CONSUMIDO PELO ECLIPSE'}
        </h2>
        <p class="modal-subtitle">${hero.name} · ${hero.epithet}</p>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px; text-align:left">
          <div class="stat-pill">Tempo Sobrevivido: <strong>${formatClock(summary.elapsedSeconds)}</strong></div>
          <div class="stat-pill">Nível de Éter: <strong>${summary.level}</strong></div>
          <div class="stat-pill">Criaturas Abatidas: <strong>${summary.kills}</strong></div>
          <div class="stat-pill">Almas Colhidas: <strong>${summary.souls}</strong></div>
        </div>

        <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap">
          <button type="button" class="btn-gothic" data-retry-btn>Nova Vigília</button>
          <button type="button" class="btn-gothic secondary" data-menu-btn>Escolher Juramentado</button>
        </div>
      </div>
    `;

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
