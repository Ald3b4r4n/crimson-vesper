import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UNLOCKED_WEAPONS,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  ENEMIES,
  getRelicIconUrl,
  getWeaponDiscoveryStage,
  getWeaponIconUrl,
  HERO_ORDER,
  HEROES,
  STAGES,
  WEAPONS,
} from '../../src/data/loreData';
import { SpatialGrid } from '../../src/game/SpatialGrid';
import {
  ALL_BASE_WEAPONS,
  ALL_EVOLVED_WEAPONS,
  ALL_RELICS,
  applyUpgradeChoice,
  buildUpgradeChoices,
  computeEffectiveStats,
  computeIntraMatchEscalation,
  computePlayerPowerPressure,
  computeWeaponForgeBonus,
  createInitialInventory,
  getActiveSynergyPairs,
  getAvailableEvolutions,
  getAvailableUltimates,
  isBaseWeaponUnlocked,
  MAX_WEAPON_FORGE_LEVEL,
  MAX_WEAPON_SLOTS,
  resolveRelicChest,
  WEAPON_FORGE_COSTS,
} from '../../src/game/UpgradeLogic';

describe('Vespera — Difficulties, Ultimates, 27 Enemies, 40-Min Stages & 36 Icons', () => {
  it('defines all 4 difficulty modes (normal, hard, epic, holi_shit) with escalating threat and scarcer healing', () => {
    expect(DIFFICULTY_ORDER).toEqual(['normal', 'hard', 'epic', 'holi_shit']);
    expect(DIFFICULTIES.holi_shit.label).toBe('HOLI SHIT!');
    expect(DIFFICULTIES.hard.hpMult).toBeGreaterThan(DIFFICULTIES.normal.hpMult);
    expect(DIFFICULTIES.epic.hordeMult).toBeGreaterThan(DIFFICULTIES.hard.hordeMult);
    expect(DIFFICULTIES.holi_shit.hordeMult).toBeGreaterThan(DIFFICULTIES.epic.hordeMult);
    expect(DIFFICULTIES.holi_shit.chaliceDropChance).toBeLessThan(
      DIFFICULTIES.normal.chaliceDropChance
    );
  });

  it('defines all 7 stages (2400s), expanded enemy pools, and 27 distinct enemies', () => {
    expect(STAGES).toHaveLength(7);
    expect(STAGES.map((s) => s.id)).toEqual([
      'forest',
      'castle',
      'dungeon',
      'volcano_desert',
      'metropolis',
      'temple',
      'inferno',
    ]);
    for (const stage of STAGES) {
      expect(stage.durationSeconds).toBe(2400);
      expect(stage.enemyPool.length).toBeGreaterThanOrEqual(6);
    }
    expect(Object.keys(ENEMIES)).toHaveLength(27);
  });

  it('registers 9 base, 9 evolved, 9 Ultimate weapons, and 9 relics with custom .webp icons', () => {
    expect(ALL_BASE_WEAPONS).toHaveLength(9);
    expect(ALL_EVOLVED_WEAPONS).toHaveLength(9);
    expect(ALL_RELICS).toHaveLength(9);
    expect(Object.keys(WEAPONS)).toHaveLength(27);
    for (const wId of Object.keys(WEAPONS) as Array<keyof typeof WEAPONS>) {
      expect(getWeaponIconUrl(wId)).toBe(`./art/icons/${wId}.webp`);
    }
    for (const rId of ALL_RELICS) {
      expect(getRelicIconUrl(rId)).toBe(`./art/icons/${rId}.webp`);
    }
  });

  it('initializes all 4 heroes with their signature starting weapon', () => {
    expect(createInitialInventory('alaric').weapons.whip).toBe(1);
    expect(createInitialInventory('seraphina').weapons.wand).toBe(1);
    expect(createInitialInventory('kaelen').weapons.axe).toBe(1);
    expect(createInitialInventory('valeria').weapons.cross).toBe(1);
  });

  it('unlocks weapon evolutions -> Ultimate awakening and guarantees 6-slot full evolution', () => {
    const inv = createInitialInventory('valeria');
    inv.weapons.cross = 5;
    inv.relics.ash_clover = 1;

    expect(getAvailableEvolutions(inv)).toEqual(['celestial_blade']);

    const chestReward = resolveRelicChest(inv, () => 0);
    expect(chestReward.kind).toBe('evolution');
    expect(chestReward.weaponId).toBe('celestial_blade');

    const res = applyUpgradeChoice(inv, chestReward);
    expect(res.evolvedWeapon).toBe('celestial_blade');
    expect(inv.weapons.cross).toBeUndefined();
    expect(inv.weapons.celestial_blade).toBe(1);

    // Advance Evolved weapon to Grau 3 + Catalyst Relic to Nv.2 -> Excalibur Zenith Ultimate awakens!
    inv.weapons.celestial_blade = 3;
    inv.relics.ash_clover = 2;
    expect(getAvailableUltimates(inv)).toEqual(['excalibur_zenith']);

    const ultChest = resolveRelicChest(inv, () => 0);
    expect(ultChest.kind).toBe('ultimate');
    expect(ultChest.weaponId).toBe('excalibur_zenith');

    applyUpgradeChoice(inv, ultChest);
    expect(inv.weapons.celestial_blade).toBeUndefined();
    expect(inv.weapons.excalibur_zenith).toBe(1);

    // Full 6-slot build simulation with pseudo-random player picks + 6 Champion Relic Chests
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const runInv = createInitialInventory('alaric');
    for (let step = 0; step < 62; step++) {
      const choices = buildUpgradeChoices(runInv, 3, rng);
      expect(choices.length).toBe(3);
      const picked = choices[Math.floor(rng() * choices.length)];
      applyUpgradeChoice(runInv, picked);
      expect(getActiveSynergyPairs(runInv).size).toBeLessThanOrEqual(MAX_WEAPON_SLOTS);
    }

    for (let c = 0; c < 6; c++) {
      const reward = resolveRelicChest(runInv, rng);
      applyUpgradeChoice(runInv, reward);
    }

    const equippedWeaponIds = Object.keys(runInv.weapons) as Array<keyof typeof WEAPONS>;
    expect(equippedWeaponIds).toHaveLength(6);
    for (const wId of equippedWeaponIds) {
      expect(Boolean(WEAPONS[wId].isEvolved || WEAPONS[wId].isUltimate)).toBe(true);
    }
  });

  it('scales projectile speed and crit chance with passive relics and Limit Break blessings', () => {
    const inv = createInitialInventory('alaric');
    const base = computeEffectiveStats(inv);

    inv.relics.assassin_gauntlet = 2;
    inv.relics.twilight_orb = 2;
    inv.relics.ash_clover = 1;
    inv.ascensionMight = 0.2;
    inv.ascensionHp = 40;

    const buffed = computeEffectiveStats(inv);
    expect(buffed.projSpeed).toBeGreaterThan(base.projSpeed);
    expect(buffed.critChance).toBeGreaterThan(base.critChance);
    expect(buffed.area).toBeGreaterThan(base.area);
    expect(buffed.might).toBeGreaterThan(base.might + 0.35);
    expect(buffed.maxHp).toBeGreaterThan(base.maxHp);
  });

  it('queries nearby and nearest entities accurately in SpatialGrid', () => {
    const grid = new SpatialGrid<{
      id: number;
      x: number;
      y: number;
      radius: number;
      active: boolean;
    }>(64);
    grid.insert({ id: 1, x: 10, y: 10, radius: 12, active: true });
    grid.insert({ id: 2, x: 45, y: 15, radius: 12, active: true });
    grid.insert({ id: 3, x: 400, y: 400, radius: 12, active: true });

    const near = grid.queryRadius(0, 0, 60);
    expect(near.map((e) => e.id).sort()).toEqual([1, 2]);
    expect(grid.findNearest(0, 0, 200)?.id).toBe(1);

    const choices = buildUpgradeChoices(createInitialInventory('seraphina'), 3, () => 0.5);
    expect(choices).toHaveLength(3);
  });

  it('configures unified 20/30/40m boss milestones and regional subBossPool across all 7 stages and 4 difficulties', () => {
    const subIntervals = DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].subBossIntervalSec);
    const surgeIntervals = DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].surgeIntervalSec);
    const escorts = DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].bossEscortCount);
    const bossCds = DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].bossAbilityCdMult);
    const ramps = DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].timeRampExponent);

    expect(new Set(subIntervals).size).toBe(4);
    expect(new Set(surgeIntervals).size).toBe(4);
    expect(new Set(escorts).size).toBe(4);
    expect(new Set(bossCds).size).toBe(4);
    expect(new Set(ramps).size).toBe(4);

    for (const stage of STAGES) {
      expect(stage.subBossPool.length).toBeGreaterThanOrEqual(4);
      expect(stage.boss20Min.length).toBeGreaterThan(0);
      expect(stage.boss30Min.length).toBeGreaterThan(0);
      expect(stage.boss40Min.length).toBeGreaterThan(0);
    }
  });

  it('escalates horde count and enemy stats steeply even in normal difficulty and reacts to player weapon evolution power', () => {
    const baseInv = createInitialInventory('alaric');
    const times = [0, 600, 1200, 1800, 2400];
    const snaps = times.map((t) => computeIntraMatchEscalation(t, 'normal', baseInv));

    for (let i = 1; i < snaps.length; i++) {
      expect(snaps[i].hpMult).toBeGreaterThan(snaps[i - 1].hpMult);
      expect(snaps[i].dmgMult).toBeGreaterThan(snaps[i - 1].dmgMult);
      expect(snaps[i].spdMult).toBeGreaterThan(snaps[i - 1].spdMult);
      expect(snaps[i].knockbackBonus).toBeGreaterThanOrEqual(snaps[i - 1].knockbackBonus);
      expect(snaps[i].maxHorde).toBeGreaterThanOrEqual(snaps[i - 1].maxHorde);
      expect(snaps[i].spawnsPerSecond).toBeGreaterThan(snaps[i - 1].spawnsPerSecond);
      expect(snaps[i].packSize).toBeGreaterThanOrEqual(snaps[i - 1].packSize);
    }

    expect(snaps[2].maxHorde).toBeGreaterThan(snaps[0].maxHorde);
    expect(snaps[4].maxHorde).toBeGreaterThanOrEqual(snaps[2].maxHorde);
    expect(snaps[0].knockbackBonus).toBeLessThan(snaps[4].knockbackBonus);
    expect(snaps[0].packSize).toBeLessThan(snaps[4].packSize);

    const strongInv = createInitialInventory('alaric');
    strongInv.level = 42;
    delete strongInv.weapons.whip;
    strongInv.weapons.celestial_blade = 3;
    strongInv.weapons.excalibur_zenith = 3;

    expect(computePlayerPowerPressure(strongInv)).toBeGreaterThan(
      computePlayerPowerPressure(baseInv)
    );
    const midNormalWeak = computeIntraMatchEscalation(1200, 'normal', baseInv);
    const midNormalStrong = computeIntraMatchEscalation(1200, 'normal', strongInv);
    expect(midNormalStrong.hpMult).toBeGreaterThan(midNormalWeak.hpMult);
  });

  it('registers all 8 articulated heroes (including Mordred, LinK, Antonio Cruz, and Luisa Cruz) and stage-hidden weapons', () => {
    expect(HERO_ORDER).toEqual([
      'alaric',
      'seraphina',
      'kaelen',
      'valeria',
      'mordred',
      'link',
      'antonio',
      'luisa',
    ]);
    expect(HEROES.luisa.lore.toLowerCase()).toContain('antonio cruz');
    expect(HEROES.luisa.lore.toLowerCase()).toContain('encaracolados');
    expect(HEROES.antonio.lore.toLowerCase()).toContain('medieval');
    expect(HEROES.antonio.lore.toLowerCase()).not.toContain('alfaiataria');
    expect(HEROES.antonio.lore.toLowerCase()).not.toContain('gravata');

    expect(createInitialInventory('mordred').weapons.thurible).toBe(1);
    expect(createInitialInventory('link').weapons.cross).toBe(1);
    expect(createInitialInventory('antonio').weapons.whip).toBe(1);
    expect(createInitialInventory('luisa').weapons.wand).toBe(1);

    expect(DEFAULT_UNLOCKED_WEAPONS).toEqual(['whip', 'wand']);
    const hiddenSet = new Set(STAGES.map((st) => st.hiddenWeapon));
    expect(hiddenSet.size).toBe(7);
    for (const wId of ALL_BASE_WEAPONS) {
      if (!DEFAULT_UNLOCKED_WEAPONS.includes(wId)) {
        expect(hiddenSet.has(wId)).toBe(true);
        expect(getWeaponDiscoveryStage(wId)).toBeDefined();
      }
    }
  });

  it('enforces stage-hidden weapon locking on level-up and applies Out-of-Game Forge scaling', () => {
    const lockedInv = createInitialInventory('alaric', [...DEFAULT_UNLOCKED_WEAPONS], {
      whip: 4,
    });
    expect(lockedInv.weapons.whip).toBe(2);
    expect(isBaseWeaponUnlocked(lockedInv, 'whip')).toBe(true);
    expect(isBaseWeaponUnlocked(lockedInv, 'wand')).toBe(true);
    expect(isBaseWeaponUnlocked(lockedInv, 'bible')).toBe(false);
    expect(isBaseWeaponUnlocked(lockedInv, 'axe')).toBe(false);

    const choices = buildUpgradeChoices(lockedInv, 6, () => 0.42);
    const offeredWeapons = choices.filter((c) => c.kind === 'weapon').map((c) => c.weaponId);
    for (const wId of offeredWeapons) {
      expect(['whip', 'wand']).toContain(wId);
    }

    // Unlock bible -> now available in upgrade pool
    lockedInv.unlockedWeapons!.push('bible');
    expect(isBaseWeaponUnlocked(lockedInv, 'bible')).toBe(true);

    // Out-of-Game Forge progression bonuses & early evolution at Lv.5
    expect(WEAPON_FORGE_COSTS).toHaveLength(MAX_WEAPON_FORGE_LEVEL);
    const f0 = computeWeaponForgeBonus(0);
    const f5 = computeWeaponForgeBonus(5);
    expect(f5.damageMult).toBeGreaterThan(f0.damageMult);
    expect(f5.areaMult).toBeGreaterThan(f0.areaMult);
    expect(f5.cooldownMult).toBeLessThan(f0.cooldownMult);
    expect(f5.bonusAmount).toBe(2);
    expect(f5.startingLevel).toBe(2);
    expect(f5.earlyEvoDiscount).toBe(1);

    const earlyEvoInv = createInitialInventory('alaric', ['whip'], { whip: 5 });
    earlyEvoInv.weapons.whip = 4; // Normal max is 5, Forge Lv.5 allows evolution at 4!
    earlyEvoInv.relics.black_heart = 1;
    expect(getAvailableEvolutions(earlyEvoInv)).toEqual(['blood_rose']);
  });
});
