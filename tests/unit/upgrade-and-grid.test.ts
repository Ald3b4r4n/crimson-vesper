import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/data/loreData';
import { SpatialGrid } from '../../src/game/SpatialGrid';
import {
  ALL_BASE_WEAPONS,
  ALL_RELICS,
  applyUpgradeChoice,
  buildUpgradeChoices,
  computeEffectiveStats,
  createInitialInventory,
  getAvailableEvolutions,
  resolveRelicChest,
} from '../../src/game/UpgradeLogic';

describe('Vespera — 7 Stages, 27 Powers & Spatial Systems', () => {
  it('defines all 7 stages in campaign order with distinct bosses', () => {
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
  });

  it('registers all 9 base weapons and 9 passive relics', () => {
    expect(ALL_BASE_WEAPONS).toHaveLength(9);
    expect(ALL_RELICS).toHaveLength(9);
  });

  it('initializes all 4 heroes with their signature starting weapon', () => {
    expect(createInitialInventory('alaric').weapons.whip).toBe(1);
    expect(createInitialInventory('seraphina').weapons.wand).toBe(1);
    expect(createInitialInventory('kaelen').weapons.axe).toBe(1);
    expect(createInitialInventory('valeria').weapons.cross).toBe(1);
  });

  it('unlocks new weapon evolutions (cross -> celestial_blade, daggers -> thousand_fangs)', () => {
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
  });

  it('scales projectile speed and crit chance with new passive relics', () => {
    const inv = createInitialInventory('alaric');
    const base = computeEffectiveStats(inv);

    inv.relics.assassin_gauntlet = 2;
    inv.relics.twilight_orb = 2;
    inv.relics.ash_clover = 1;

    const buffed = computeEffectiveStats(inv);
    expect(buffed.projSpeed).toBeGreaterThan(base.projSpeed);
    expect(buffed.critChance).toBeGreaterThan(base.critChance);
    expect(buffed.area).toBeGreaterThan(base.area);
    expect(buffed.might).toBeGreaterThan(base.might);
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
