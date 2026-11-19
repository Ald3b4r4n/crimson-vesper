import {
  BaseWeaponId,
  DIFFICULTIES,
  DifficultyId,
  ENEMIES,
  EnemyKind,
  EvolvedWeaponId,
  ExclusiveWeaponId,
  ForgeableWeaponId,
  getRelicIconUrl,
  getWeaponIconUrl,
  HEROES,
  HeroId,
  HeroStats,
  HeroUpgradeLevels,
  RELICS,
  RelicId,
  UltimateWeaponId,
  WEAPONS,
  WeaponId,
} from '../data/loreData';

export const MAX_WEAPON_SLOTS = 6;
export const MAX_RELIC_SLOTS = 6;
export const MAX_WEAPON_FORGE_LEVEL = 5;
export const MAX_HERO_UPGRADE_LEVEL = 5;
export const WEAPON_FORGE_COSTS = [60, 120, 200, 320, 500] as const;
export const WEAPON_FORGE_GOLD_COSTS = [400, 850, 1500, 2400, 3800] as const;
export const HERO_UPGRADE_GOLD_COSTS = [350, 750, 1300, 2100, 3200] as const;

export interface WeaponForgeBonus {
  forgeLevel: number;
  damageMult: number;
  areaMult: number;
  cooldownMult: number;
  bonusAmount: number;
  critBonus: number;
  startingLevel: number;
  earlyEvoDiscount: number;
}

export function computeWeaponForgeBonus(forgeLevel: number): WeaponForgeBonus {
  const lv = Math.max(0, Math.min(MAX_WEAPON_FORGE_LEVEL, Math.floor(forgeLevel || 0)));
  return {
    forgeLevel: lv,
    damageMult: 1 + lv * 0.18,
    areaMult: 1 + lv * 0.05,
    cooldownMult: Math.pow(0.955, lv),
    bonusAmount: lv >= 5 ? 2 : lv >= 3 ? 1 : 0,
    critBonus: lv * 0.04,
    startingLevel: lv >= 4 ? 2 : 1,
    earlyEvoDiscount: lv >= 5 ? 1 : 0,
  };
}

export const ALL_BASE_WEAPONS: BaseWeaponId[] = [
  'whip',
  'wand',
  'bible',
  'axe',
  'thurible',
  'lightning',
  'daggers',
  'flask',
  'cross',
];

export const ALL_EVOLVED_WEAPONS: EvolvedWeaponId[] = [
  'blood_rose',
  'star_torrent',
  'immortal_vesper',
  'eclipse_scythe',
  'devouring_shroud',
  'seven_judgment',
  'thousand_fangs',
  'purifying_tide',
  'celestial_blade',
];

export const ALL_EXCLUSIVE_WEAPONS: ExclusiveWeaponId[] = [
  'crimson_katana',
  'frost_lance',
  'soul_grimoire',
  'solar_chakram',
  'abyssal_meteor',
  'blood_scythe',
  'tempest_bow',
  'seraphic_beam',
  'void_singularity',
  'eclipse_dragon',
];

export const ALL_FORGEABLE_WEAPONS: ForgeableWeaponId[] = [
  ...ALL_BASE_WEAPONS,
  ...ALL_EXCLUSIVE_WEAPONS,
];

export const ALL_RELICS: RelicId[] = [
  'black_heart',
  'empty_tome',
  'amber_seal',
  'crimson_candelabra',
  'mercury_blood',
  'duplicator_ring',
  'assassin_gauntlet',
  'twilight_orb',
  'ash_clover',
];

export interface InventoryState {
  heroId: HeroId;
  level: number;
  xp: number;
  xpToNext: number;
  weapons: Partial<Record<WeaponId, number>>;
  relics: Partial<Record<RelicId, number>>;
  souls: number;
  gold: number;
  ascensionMight?: number;
  ascensionHp?: number;
  unlockedWeapons?: BaseWeaponId[];
  purchasedExclusiveWeapons?: ExclusiveWeaponId[];
  heroUpgrades?: HeroUpgradeLevels;
  weaponForge?: Partial<Record<ForgeableWeaponId, number>>;
}

export type UpgradeKind = 'weapon' | 'relic' | 'evolution' | 'ultimate' | 'blessing';

export interface UpgradeChoice {
  uid: string;
  kind: UpgradeKind;
  weaponId?: WeaponId;
  relicId?: RelicId;
  blessingType?: 'might' | 'vitality' | 'souls' | 'gold' | 'heal';
  goldAmount?: number;
  healPercent?: number;
  iconUrl: string;
  title: string;
  subtitle: string;
  description: string;
  currentLevel: number;
  nextLevel: number;
  maxLevel: number;
  accentColor: string;
  synergyHint?: string;
}

