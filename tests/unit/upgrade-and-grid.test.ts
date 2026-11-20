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
  ALL_EXCLUSIVE_WEAPONS,
  ALL_RELICS,
  applyUpgradeChoice,
  buildUpgradeChoices,
  computeEffectiveStats,
  computeHeroWithUpgrades,
  computeIntraMatchEscalation,
  computePlayerPowerPressure,
  computeWeaponForgeBonus,
  createInitialInventory,
  getActiveSynergyPairs,
  getAvailableEvolutions,
  getAvailableUltimates,
  HERO_UPGRADE_GOLD_COSTS,
  isBaseWeaponUnlocked,
  isExclusiveWeaponUnlocked,
  isRelicUnlocked,
  MAX_HERO_UPGRADE_LEVEL,
  MAX_WEAPON_FORGE_LEVEL,
  MAX_WEAPON_SLOTS,
  pickBalancedSpawnKind,
  resolveRelicChest,
  WEAPON_FORGE_COSTS,
  WEAPON_FORGE_GOLD_COSTS,
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

  it('defines all 7 stages (2400s), expanded enemy pools, and 39 distinct enemies including 7 dedicated sub-bosses', () => {
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
      expect(stage.enemyPool.length).toBeGreaterThanOrEqual(8);
    }
    expect(Object.keys(ENEMIES)).toHaveLength(39);
  });

  it('registers 9 base, 9 evolved, 9 Ultimate, 10 Exclusive Gold weapons, and 9 relics with custom .webp icons', () => {
    expect(ALL_BASE_WEAPONS).toHaveLength(9);
    expect(ALL_EVOLVED_WEAPONS).toHaveLength(9);
    expect(ALL_EXCLUSIVE_WEAPONS).toHaveLength(10);
    expect(ALL_RELICS).toHaveLength(9);
    expect(Object.keys(WEAPONS)).toHaveLength(37);
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
      expect(choices.length).toBeGreaterThanOrEqual(2);
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

    // HP regen scales organically with hero level progression + Black Heart vitality
    inv.level = 12;
    inv.relics.black_heart = 2;
    const progressed = computeEffectiveStats(inv);
    expect(progressed.regen).toBeGreaterThan(base.regen + 1.5);
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

    // Reusable zero-allocation scratch buffer & dirty-bucket clear verification
    const scratch: Array<{ id: number; x: number; y: number; radius: number; active: boolean }> = [];
    const sameRef = grid.queryRadius(0, 0, 60, scratch);
    expect(sameRef).toBe(scratch);
    expect(scratch.map((e) => e.id).sort()).toEqual([1, 2]);
    grid.clear();
    expect(grid.queryRadius(0, 0, 60, scratch)).toHaveLength(0);
    expect(grid.findNearest(0, 0, 200)).toBeNull();

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

  it('enforces stage-hidden weapon & catalyst relic locking on level-up and applies Out-of-Game Forge scaling', () => {
    const lockedInv = createInitialInventory('alaric', [...DEFAULT_UNLOCKED_WEAPONS], {
      whip: 4,
    });
    expect(lockedInv.weapons.whip).toBe(2);
    expect(isBaseWeaponUnlocked(lockedInv, 'whip')).toBe(true);
    expect(isBaseWeaponUnlocked(lockedInv, 'wand')).toBe(true);
    expect(isBaseWeaponUnlocked(lockedInv, 'bible')).toBe(false);
    expect(isBaseWeaponUnlocked(lockedInv, 'axe')).toBe(false);

    // Catalysts unlock alongside their paired weapons
    expect(isRelicUnlocked(lockedInv, 'black_heart')).toBe(true);
    expect(isRelicUnlocked(lockedInv, 'empty_tome')).toBe(true);
    expect(isRelicUnlocked(lockedInv, 'amber_seal')).toBe(false);
    expect(isRelicUnlocked(lockedInv, 'crimson_candelabra')).toBe(false);

    const choices = buildUpgradeChoices(lockedInv, 6, () => 0.42);
    const offeredWeapons = choices.filter((c) => c.kind === 'weapon').map((c) => c.weaponId);
    for (const wId of offeredWeapons) {
      expect(['whip', 'wand']).toContain(wId);
    }
    const offeredRelics = choices.filter((c) => c.kind === 'relic').map((c) => c.relicId);
    for (const rId of offeredRelics) {
      expect(['black_heart', 'empty_tome']).toContain(rId);
    }

    // Unlock bible -> both bible and its catalyst (amber_seal) become unlocked
    lockedInv.unlockedWeapons!.push('bible');
    expect(isBaseWeaponUnlocked(lockedInv, 'bible')).toBe(true);
    expect(isRelicUnlocked(lockedInv, 'amber_seal')).toBe(true);

    // Hero starting with a locked stage weapon still unlocks its catalyst during that run,
    // and evolved/ultimate forms preserve lineage unlock checks.
    const kaelenInv = createInitialInventory('kaelen', [...DEFAULT_UNLOCKED_WEAPONS]);
    expect(isBaseWeaponUnlocked(kaelenInv, 'axe')).toBe(true);
    expect(isRelicUnlocked(kaelenInv, 'crimson_candelabra')).toBe(true);
    delete kaelenInv.weapons.axe;
    const axeEvoId = WEAPONS.axe.evolvesInto!;
    kaelenInv.weapons[axeEvoId] = 1;
    expect(isBaseWeaponUnlocked(kaelenInv, 'axe')).toBe(true);
    expect(isRelicUnlocked(kaelenInv, 'crimson_candelabra')).toBe(true);

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

  it('enforces sub-boss diversity with ZERO main bosses recycled as sub-bosses and enriches all 7 stages with new enemies', () => {
    const mainBossKinds = new Set([
      'boss_fenrir',
      'boss_carmilla',
      'boss_morghul',
      'boss_ignis',
      'boss_vane',
      'boss_malakor',
      'boss_reaper',
    ]);
    const newRegularKinds = new Set([
      'skeleton_archer',
      'catapult',
      'blood_mage',
      'vampire_knight',
      'obsidian_brute',
    ]);

    const seenSubBosses = new Set<string>();
    for (const stage of STAGES) {
      // Mid-boss & every sub-boss must be a dedicated subboss_* — NEVER a main stage boss!
      expect(mainBossKinds.has(stage.midBoss)).toBe(false);
      expect(ENEMIES[stage.midBoss].isSubBoss).toBe(true);
      expect(ENEMIES[stage.midBoss].hasAttackAnim).toBe(true);
      seenSubBosses.add(stage.midBoss);

      for (const sb of stage.subBossPool) {
        expect(mainBossKinds.has(sb)).toBe(false);
        expect(ENEMIES[sb].isSubBoss).toBe(true);
        expect(ENEMIES[sb].isBoss).toBeFalsy();
        seenSubBosses.add(sb);
      }

      // Every stage must contain new tactical enemies!
      const hasNewEnemy = stage.enemyPool.some((k) => newRegularKinds.has(k));
      expect(hasNewEnemy).toBe(true);
    }
    expect(seenSubBosses.size).toBe(7);

    // Ranged units & siege units properly declare rangedKind and attack animations
    for (const rangedKind of ['skeleton_archer', 'blood_mage', 'catapult', 'gargoyle', 'necromancer', 'plague_doctor'] as const) {
      expect(ENEMIES[rangedKind].isRanged).toBe(true);
      expect(ENEMIES[rangedKind].rangedKind).toBeDefined();
    }
    expect(ENEMIES.catapult.hasAttackAnim).toBe(true);
    expect(ENEMIES.vampire_knight.hasAttackAnim).toBe(true);
    expect(ENEMIES.obsidian_brute.hasAttackAnim).toBe(true);
  });

  it('prevents pure-ranged hordes and caps simultaneous ranged enemies & catapults (anti-bullet-hell)', () => {
    const mixedPool = STAGES[1].enemyPool; // Castle has archers, blood mages, catapults, gargoyles + melee!
    let seed = 101;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    // 1. Horde surges MUST NEVER spawn ranged units!
    for (let i = 0; i < 120; i++) {
      const surgePick = pickBalancedSpawnKind(mixedPool, [], 'holi_shit', true, rng);
      expect(ENEMIES[surgePick].isRanged).toBeFalsy();
    }

    // 2. When active ranged count hits cap (6 in Normal), spawner strictly falls back to melee
    const cappedActive = Array.from({ length: 30 }, (_, i) =>
      i < 6 ? ('skeleton_archer' as const) : ('skeleton' as const)
    );
    for (let i = 0; i < 60; i++) {
      const pick = pickBalancedSpawnKind(mixedPool, cappedActive, 'normal', false, rng);
      expect(ENEMIES[pick].isRanged).toBeFalsy();
    }

    // 3. When 2 catapults are already active in Normal, no 3rd catapult can spawn
    const twoCatapults = [
      'catapult' as const,
      'catapult' as const,
      ...Array.from({ length: 20 }, () => 'skeleton' as const),
    ];
    for (let i = 0; i < 60; i++) {
      const pick = pickBalancedSpawnKind(['catapult', 'skeleton'], twoCatapults, 'normal', false, rng);
      expect(pick).toBe('skeleton');
    }
  });

  it('offers ONLY Gold OR Heal choices on level-up once all weapons & relics are maxed', () => {
    const maxed = createInitialInventory('alaric', ['whip', 'wand']);
    maxed.level = 30;
    maxed.weapons = {
      abyssal_leviathan: 1,
      supernova_staff: 1,
      seraphim_choir: 1,
      doomsday_guillotine: 1,
      crimson_eclipse_aura: 1,
      wrath_of_solaris: 1,
    };
    maxed.relics = {
      black_heart: 5,
      empty_tome: 5,
      amber_seal: 5,
      crimson_candelabra: 5,
      mercury_blood: 5,
      duplicator_ring: 3,
    };

    const choices = buildUpgradeChoices(maxed, 3, () => 0.5);
    expect(choices).toHaveLength(2);
    expect(choices.map((c) => c.blessingType)).toEqual(['gold', 'heal']);

    const goldRes = applyUpgradeChoice(maxed, choices[0]);
    expect(goldRes.goldGained).toBeGreaterThanOrEqual(700);
    expect(maxed.gold).toBe(goldRes.goldGained);

    const healRes = applyUpgradeChoice(maxed, choices[1]);
    const eff = computeEffectiveStats(maxed);
    expect(healRes.healedHp).toBeGreaterThanOrEqual(Math.round(eff.maxHp * 0.44));
  });

  it('supports 10 expensive Exclusive Gold Weapons, Gold Forge, and Permanent Per-Hero Stat Upgrades', () => {
    expect(WEAPON_FORGE_GOLD_COSTS).toHaveLength(MAX_WEAPON_FORGE_LEVEL);
    expect(HERO_UPGRADE_GOLD_COSTS).toHaveLength(MAX_HERO_UPGRADE_LEVEL);

    for (const exId of ALL_EXCLUSIVE_WEAPONS) {
      const def = WEAPONS[exId];
      expect(def.isExclusive).toBe(true);
      expect(def.goldPrice).toBeGreaterThanOrEqual(3500);
      expect(def.maxLevel).toBe(5);
    }

    // Locked exclusive weapon does NOT appear in level-up pool until purchased
    const invUnbought = createInitialInventory('alaric', ['whip']);
    expect(isExclusiveWeaponUnlocked(invUnbought, 'crimson_katana')).toBe(false);
    const unboughtChoices = buildUpgradeChoices(invUnbought, 10, () => 0.5);
    expect(unboughtChoices.some((c) => c.weaponId === 'crimson_katana')).toBe(false);

    // Once purchased & forged to Lv.4, it enters the level-up pool starting at Grau 2!
    const invBought = createInitialInventory(
      'alaric',
      ['whip'],
      { crimson_katana: 4 },
      ['crimson_katana']
    );
    expect(isExclusiveWeaponUnlocked(invBought, 'crimson_katana')).toBe(true);
    const boughtChoices = buildUpgradeChoices(invBought, 10, () => 0.5);
    const katanaChoice = boughtChoices.find((c) => c.weaponId === 'crimson_katana');
    expect(katanaChoice).toBeDefined();
    expect(katanaChoice!.nextLevel).toBe(2);

    // Permanent Per-Hero Gold Stat Upgrades boost base & effective stats cleanly
    const baseHero = computeHeroWithUpgrades('antonio');
    const upgradedHero = computeHeroWithUpgrades('antonio', {
      vitality: 5,
      might: 5,
      agility: 5,
      fortitude: 5,
    });
    expect(upgradedHero.maxHp).toBe(baseHero.maxHp + 90);
    expect(upgradedHero.might).toBeCloseTo(baseHero.might + 0.35, 4);
    expect(upgradedHero.moveSpeed).toBe(baseHero.moveSpeed + 40);
    expect(upgradedHero.cooldown).toBeLessThan(baseHero.cooldown);
    expect(upgradedHero.armor).toBeCloseTo(baseHero.armor + 4, 2);
    expect(upgradedHero.critChance).toBeCloseTo(baseHero.critChance + 0.125, 4);

    const invWithHeroUpg = createInitialInventory('antonio', ['whip'], {}, [], {
      vitality: 3,
      might: 2,
    });
    const effStats = computeEffectiveStats(invWithHeroUpg);
    expect(effStats.maxHp).toBe(baseHero.maxHp + 54);
    expect(effStats.might).toBeCloseTo(baseHero.might + 0.14, 4);
  });
});
