import { describe, expect, it } from 'vitest';
import { getRelicIconUrl, getWeaponIconUrl, STAGES, WEAPONS } from '../../src/data/loreData';
import { SpatialGrid } from '../../src/game/SpatialGrid';
import {
  ALL_BASE_WEAPONS,
  ALL_RELICS,
  applyUpgradeChoice,
  buildUpgradeChoices,
  computeEffectiveStats,
  createInitialInventory,
  getActiveSynergyPairs,
  getAvailableEvolutions,
  MAX_WEAPON_SLOTS,
  resolveRelicChest,
} from '../../src/game/UpgradeLogic';

describe('Vespera — 40-Min Stages, Full 6-Slot Evolutions, 27 Custom Icons & Spatial Systems', () => {
  it('defines all 7 stages in campaign order with 40-minute (2400s) duration', () => {
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
    }
  });

  it('registers all 9 base weapons, 9 evolved weapons, and 9 passive relics with custom .webp icons', () => {
    expect(ALL_BASE_WEAPONS).toHaveLength(9);
    expect(ALL_RELICS).toHaveLength(9);
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

  it('unlocks weapon evolutions and guarantees all 6 weapon slots can evolve in a single run', () => {
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

    // Full 6-slot evolution simulation with pseudo-random player picks + 6 Champion Relic Chests
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const runInv = createInitialInventory('alaric');
    for (let step = 0; step < 62; step++) {
      const choices = buildUpgradeChoices(runInv, 3, rng);
      expect(choices.length).toBe(3);
      // Pick randomly among offered cards!
      const picked = choices[Math.floor(rng() * choices.length)];
      applyUpgradeChoice(runInv, picked);
      expect(getActiveSynergyPairs(runInv).size).toBeLessThanOrEqual(MAX_WEAPON_SLOTS);
    }

    // Open 6 Champion Relic Chests -> all 6 weapon slots evolve into Ancestral Weapons!
    for (let c = 0; c < 6; c++) {
      const reward = resolveRelicChest(runInv, rng);
      applyUpgradeChoice(runInv, reward);
    }

    const equippedWeaponIds = Object.keys(runInv.weapons) as Array<keyof typeof WEAPONS>;
    expect(equippedWeaponIds).toHaveLength(6);
    for (const wId of equippedWeaponIds) {
      expect(WEAPONS[wId].isEvolved).toBe(true);
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
});