export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 12;
  if (level <= 10) return Math.round(12 + (level - 1) * 14 + Math.pow(level - 1, 1.55) * 3);
  if (level <= 25) return Math.round(230 + (level - 10) * 34 + Math.pow(level - 10, 1.65) * 4.5);
  if (level <= 50) return Math.round(1130 + (level - 25) * 72 + Math.pow(level - 25, 1.7) * 6);
  return Math.round(4350 + (level - 50) * 140);
}

export function createInitialInventory(
  heroId: HeroId,
  unlockedWeapons?: BaseWeaponId[],
  weaponForge?: Partial<Record<ForgeableWeaponId, number>>,
  purchasedExclusiveWeapons?: ExclusiveWeaponId[],
  heroUpgrades?: HeroUpgradeLevels
): InventoryState {
  const hero = HEROES[heroId];
  const startForge = weaponForge?.[hero.startingWeapon] ?? 0;
  const startBonus = computeWeaponForgeBonus(startForge);
  return {
    heroId,
    level: 1,
    xp: 0,
    xpToNext: xpRequiredForLevel(1),
    weapons: {
      [hero.startingWeapon]: weaponForge ? startBonus.startingLevel : 1,
    },
    relics: {},
    souls: 0,
    gold: 0,
    ascensionMight: 0,
    ascensionHp: 0,
    unlockedWeapons: unlockedWeapons
      ? Array.from(new Set([...unlockedWeapons, hero.startingWeapon]))
      : undefined,
    purchasedExclusiveWeapons: purchasedExclusiveWeapons ? [...purchasedExclusiveWeapons] : [],
    heroUpgrades: heroUpgrades ? { ...heroUpgrades } : undefined,
    weaponForge: weaponForge ? { ...weaponForge } : undefined,
  };
}

export function isExclusiveWeaponUnlocked(inv: InventoryState, exId: ExclusiveWeaponId): boolean {
  if ((inv.weapons[exId] ?? 0) > 0) return true;
  return Boolean(inv.purchasedExclusiveWeapons?.includes(exId));
}

export function computeHeroWithUpgrades(
  heroId: HeroId,
  upgrades?: HeroUpgradeLevels
): HeroStats {
  const base = HEROES[heroId].baseStats;
  const vitLv = Math.max(0, Math.min(MAX_HERO_UPGRADE_LEVEL, Math.floor(upgrades?.vitality ?? 0)));
  const mightLv = Math.max(0, Math.min(MAX_HERO_UPGRADE_LEVEL, Math.floor(upgrades?.might ?? 0)));
  const agiLv = Math.max(0, Math.min(MAX_HERO_UPGRADE_LEVEL, Math.floor(upgrades?.agility ?? 0)));
  const fortLv = Math.max(0, Math.min(MAX_HERO_UPGRADE_LEVEL, Math.floor(upgrades?.fortitude ?? 0)));

  return {
    ...base,
    maxHp: Math.round(base.maxHp + vitLv * 18),
    regen: base.regen + vitLv * 0.18,
    might: base.might + mightLv * 0.07,
    moveSpeed: Math.round(base.moveSpeed + agiLv * 8),
    cooldown: Math.max(0.45, base.cooldown * Math.pow(0.975, agiLv)),
    armor: Number((base.armor + fortLv * 0.8).toFixed(2)),
    critChance: Math.min(0.85, base.critChance + fortLv * 0.025),
  };
}

export function isBaseWeaponUnlocked(inv: InventoryState, wId: BaseWeaponId): boolean {
  if ((inv.weapons[wId] ?? 0) > 0) return true;
  const evoId = WEAPONS[wId].evolvesInto;
  if (evoId && (inv.weapons[evoId] ?? 0) > 0) return true;
  const ultId = evoId ? WEAPONS[evoId].ultimateInto : undefined;
  if (ultId && (inv.weapons[ultId] ?? 0) > 0) return true;
  if (!inv.unlockedWeapons) return true;
  return inv.unlockedWeapons.includes(wId);
}

/**
 * Each catalyst relic unlocks alongside its paired synergy weapon (initial weapons
 * + hero's starting weapon + stage-discovered weapons, or if already held).
 */
export function isRelicUnlocked(inv: InventoryState, rId: RelicId): boolean {
  if ((inv.relics[rId] ?? 0) > 0) return true;
  return isBaseWeaponUnlocked(inv, RELICS[rId].synergyWeapon);
}

