import {
  BaseWeaponId,
  EvolvedWeaponId,
  HEROES,
  HeroId,
  HeroStats,
  RELICS,
  RelicId,
  WEAPONS,
  WeaponId,
} from '../data/loreData';

export const MAX_WEAPON_SLOTS = 6;
export const MAX_RELIC_SLOTS = 6;

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
}

export type UpgradeKind = 'weapon' | 'relic' | 'evolution' | 'blessing';

export interface UpgradeChoice {
  uid: string;
  kind: UpgradeKind;
  weaponId?: WeaponId;
  relicId?: RelicId;
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
  if (level <= 1) return 10;
  if (level < 10) return Math.round(10 + (level - 1) * 9);
  if (level < 25) return Math.round(92 + (level - 10) * 16);
  return Math.round(332 + (level - 25) * 26);
}

export function createInitialInventory(heroId: HeroId): InventoryState {
  const hero = HEROES[heroId];
  return {
    heroId,
    level: 1,
    xp: 0,
    xpToNext: xpRequiredForLevel(1),
    weapons: {
      [hero.startingWeapon]: 1,
    },
    relics: {},
    souls: 0,
  };
}

export function computeEffectiveStats(inv: InventoryState): HeroStats {
  const base = HEROES[inv.heroId].baseStats;
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

  return {
    maxHp: Math.round(base.maxHp * (1 + heartLv * 0.2)),
    moveSpeed: base.moveSpeed * (1 + sealLv * 0.05),
    might: base.might + sealLv * 0.12 + orbLv * 0.1,
    area: base.area + candLv * 0.14 + orbLv * 0.1,
    cooldown: Math.max(0.36, base.cooldown * Math.pow(0.92, tomeLv)),
    magnet: base.magnet * (1 + bloodLv * 0.2 + cloverLv * 0.15),
    armor: base.armor + bloodLv,
    regen: base.regen + bloodLv * 0.8,
    amount: base.amount + ringLv + kaelenBonusAmount,
    projSpeed: base.projSpeed + gauntletLv * 0.15,
    critChance: Math.min(0.85, base.critChance + gauntletLv * 0.06 + cloverLv * 0.08),
  };
}

export function getAvailableEvolutions(inv: InventoryState): EvolvedWeaponId[] {
  const ready: EvolvedWeaponId[] = [];

  for (const baseId of ALL_BASE_WEAPONS) {
    const lv = inv.weapons[baseId] ?? 0;
    const def = WEAPONS[baseId];
    if (
      lv >= def.maxLevel &&
      def.catalystRelic &&
      (inv.relics[def.catalystRelic] ?? 0) >= 1 &&
      def.evolvesInto &&
      !inv.weapons[def.evolvesInto]
    ) {
      ready.push(def.evolvesInto);
    }
  }
  return ready;
}

export function buildUpgradeChoices(
  inv: InventoryState,
  count = 3,
  rng: () => number = Math.random
): UpgradeChoice[] {
  const pool: UpgradeChoice[] = [];
  const ownedWeaponCount = Object.keys(inv.weapons).length;
  const ownedRelicCount = Object.keys(inv.relics).length;

  for (const wId of ALL_BASE_WEAPONS) {
    const def = WEAPONS[wId];
    if (def.evolvesInto && inv.weapons[def.evolvesInto]) continue;

    const current = inv.weapons[wId] ?? 0;
    if (current >= def.maxLevel) continue;
    if (current === 0 && ownedWeaponCount >= MAX_WEAPON_SLOTS) continue;

    const next = current + 1;
    const catalyst = def.catalystRelic ? RELICS[def.catalystRelic] : undefined;
    const hasCatalyst = def.catalystRelic ? (inv.relics[def.catalystRelic] ?? 0) > 0 : false;

    pool.push({
      uid: `weapon:${wId}:${next}`,
      kind: 'weapon',
      weaponId: wId,
      title: def.name,
      subtitle: current === 0 ? 'Nova Arma Sagrada' : `Grau ${current} → ${next}`,
      description: def.descriptions[next - 1] ?? def.tagline,
      currentLevel: current,
      nextLevel: next,
      maxLevel: def.maxLevel,
      accentColor: def.iconColor,
      synergyHint: catalyst
        ? hasCatalyst
          ? `✦ Ressonância pronta com ${catalyst.name}`
          : `Evolui com: ${catalyst.name}`
        : undefined,
    });
  }

  for (const rId of ALL_RELICS) {
    const def = RELICS[rId];
    const current = inv.relics[rId] ?? 0;
    if (current >= def.maxLevel) continue;
    if (current === 0 && ownedRelicCount >= MAX_RELIC_SLOTS) continue;

    const next = current + 1;
    const synWeapon = WEAPONS[def.synergyWeapon];
    const hasWeapon =
      (inv.weapons[def.synergyWeapon] ?? 0) > 0 ||
      Boolean(synWeapon.evolvesInto && inv.weapons[synWeapon.evolvesInto]);

    pool.push({
      uid: `relic:${rId}:${next}`,
      kind: 'relic',
      relicId: rId,
      title: def.name,
      subtitle: current === 0 ? 'Nova Relíquia Passiva' : `Grau ${current} → ${next}`,
      description: def.bonusPerLevel,
      currentLevel: current,
      nextLevel: next,
      maxLevel: def.maxLevel,
      accentColor: def.iconColor,
      synergyHint: hasWeapon
        ? `✦ Catalisador ativo p/ ${synWeapon.name}`
        : `Catalisa: ${synWeapon.name}`,
    });
  }

  const weighted = pool.map((choice) => {
    let weight = 1.0;
    if (choice.currentLevel > 0) weight += 0.65;
    if (choice.synergyHint?.startsWith('✦')) weight += 0.45;
    return { choice, sortKey: Math.pow(rng(), 1 / weight) };
  });
  weighted.sort((a, b) => b.sortKey - a.sortKey);

  const selected = weighted.slice(0, count).map((w) => w.choice);

  if (selected.length === 0) {
    selected.push({
      uid: 'blessing:chalice',
      kind: 'blessing',
      title: 'Cálice de Cinza Pura',
      subtitle: 'Bênção Perpétua',
      description: 'Restaura 40 Pontos de Vida e concede +30 Estilhaços de Alma.',
      currentLevel: 0,
      nextLevel: 1,
      maxLevel: 1,
      accentColor: '#ffd166',
    });
  }

  return selected;
}

export function applyUpgradeChoice(
  inv: InventoryState,
  choice: UpgradeChoice
): { healedHp: number; evolvedWeapon?: EvolvedWeaponId } {
  let healedHp = 0;
  let evolvedWeapon: EvolvedWeaponId | undefined;

  if (choice.kind === 'weapon' && choice.weaponId) {
    inv.weapons[choice.weaponId] = choice.nextLevel;
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
    evolvedWeapon = choice.weaponId as EvolvedWeaponId;
    healedHp += 35;
  } else if (choice.kind === 'blessing') {
    healedHp += 40;
    inv.souls += 30;
  }

  return { healedHp, evolvedWeapon };
}

export function resolveRelicChest(
  inv: InventoryState,
  rng: () => number = Math.random
): UpgradeChoice {
  const evolutions = getAvailableEvolutions(inv);
  if (evolutions.length > 0) {
    const evoId = evolutions[Math.floor(rng() * evolutions.length)];
    const evoDef = WEAPONS[evoId];
    return {
      uid: `evolution:${evoId}`,
      kind: 'evolution',
      weaponId: evoId,
      title: evoDef.name,
      subtitle: '✦ EVOLUÇÃO ANCESTRAL DESPERTA ✦',
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
