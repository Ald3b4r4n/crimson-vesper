import { describe, expect, it } from 'vitest';
import { SpatialGrid } from '../../src/game/SpatialGrid';
import {
  applyUpgradeChoice,
  buildUpgradeChoices,
  computeEffectiveStats,
  createInitialInventory,
  getAvailableEvolutions,
  resolveRelicChest,
} from '../../src/game/UpgradeLogic';

describe('Vespera — Upgrade, Synergy & Spatial Systems', () => {
  it('initializes hero inventory with correct starting weapon', () => {
    const alaric = createInitialInventory('alaric');
    expect(alaric.weapons.whip).toBe(1);

    const seraphina = createInitialInventory('seraphina');
    expect(seraphina.weapons.wand).toBe(1);

    const kaelen = createInitialInventory('kaelen');
    expect(kaelen.weapons.axe).toBe(1);
  });

  it('scales effective hero stats when passive relics are acquired', () => {
    const inv = createInitialInventory('alaric');
    const base = computeEffectiveStats(inv);

    inv.relics.black_heart = 2;
    inv.relics.empty_tome = 2;
    inv.relics.duplicator_ring = 1;

    const buffed = computeEffectiveStats(inv);
    expect(buffed.maxHp).toBeGreaterThan(base.maxHp);
    expect(buffed.cooldown).toBeLessThan(base.cooldown);
    expect(buffed.amount).toBe(base.amount + 1);
  });

  it('unlocks weapon evolution in Relic Chest when weapon is Lv5 + catalyst relic owned', () => {
    const inv = createInitialInventory('alaric');
    inv.weapons.whip = 5;
    expect(getAvailableEvolutions(inv)).toEqual([]);

    inv.relics.black_heart = 1;
    expect(getAvailableEvolutions(inv)).toEqual(['blood_rose']);

    const chestReward = resolveRelicChest(inv, () => 0);
    expect(chestReward.kind).toBe('evolution');
    expect(chestReward.weaponId).toBe('blood_rose');

    const res = applyUpgradeChoice(inv, chestReward);
    expect(res.evolvedWeapon).toBe('blood_rose');
    expect(inv.weapons.whip).toBeUndefined();
    expect(inv.weapons.blood_rose).toBe(1);
  });

  it('builds valid level-up choices and falls back to chalice blessing when maxed', () => {
    const inv = createInitialInventory('seraphina');
    const choices = buildUpgradeChoices(inv, 3, () => 0.42);
    expect(choices.length).toBe(3);
  });

  it('queries nearby and nearest entities accurately in SpatialGrid', () => {
    const grid = new SpatialGrid<{ id: number; x: number; y: number; radius: number; active: boolean }>(64);
    grid.insert({ id: 1, x: 10, y: 10, radius: 12, active: true });
    grid.insert({ id: 2, x: 45, y: 15, radius: 12, active: true });
    grid.insert({ id: 3, x: 400, y: 400, radius: 12, active: true });

    const near = grid.queryRadius(0, 0, 60);
    expect(near.map((e) => e.id).sort()).toEqual([1, 2]);

    const closest = grid.findNearest(0, 0, 200);
    expect(closest?.id).toBe(1);
  });
});