export function computeEffectiveStats(inv: InventoryState): HeroStats {
  const base = computeHeroWithUpgrades(inv.heroId, inv.heroUpgrades);
  const heartLv = inv.relics.black_heart ?? 0;
  const tomeLv = inv.relics.empty_tome ?? 0;
  const sealLv = inv.relics.amber_seal ?? 0;
  const candLv = inv.relics.crimson_candelabra ?? 0;
  const bloodLv = inv.relics.mercury_blood ?? 0;
  const ringLv = inv.relics.duplicator_ring ?? 0;
  const gauntletLv = inv.relics.assassin_gauntlet ?? 0;
  const orbLv = inv.relics.twilight_orb ?? 0;
  const cloverLv = inv.relics.ash_clover ?? 0;

  const kaelenBonusAmount = inv.heroId === 'kaelen' && inv.level >= 5 ? 1 : 0;
  const ascMight = inv.ascensionMight ?? 0;
  const ascHp = inv.ascensionHp ?? 0;
  // Natural HP regeneration scales smoothly with hero level progression + vitality relics
  const levelRegen = Math.max(0, inv.level - 1) * 0.12;

  return {
    maxHp: Math.round(base.maxHp * (1 + heartLv * 0.2) + ascHp),
    moveSpeed: base.moveSpeed * (1 + sealLv * 0.05),
    might: base.might + sealLv * 0.12 + orbLv * 0.1 + ascMight,
    area: base.area + candLv * 0.14 + orbLv * 0.1,
    cooldown: Math.max(0.35, base.cooldown * Math.pow(0.92, tomeLv)),
    magnet: base.magnet * (1 + bloodLv * 0.2 + cloverLv * 0.15),
    armor: base.armor + bloodLv,
    regen: base.regen + levelRegen + heartLv * 0.25 + bloodLv * 0.8,
    amount: base.amount + ringLv + kaelenBonusAmount,
    projSpeed: base.projSpeed + gauntletLv * 0.15,
    critChance: Math.min(0.88, base.critChance + gauntletLv * 0.06 + cloverLv * 0.08),
  };
}

export function getAvailableEvolutions(inv: InventoryState): EvolvedWeaponId[] {
  const ready: EvolvedWeaponId[] = [];

  for (const baseId of ALL_BASE_WEAPONS) {
    const lv = inv.weapons[baseId] ?? 0;
    const def = WEAPONS[baseId];
    const forgeBonus = computeWeaponForgeBonus(inv.weaponForge?.[baseId] ?? 0);
    const evoDef = def.evolvesInto ? WEAPONS[def.evolvesInto] : undefined;
    const hasUltimate = Boolean(evoDef?.ultimateInto && inv.weapons[evoDef.ultimateInto]);
    if (
      lv >= def.maxLevel - forgeBonus.earlyEvoDiscount &&
      def.catalystRelic &&
      (inv.relics[def.catalystRelic] ?? 0) >= 1 &&
      def.evolvesInto &&
      !inv.weapons[def.evolvesInto] &&
      !hasUltimate
    ) {
      ready.push(def.evolvesInto);
    }
  }
  return ready;
}

export function getAvailableUltimates(inv: InventoryState): UltimateWeaponId[] {
  const ready: UltimateWeaponId[] = [];

  for (const evoId of ALL_EVOLVED_WEAPONS) {
    const lv = inv.weapons[evoId] ?? 0;
    const evoDef = WEAPONS[evoId];
    const baseDef = evoDef.evolvesFrom ? WEAPONS[evoDef.evolvesFrom] : undefined;
    const catalystId = baseDef?.catalystRelic;
    if (
      lv >= evoDef.maxLevel &&
      catalystId &&
      (inv.relics[catalystId] ?? 0) >= 2 &&
      evoDef.ultimateInto &&
      !inv.weapons[evoDef.ultimateInto]
    ) {
      ready.push(evoDef.ultimateInto);
    }
  }
  return ready;
}

export function getActiveSynergyPairs(inv: InventoryState): Set<BaseWeaponId> {
  const pairs = new Set<BaseWeaponId>();
  for (const baseId of ALL_BASE_WEAPONS) {
    const def = WEAPONS[baseId];
    const evoDef = def.evolvesInto ? WEAPONS[def.evolvesInto] : undefined;
    const ultId = evoDef?.ultimateInto;
    const hasBase = (inv.weapons[baseId] ?? 0) > 0;
    const hasEvolved = Boolean(def.evolvesInto && (inv.weapons[def.evolvesInto] ?? 0) > 0);
    const hasUltimate = Boolean(ultId && (inv.weapons[ultId] ?? 0) > 0);
    const hasRelic = Boolean(def.catalystRelic && (inv.relics[def.catalystRelic] ?? 0) > 0);
    if (hasBase || hasEvolved || hasUltimate || hasRelic) {
      pairs.add(baseId);
    }
  }
  return pairs;
}

export function getMissingCatalystsForOwnedWeapons(inv: InventoryState): Set<RelicId> {
  const missing = new Set<RelicId>();
  for (const baseId of ALL_BASE_WEAPONS) {
    const def = WEAPONS[baseId];
    const evoDef = def.evolvesInto ? WEAPONS[def.evolvesInto] : undefined;
    const ultId = evoDef?.ultimateInto;
    const hasBase = (inv.weapons[baseId] ?? 0) > 0;
    const hasEvolved = Boolean(def.evolvesInto && inv.weapons[def.evolvesInto]);
    const hasUltimate = Boolean(ultId && inv.weapons[ultId]);
    if (
      (hasBase || hasEvolved) &&
      !hasUltimate &&
      def.catalystRelic &&
      !(inv.relics[def.catalystRelic] ?? 0)
    ) {
      missing.add(def.catalystRelic);
    }
  }
  return missing;
}

export function buildUpgradeChoices(
  inv: InventoryState,
  count = 3,
  rng: () => number = Math.random
): UpgradeChoice[] {
  const pool: UpgradeChoice[] = [];
  const ownedWeaponCount = Object.keys(inv.weapons).length;
  const ownedRelicCount = Object.keys(inv.relics).length;
  const activePairs = getActiveSynergyPairs(inv);
  // Lock new item pool to the 6 active weapon-catalyst pairs once 6 distinct pairs are touched,
  // guaranteeing that all 6 weapon slots can ALWAYS acquire their catalyst relic and evolve!
  const lockToActivePairs = activePairs.size >= MAX_WEAPON_SLOTS;

  // Ready Ultimates awaken on Level-Up once hero reaches mid/late game (Lv.16+) or from Boss Relic Chests!
  const allowLevelUpUltimates = !inv.unlockedWeapons || inv.level >= 16;
  const readyUltimates = allowLevelUpUltimates ? getAvailableUltimates(inv) : [];
  for (const ultId of readyUltimates) {
    const ultDef = WEAPONS[ultId];
    const evoDef = ultDef.ultimateOf ? WEAPONS[ultDef.ultimateOf] : undefined;
    const baseDef = evoDef?.evolvesFrom ? WEAPONS[evoDef.evolvesFrom] : undefined;
    const cat = baseDef?.catalystRelic ? RELICS[baseDef.catalystRelic] : undefined;
    pool.push({
      uid: `ultimate:${ultId}`,
      kind: 'ultimate',
      weaponId: ultId,
      iconUrl: getWeaponIconUrl(ultId),
      title: ultDef.name,
      subtitle: '👑 EVOLUÇÃO ULTIMATE',
      description: ultDef.descriptions[0] ?? ultDef.tagline,
      currentLevel: 0,
      nextLevel: 1,
      maxLevel: 1,
      accentColor: ultDef.iconColor,
      synergyHint: `Transcende ${evoDef?.name ?? ''}${cat ? ` + ${cat.name} Nv.2+` : ''}`,
    });
  }

  // Owned Evolved Weapons can advance Grau 1 -> Grau 3 toward their Ultimate!
  for (const evoId of ALL_EVOLVED_WEAPONS) {
    const current = inv.weapons[evoId] ?? 0;
    const def = WEAPONS[evoId];
    if (current <= 0 || current >= def.maxLevel) continue;
    if (def.ultimateInto && inv.weapons[def.ultimateInto]) continue;

    const next = current + 1;
    const baseDef = def.evolvesFrom ? WEAPONS[def.evolvesFrom] : undefined;
    const cat = baseDef?.catalystRelic ? RELICS[baseDef.catalystRelic] : undefined;
    const hasCat2 = Boolean(baseDef?.catalystRelic && (inv.relics[baseDef.catalystRelic] ?? 0) >= 2);
    const ultDef = def.ultimateInto ? WEAPONS[def.ultimateInto] : undefined;

    pool.push({
      uid: `weapon:${evoId}:${next}`,
      kind: 'weapon',
      weaponId: evoId,
      iconUrl: getWeaponIconUrl(evoId),
      title: def.name,
      subtitle: `★ Ancestral · Grau ${current} → ${next}`,
      description: def.descriptions[next - 1] ?? def.tagline,
      currentLevel: current,
      nextLevel: next,
      maxLevel: def.maxLevel,
      accentColor: def.iconColor,
      synergyHint: ultDef
        ? hasCat2
          ? `👑 Rumo à Ultimate: ${ultDef.name}`
          : `Ultimate com ${cat?.name ?? 'Relíquia'} Nv.2+`
        : undefined,
    });
  }

  for (const wId of ALL_BASE_WEAPONS) {
    const def = WEAPONS[wId];
    const evoDef = def.evolvesInto ? WEAPONS[def.evolvesInto] : undefined;
    if (def.evolvesInto && inv.weapons[def.evolvesInto]) continue;
    if (evoDef?.ultimateInto && inv.weapons[evoDef.ultimateInto]) continue;

    const current = inv.weapons[wId] ?? 0;
    if (current >= def.maxLevel) continue;
    if (current === 0 && !isBaseWeaponUnlocked(inv, wId)) continue;
    if (current === 0 && ownedWeaponCount >= MAX_WEAPON_SLOTS) continue;
    if (current === 0 && lockToActivePairs && !activePairs.has(wId)) continue;

    const forgeBonus = computeWeaponForgeBonus(inv.weaponForge?.[wId] ?? 0);
    const next =
      current === 0 ? Math.min(def.maxLevel, forgeBonus.startingLevel) : current + 1;
    const catalyst = def.catalystRelic ? RELICS[def.catalystRelic] : undefined;
    const hasCatalyst = def.catalystRelic ? (inv.relics[def.catalystRelic] ?? 0) > 0 : false;

    pool.push({
      uid: `weapon:${wId}:${next}`,
      kind: 'weapon',
      weaponId: wId,
      iconUrl: getWeaponIconUrl(wId),
      title: def.name,
      subtitle:
        current === 0
          ? next > 1
            ? `Nova Arma (Forjada Nv.${next})`
            : 'Nova Arma Sagrada'
          : `Grau ${current} → ${next}`,
      description: def.descriptions[next - 1] ?? def.tagline,
      currentLevel: current,
      nextLevel: next,
      maxLevel: def.maxLevel,
      accentColor: def.iconColor,
      synergyHint: catalyst
        ? hasCatalyst
          ? `★ Ressonância pronta com ${catalyst.name}`
          : `Evolui com: ${catalyst.name}`
        : undefined,
    });
  }

  // Purchased Exclusive Gold-Shop Legendary Weapons (Lv.1 -> Lv.5 + Out-of-Game Forge scaling)
  for (const exId of ALL_EXCLUSIVE_WEAPONS) {
    if (!isExclusiveWeaponUnlocked(inv, exId)) continue;
    const def = WEAPONS[exId];
    const current = inv.weapons[exId] ?? 0;
    if (current >= def.maxLevel) continue;
    if (current === 0 && ownedWeaponCount >= MAX_WEAPON_SLOTS) continue;

    const forgeBonus = computeWeaponForgeBonus(inv.weaponForge?.[exId] ?? 0);
    const next =
      current === 0 ? Math.min(def.maxLevel, forgeBonus.startingLevel) : current + 1;

    pool.push({
      uid: `weapon:${exId}:${next}`,
      kind: 'weapon',
      weaponId: exId,
      iconUrl: getWeaponIconUrl(exId),
      title: def.name,
      subtitle:
        current === 0
          ? next > 1
            ? `✦ Arma Exclusiva (Forjada Nv.${next})`
            : '✦ Arma Exclusiva de Ouro'
          : `✦ Exclusiva · Grau ${current} → ${next}`,
      description: def.descriptions[next - 1] ?? def.tagline,
      currentLevel: current,
      nextLevel: next,
      maxLevel: def.maxLevel,
      accentColor: def.iconColor,
      synergyHint: '✦ Arma Lendária do Arsenal de Ouro',
    });
  }

  for (const rId of ALL_RELICS) {
    const def = RELICS[rId];
    const current = inv.relics[rId] ?? 0;
    if (current >= def.maxLevel) continue;
    if (current === 0 && ownedRelicCount >= MAX_RELIC_SLOTS) continue;
    if (current === 0 && !isRelicUnlocked(inv, rId)) continue;
    if (current === 0 && lockToActivePairs && !activePairs.has(def.synergyWeapon)) {
      continue;
    }

    const next = current + 1;
    const synWeapon = WEAPONS[def.synergyWeapon];
    const synEvoDef = synWeapon.evolvesInto ? WEAPONS[synWeapon.evolvesInto] : undefined;
    const hasWeapon =
      (inv.weapons[def.synergyWeapon] ?? 0) > 0 ||
      Boolean(synWeapon.evolvesInto && inv.weapons[synWeapon.evolvesInto]) ||
      Boolean(synEvoDef?.ultimateInto && inv.weapons[synEvoDef.ultimateInto]);

    pool.push({
      uid: `relic:${rId}:${next}`,
      kind: 'relic',
      relicId: rId,
      iconUrl: getRelicIconUrl(rId),
      title: def.name,
      subtitle: current === 0 ? 'Nova Relíquia Passiva' : `Grau ${current} → ${next}`,
      description: def.bonusPerLevel,
      currentLevel: current,
      nextLevel: next,
      maxLevel: def.maxLevel,
      accentColor: def.iconColor,
      synergyHint: hasWeapon
        ? `★ Catalisador da sua arma: ${synWeapon.name}`
        : `Catalisa: ${synWeapon.name}`,
    });
  }

  const goldReward = Math.round(350 + inv.level * 15);
  const maxBuildChoices: UpgradeChoice[] = [
    {
      uid: 'blessing:gold',
      kind: 'blessing',
      blessingType: 'gold',
      goldAmount: goldReward,
      iconUrl: './art/sprites/pickup_gold_coin.webp',
      title: `Bolsa de Ouro (+${goldReward})`,
      subtitle: 'Arsenal no Máximo · Fortuna',
      description: `Recebe +${goldReward} Moedas de Ouro para comprar Armas Exclusivas, forjar armas e evoluir heróis.`,
      currentLevel: 0,
      nextLevel: 1,
      maxLevel: 99,
      accentColor: '#ffd166',
    },
    {
      uid: 'blessing:heal',
      kind: 'blessing',
      blessingType: 'heal',
      healPercent: 0.45,
      iconUrl: './art/sprites/pickup_blood_chalice.webp',
      title: 'Cálice da Vitalidade',
      subtitle: 'Arsenal no Máximo · Cura',
      description: 'Restaura imediatamente 45% da sua Vida Máxima para sustentar o combate.',
      currentLevel: 0,
      nextLevel: 1,
      maxLevel: 99,
      accentColor: '#ff4d6d',
    },
  ];

  // When all equipped/available weapons & relics are completely maxed, offer the exact 2 player choices: Gold OR Heal!
  if (pool.length === 0) {
    return maxBuildChoices;
  }

  const weighted = pool.map((choice) => {
    let weight = 1.0;
    if (choice.kind === 'ultimate') weight = 4.8;
    else {
      if (choice.currentLevel > 0) weight += 0.9;
      if (choice.weaponId && WEAPONS[choice.weaponId].isExclusive) weight += 0.55;
      if (choice.synergyHint?.startsWith('★') || choice.synergyHint?.startsWith('👑')) weight += 1.45;
    }
    return { choice, sortKey: Math.pow(rng(), 1 / weight) };
  });
  weighted.sort((a, b) => b.sortKey - a.sortKey);

  const selected = weighted.slice(0, count).map((w) => w.choice);

  let fbIdx = 0;
  while (selected.length < count && fbIdx < maxBuildChoices.length) {
    selected.push(maxBuildChoices[fbIdx++]);
  }

  return selected;
}

export function applyUpgradeChoice(
  inv: InventoryState,
  choice: UpgradeChoice
): { healedHp: number; evolvedWeapon?: WeaponId; goldGained?: number } {
  let healedHp = 0;
  let evolvedWeapon: WeaponId | undefined;
  let goldGained = 0;

  if (choice.kind === 'weapon' && choice.weaponId) {
    const wId = choice.weaponId;
    const prevLv = inv.weapons[wId] ?? 0;
    const wDef = WEAPONS[wId];
    if (prevLv === 0 && !wDef.isEvolved && !wDef.isUltimate) {
      const forgeBonus = computeWeaponForgeBonus(inv.weaponForge?.[wId as ForgeableWeaponId] ?? 0);
      inv.weapons[wId] = Math.min(wDef.maxLevel, Math.max(choice.nextLevel, forgeBonus.startingLevel));
    } else {
      inv.weapons[wId] = choice.nextLevel;
    }
  } else if (choice.kind === 'relic' && choice.relicId) {
    inv.relics[choice.relicId] = choice.nextLevel;
    if (choice.relicId === 'black_heart') {
      healedHp += 20;
    }
  } else if (choice.kind === 'evolution' && choice.weaponId) {
    const evoDef = WEAPONS[choice.weaponId];
    if (evoDef.evolvesFrom) {
      delete inv.weapons[evoDef.evolvesFrom];
    }
    inv.weapons[choice.weaponId] = 1;
    evolvedWeapon = choice.weaponId;
    healedHp += 35;
  } else if (choice.kind === 'ultimate' && choice.weaponId) {
    const ultDef = WEAPONS[choice.weaponId];
    if (ultDef.ultimateOf) {
      delete inv.weapons[ultDef.ultimateOf];
    }
    inv.weapons[choice.weaponId] = 1;
    evolvedWeapon = choice.weaponId;
    healedHp += 50;
  } else if (choice.kind === 'blessing') {
    if (choice.blessingType === 'gold') {
      const amt = choice.goldAmount ?? Math.round(350 + inv.level * 15);
      inv.gold = (inv.gold ?? 0) + amt;
      goldGained = amt;
    } else if (choice.blessingType === 'heal') {
      const eff = computeEffectiveStats(inv);
      healedHp += Math.max(25, Math.round(eff.maxHp * (choice.healPercent ?? 0.45)));
    } else if (choice.blessingType === 'might') {
      inv.ascensionMight = (inv.ascensionMight ?? 0) + 0.1;
    } else if (choice.blessingType === 'vitality') {
      inv.ascensionHp = (inv.ascensionHp ?? 0) + 20;
      healedHp += 45;
    } else {
      healedHp += 25;
      inv.souls += 45;
    }
  }

  return { healedHp, evolvedWeapon, goldGained };
}

export function resolveRelicChest(
  inv: InventoryState,
  rng: () => number = Math.random,
  allowEvolution = true,
  allowUltimate = true
): UpgradeChoice {
  const ultimates = allowUltimate ? getAvailableUltimates(inv) : [];
  if (ultimates.length > 0) {
    const ultId = ultimates[Math.floor(rng() * ultimates.length)];
    const ultDef = WEAPONS[ultId];
    return {
      uid: `ultimate:${ultId}`,
      kind: 'ultimate',
      weaponId: ultId,
      iconUrl: getWeaponIconUrl(ultId),
      title: ultDef.name,
      subtitle: '👑 EVOLUÇÃO ULTIMATE DESPERTA 👑',
      description: ultDef.tagline,
      currentLevel: 0,
      nextLevel: 1,
      maxLevel: 1,
      accentColor: ultDef.iconColor,
    };
  }

  const evolutions = allowEvolution ? getAvailableEvolutions(inv) : [];
  if (evolutions.length > 0) {
    const evoId = evolutions[Math.floor(rng() * evolutions.length)];
    const evoDef = WEAPONS[evoId];
    return {
      uid: `evolution:${evoId}`,
      kind: 'evolution',
      weaponId: evoId,
      iconUrl: getWeaponIconUrl(evoId),
      title: evoDef.name,
      subtitle: '★ EVOLUÇÃO ANCESTRAL DESPERTA ★',
      description: evoDef.tagline,
      currentLevel: 0,
      nextLevel: 1,
      maxLevel: 1,
      accentColor: evoDef.iconColor,
    };
  }

  const upgradable = buildUpgradeChoices(inv, 6, rng).filter((c) => c.currentLevel > 0);
  if (upgradable.length > 0) {
    return upgradable[Math.floor(rng() * upgradable.length)];
  }
  const anyChoices = buildUpgradeChoices(inv, 3, rng);
  return anyChoices[0];
}

export interface IntraMatchEscalation {
  act: 1 | 2 | 3 | 4;
  actName: string;
  hpMult: number;
  dmgMult: number;
  spdMult: number;
  xpMult: number;
  knockbackBonus: number;
  maxHorde: number;
  spawnsPerSecond: number;
  packSize: number;
  powerPressure: number;
}

/**
 * Computes adaptive enemy pressure based on hero level, total weapon/relic upgrades,
 * Evolved/Ultimate awakenings, and Limit Break stacks so the horde always pushes back fiercely.
 */
export function computePlayerPowerPressure(inv: InventoryState): number {
  let evolvedCount = 0;
  let ultimateCount = 0;
  let totalWeaponLevels = 0;
  for (const wId of Object.keys(inv.weapons) as WeaponId[]) {
    const lv = inv.weapons[wId] ?? 0;
    if (lv <= 0) continue;
    const def = WEAPONS[wId];
    if (def.isUltimate) {
      ultimateCount += 1;
      totalWeaponLevels += 8;
    } else if (def.isEvolved) {
      evolvedCount += 1;
      totalWeaponLevels += 5 + lv;
    } else if (def.isExclusive) {
      totalWeaponLevels += Math.round(lv * 1.25);
    } else {
      totalWeaponLevels += lv;
    }
  }
  let totalRelicLevels = 0;
  for (const rId of Object.keys(inv.relics) as RelicId[]) {
    totalRelicLevels += inv.relics[rId] ?? 0;
  }
  return (
    1 +
    Math.max(0, inv.level - 3) * 0.055 +
    Math.max(0, totalWeaponLevels - 2) * 0.055 +
    totalRelicLevels * 0.04 +
    evolvedCount * 0.42 +
    ultimateCount * 0.95 +
    (inv.ascensionMight ?? 0) * 1.25
  );
}

/**
 * Computes continuous intra-match horde size, spawn cadence, enemy toughness, damage, speed,
 * and knockback resistance across all 4 acts — balanced for Normal and fierce in Hard/Epic/HOLI SHIT!.
 */
export function computeIntraMatchEscalation(
  elapsedSeconds: number,
  difficultyId: DifficultyId,
  inv: InventoryState
): IntraMatchEscalation {
  const mins = Math.max(0, elapsedSeconds / 60);
  const d = DIFFICULTIES[difficultyId] ?? DIFFICULTIES.normal;
  const powerPressure = computePlayerPowerPressure(inv);

  const act: 1 | 2 | 3 | 4 = mins < 10 ? 1 : mins < 20 ? 2 : mins < 30 ? 3 : 4;
  const actName =
    act === 1
      ? 'Ato I · Primeiro Véu'
      : act === 2
        ? 'Ato II · Sangue Crescente'
        : act === 3
          ? 'Ato III · Noite Profunda'
          : 'Ato IV · Apocalipse Carmesim';

  const timeHp = 1 + mins * 0.34 + Math.pow(mins, d.timeRampExponent) * 0.11;
  const hpMult = timeHp * powerPressure * d.hpMult;
  const dmgMult = (1 + mins * 0.095 + Math.pow(mins / 7, 1.35) * 0.38) * d.dmgMult;
  const spdMult = Math.min(2.6, (1 + mins * 0.017) * d.spdMult);
  const xpMult = (0.85 + mins * 0.025) * d.xpMult;
  const knockbackBonus = Math.min(0.45, mins * 0.013);
  const maxHorde = Math.min(
    640,
    Math.round((80 + mins * 16 + Math.pow(mins, 1.32) * 2.2) * d.hordeMult)
  );
  const spawnsPerSecond =
    (4.2 + mins * 0.95 + Math.pow(mins / 5, 1.42) * 1.25) * d.spawnRateMult;
  const packSize = 1 + Math.floor(mins / 4);

  return {
    act,
    actName,
    hpMult,
    dmgMult,
    spdMult,
    xpMult,
    knockbackBonus,
    maxHorde,
    spawnsPerSecond,
    packSize,
    powerPressure,
  };
}

/**
 * Anti-bullet-hell balanced spawner:
 * - Horde surges (circle waves) are STRICTLY melee (ZERO pure-ranged waves!).
 * - Normal spawns cap active ranged enemies (mages, archers, catapults, gargoyles)
 *   to <= 24% of active units AND a hard simultaneous cap + catapult cap so combat
 *   remains tactical, readable, and dodgeable at all times.
 */
export function pickBalancedSpawnKind(
  stagePool: EnemyKind[],
  activeKinds: EnemyKind[],
  difficultyId: DifficultyId,
  isHordeSurge = false,
  rng: () => number = Math.random
): EnemyKind {
  const meleePool = stagePool.filter((k) => !ENEMIES[k].isRanged);
  const pickFrom = (arr: EnemyKind[]) => arr[Math.floor(rng() * arr.length)] ?? stagePool[0];

  if (meleePool.length === 0) {
    return pickFrom(stagePool);
  }

  // Rule 1: NEVER spawn a horde surge composed of ranged units!
  if (isHordeSurge) {
    return pickFrom(meleePool);
  }

  const candidate = pickFrom(stagePool);
  if (!ENEMIES[candidate].isRanged) {
    return candidate;
  }

  const maxRangedByDiff: Record<DifficultyId, number> = {
    normal: 6,
    hard: 8,
    epic: 10,
    holi_shit: 12,
  };
  const maxCatapults = difficultyId === 'epic' || difficultyId === 'holi_shit' ? 3 : 2;
  const maxRanged = maxRangedByDiff[difficultyId] ?? 6;

  let activeRanged = 0;
  let activeCatapults = 0;
  for (const k of activeKinds) {
    if (ENEMIES[k]?.isRanged) activeRanged += 1;
    if (k === 'catapult') activeCatapults += 1;
  }

  const totalActive = activeKinds.length;
  const ratioBlocked =
    totalActive < 6 ? activeRanged >= 1 : activeRanged / Math.max(1, totalActive) >= 0.24;

  if (
    activeRanged >= maxRanged ||
    ratioBlocked ||
    (candidate === 'catapult' && activeCatapults >= maxCatapults)
  ) {
    return pickFrom(meleePool);
  }

  return candidate;
}
