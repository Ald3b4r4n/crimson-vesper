export type HeroId = 'alaric' | 'seraphina' | 'kaelen';

export type BaseWeaponId = 'whip' | 'wand' | 'bible' | 'axe' | 'thurible' | 'lightning';
export type EvolvedWeaponId =
  | 'blood_rose'
  | 'star_torrent'
  | 'immortal_vesper'
  | 'eclipse_scythe'
  | 'devouring_shroud'
  | 'seven_judgment';
export type WeaponId = BaseWeaponId | EvolvedWeaponId;

export type RelicId =
  | 'black_heart'
  | 'empty_tome'
  | 'amber_seal'
  | 'crimson_candelabra'
  | 'mercury_blood'
  | 'duplicator_ring';

export type EnemyKind =
  | 'bat'
  | 'flagellant'
  | 'dryad'
  | 'mist_steed'
  | 'acolyte'
  | 'hollow_knight'
  | 'fenrir'
  | 'malakor'
  | 'reaper';

export interface HeroStats {
  maxHp: number;
  moveSpeed: number;
  might: number; // Damage multiplier (1.0 = 100%)
  area: number; // Area multiplier (1.0 = 100%)
  cooldown: number; // Cooldown multiplier (lower is faster, e.g. 0.88)
  magnet: number; // Pickup radius in px
  armor: number; // Flat damage reduction
  regen: number; // HP per second
  amount: number; // Bonus projectiles
}

export interface HeroDefinition {
  id: HeroId;
  name: string;
  epithet: string;
  startingWeapon: BaseWeaponId;
  cloakColor: number;
  accentColor: number;
  trimColor: string;
  perkSummary: string;
  lore: string;
  quote: string;
  baseStats: HeroStats;
}

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  isEvolved?: boolean;
  evolvesFrom?: BaseWeaponId;
  catalystRelic?: RelicId;
  evolvesInto?: EvolvedWeaponId;
  maxLevel: number;
  iconColor: string;
  tagline: string;
  descriptions: string[];
}

export interface RelicDefinition {
  id: RelicId;
  name: string;
  maxLevel: number;
  iconColor: string;
  synergyWeapon: BaseWeaponId;
  tagline: string;
  bonusPerLevel: string;
}

export interface EnemyDefinition {
  kind: EnemyKind;
  name: string;
  isBoss?: boolean;
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  xpValue: number;
  gemTier: 'sapphire' | 'amber' | 'ruby';
  scale: number;
  knockbackResist: number; // 0 = full knockback, 1 = immune
}

export const HEROES: Record<HeroId, HeroDefinition> = {
  alaric: {
    id: 'alaric',
    name: 'Alaric Belmont',
    epithet: 'O Flagelador da Cinza',
    startingWeapon: 'whip',
    cloakColor: 0x2d5a3c,
    accentColor: 0xd4af37,
    trimColor: '#4ca66b',
    perkSummary: '+20 Vida Máxima · +15% Área de Corte',
    lore: 'Último inquisidor renegado de Valen. Seu chicote foi trançado em prata lunar e banhado nas cinzas dos santos que se recusaram a ajoelhar diante dos Cardeais.',
    quote: '“A noite deles é longa, mas minha corrente alcança cada sombra.”',
    baseStats: {
      maxHp: 120,
      moveSpeed: 168,
      might: 1.0,
      area: 1.15,
      cooldown: 1.0,
      magnet: 95,
      armor: 1,
      regen: 0.2,
      amount: 0,
    },
  },
  seraphina: {
    id: 'seraphina',
    name: 'Seraphina de Noctis',
    epithet: 'A Tecelã Astral',
    startingWeapon: 'wand',
    cloakColor: 0x4b2e83,
    accentColor: 0x7fd8ff,
    trimColor: '#7fd8ff',
    perkSummary: '+15% Velocidade · -12% Recarga · +25% Ímã de Éter',
    lore: 'Astrônoma da Torre de Marfim que perdeu a visão mortal ao fitar o Sol ser cravado por lanças de obsidiana. Hoje enxerga apenas as correntes puras do Éter.',
    quote: '“Mesmo despedaçada, a luz ainda lembra como queimar.”',
    baseStats: {
      maxHp: 95,
      moveSpeed: 192,
      might: 1.0,
      area: 1.0,
      cooldown: 0.88,
      magnet: 120,
      armor: 0,
      regen: 0.15,
      amount: 0,
    },
  },
  kaelen: {
    id: 'kaelen',
    name: 'Sor Kaelen',
    epithet: 'O Penitente de Ferro',
    startingWeapon: 'axe',
    cloakColor: 0x8b1e24,
    accentColor: 0xe2c07d,
    trimColor: '#e0535b',
    perkSummary: '+3 Armadura · +20% Poder de Dano · +15 Vida Máxima',
    lore: 'Antigo capitão da Guarda Cardeal amaldiçoado por desafiar o Conclave. Sua armadura partida ecoa os lamentos daqueles que jurou vingar.',
    quote: '“Não peço perdão ao Sol. Peço apenas peso no meu ferro.”',
    baseStats: {
      maxHp: 135,
      moveSpeed: 156,
      might: 1.2,
      area: 1.05,
      cooldown: 1.02,
      magnet: 90,
      armor: 3,
      regen: 0.3,
      amount: 0,
    },
  },
};

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  whip: {
    id: 'whip',
    name: 'Açoite Consagrado',
    catalystRelic: 'black_heart',
    evolvesInto: 'blood_rose',
    maxLevel: 5,
    iconColor: '#e8d8a8',
    tagline: 'Corte horizontal elegante que varre hordas próximas.',
    descriptions: [
      'Desfere um arco cortante horizontal à frente.',
      'Golpeia também às costas do herói (+1 corte).',
      '+30% de dano base e +15% de área do açoite.',
      'Reduz a recarga e amplia o empurrão sagrado.',
      'Mestre: cortes duplos luminosos com +45% de dano.',
    ],
  },
  wand: {
    id: 'wand',
    name: 'Cetro de Estilhaços',
    catalystRelic: 'empty_tome',
    evolvesInto: 'star_torrent',
    maxLevel: 5,
    iconColor: '#67d4ff',
    tagline: 'Dispara lanças astrais contra o inimigo mais próximo.',
    descriptions: [
      'Lança um estilhaço astral teleguiado na ameaça mais próxima.',
      'Dispara +1 projétil adicional em rápida sucessão.',
      'Projéteis atravessam +1 inimigo e causam +25% de dano.',
      '+1 projétil adicional e recarga 18% mais rápida.',
      'Mestre: rajada de lanças perfurantes de alta velocidade.',
    ],
  },
  bible: {
    id: 'bible',
    name: 'Bíblia das Cinzas',
    catalystRelic: 'amber_seal',
    evolvesInto: 'immortal_vesper',
    maxLevel: 5,
    iconColor: '#f5b942',
    tagline: 'Escrituras flamejantes orbitam e repelem quem se aproxima.',
    descriptions: [
      '2 grimórios sagrados orbitam ao redor do Juramentado.',
      '+1 grimório orbital e +20% de raio de proteção.',
      'Aumenta a velocidade de rotação e o dano em +30%.',
      '+1 grimório orbital e maior duração ativa.',
      'Mestre: 5 escrituras ardentes com forte repulsão.',
    ],
  },
  axe: {
    id: 'axe',
    name: 'Machado do Carrasco',
    catalystRelic: 'crimson_candelabra',
    evolvesInto: 'eclipse_scythe',
    maxLevel: 5,
    iconColor: '#b993ff',
    tagline: 'Arcos pesados de alto dano crítico que perfuram fileiras.',
    descriptions: [
      'Arremessa um machado pesado em arco ascendente.',
      '+1 machado arremessado e +20% de dano crítico.',
      'Atravessa até 5 inimigos com +25% de tamanho.',
      '+1 machado adicional e menor tempo de recarga.',
      'Mestre: chuva de lâminas colossais que rasgam a horda.',
    ],
  },
  thurible: {
    id: 'thurible',
    name: 'Turíbulo Sagrado',
    catalystRelic: 'mercury_blood',
    evolvesInto: 'devouring_shroud',
    maxLevel: 5,
    iconColor: '#7be0ad',
    tagline: 'Emana uma aura mística contínua que queima enxames.',
    descriptions: [
      'Cria um círculo consagrado que fere inimigos próximos.',
      '+25% de raio da aura e pulso mais frequente.',
      'Enfraquece a resistência a recuo dos inimigos e +35% dano.',
      '+25% de raio adicional e desacelera quem entra no círculo.',
      'Mestre: santuário incandescente que pulveriza enxames menores.',
    ],
  },
  lightning: {
    id: 'lightning',
    name: 'Anel do Trovão Rubro',
    catalystRelic: 'duplicator_ring',
    evolvesInto: 'seven_judgment',
    maxLevel: 5,
    iconColor: '#ff5d73',
    tagline: 'Relâmpagos escarlates caem do céu com impacto explosivo.',
    descriptions: [
      'Fulmina inimigos aleatórios com um raio escarlate em área.',
      '+1 raio por invocação e +20% de área de choque.',
      '+35% de dano elétrico e recarga reduzida.',
      '+1 raio adicional e ondas de choque mais largas.',
      'Mestre: tempestade implacável de trovões rubros.',
    ],
  },
  // EVOLVED WEAPONS
  blood_rose: {
    id: 'blood_rose',
    name: 'Rosa Sangrenta',
    isEvolved: true,
    evolvesFrom: 'whip',
    maxLevel: 1,
    iconColor: '#ff2a55',
    tagline: 'EVOLUÇÃO: Cortes cruzados carmesins que causam crítico e drenam vida.',
    descriptions: ['Cortes imperiais carmesins que curam o herói a cada massacre.'],
  },
  star_torrent: {
    id: 'star_torrent',
    name: 'Torrente Estelar',
    isEvolved: true,
    evolvesFrom: 'wand',
    maxLevel: 1,
    iconColor: '#9ef0ff',
    tagline: 'EVOLUÇÃO: Fluxo contínuo de cometas astrais teleguiados sem pausa.',
    descriptions: ['Dispara cometas astrais perfurantes em cadência ininterrupta.'],
  },
  immortal_vesper: {
    id: 'immortal_vesper',
    name: 'Véspera Imortal',
    isEvolved: true,
    evolvesFrom: 'bible',
    maxLevel: 1,
    iconColor: '#ffd966',
    tagline: 'EVOLUÇÃO: Anel perpétuo de 6 escrituras solares que jamais se apaga.',
    descriptions: ['Seis grimórios solares giram eternamente em velocidade letal.'],
  },
  eclipse_scythe: {
    id: 'eclipse_scythe',
    name: 'Foice do Eclipse',
    isEvolved: true,
    evolvesFrom: 'axe',
    maxLevel: 1,
    iconColor: '#d08bff',
    tagline: 'EVOLUÇÃO: Foices espectrais voam em espiral 360° atravessando toda a tela.',
    descriptions: ['Ceifa tudo ao redor com foices lunares perfurantes infinitas.'],
  },
  devouring_shroud: {
    id: 'devouring_shroud',
    name: 'Mortalha Devoradora',
    isEvolved: true,
    evolvesFrom: 'thurible',
    maxLevel: 1,
    iconColor: '#ff477e',
    tagline: 'EVOLUÇÃO: Vórtice carmesim que drena a alma da horda e regenera o portador.',
    descriptions: ['Campo abissal gigante que dissolve inimigos e restaura vitalidade.'],
  },
  seven_judgment: {
    id: 'seven_judgment',
    name: 'Julgamento dos Sete',
    isEvolved: true,
    evolvesFrom: 'lightning',
    maxLevel: 1,
    iconColor: '#ff9e44',
    tagline: 'EVOLUÇÃO: Relâmpagos solares duplos que deixam solo consagrado em chamas.',
    descriptions: ['Fúria celestial encadeada sobre toda a Floresta dos Lamentos.'],
  },
};

export const RELICS: Record<RelicId, RelicDefinition> = {
  black_heart: {
    id: 'black_heart',
    name: 'Coração Negro',
    maxLevel: 5,
    iconColor: '#e63956',
    synergyWeapon: 'whip',
    tagline: 'Aumenta a Vida Máxima em +20% por nível.',
    bonusPerLevel: '+20% Vida Máxima e cura imediata de 18 HP.',
  },
  empty_tome: {
    id: 'empty_tome',
    name: 'Tomo Vazio',
    maxLevel: 5,
    iconColor: '#5bc0eb',
    synergyWeapon: 'wand',
    tagline: 'Reduz o tempo de recarga das armas em -8% por nível.',
    bonusPerLevel: '-8% Tempo de Recarga de todas as armas.',
  },
  amber_seal: {
    id: 'amber_seal',
    name: 'Selo de Âmbar',
    maxLevel: 5,
    iconColor: '#f4b942',
    synergyWeapon: 'bible',
    tagline: 'Aumenta o Poder de Dano (+12%) e Velocidade (+5%) por nível.',
    bonusPerLevel: '+12% Dano Global e +5% Velocidade.',
  },
  crimson_candelabra: {
    id: 'crimson_candelabra',
    name: 'Candelabro Rubro',
    maxLevel: 5,
    iconColor: '#ff7b54',
    synergyWeapon: 'axe',
    tagline: 'Amplia a Área de alcance das armas em +14% por nível.',
    bonusPerLevel: '+14% Área de Ataque e alcance.',
  },
  mercury_blood: {
    id: 'mercury_blood',
    name: 'Sangue de Mercúrio',
    maxLevel: 5,
    iconColor: '#6fffe9',
    synergyWeapon: 'thurible',
    tagline: 'Concede Regeneração (+0.7 HP/s), Armadura (+1) e +20% Ímã.',
    bonusPerLevel: '+0.7 HP/s, +1 Armadura e +20% Raio de Coleta.',
  },
  duplicator_ring: {
    id: 'duplicator_ring',
    name: 'Anel Duplicador',
    maxLevel: 3,
    iconColor: '#ffd166',
    synergyWeapon: 'lightning',
    tagline: 'Adiciona +1 Projétil/Golpe extra para todas as armas aplicáveis.',
    bonusPerLevel: '+1 Projétil adicional por disparo.',
  },
};

export const ENEMIES: Record<EnemyKind, EnemyDefinition> = {
  bat: {
    kind: 'bat',
    name: 'Morcego de Sangue',
    hp: 16,
    damage: 7,
    speed: 108,
    radius: 12,
    xpValue: 2,
    gemTier: 'sapphire',
    scale: 1.0,
    knockbackResist: 0.05,
  },
  flagellant: {
    kind: 'flagellant',
    name: 'Flagelado da Cinza',
    hp: 36,
    damage: 11,
    speed: 68,
    radius: 15,
    xpValue: 4,
    gemTier: 'sapphire',
    scale: 1.08,
    knockbackResist: 0.2,
  },
  dryad: {
    kind: 'dryad',
    name: 'Dríade Espinhosa',
    hp: 58,
    damage: 14,
    speed: 86,
    radius: 15,
    xpValue: 7,
    gemTier: 'amber',
    scale: 1.1,
    knockbackResist: 0.25,
  },
  mist_steed: {
    kind: 'mist_steed',
    name: 'Corcel da Névoa',
    hp: 78,
    damage: 16,
    speed: 126,
    radius: 18,
    xpValue: 10,
    gemTier: 'amber',
    scale: 1.18,
    knockbackResist: 0.35,
  },
  acolyte: {
    kind: 'acolyte',
    name: 'Acólito Carmesim',
    hp: 115,
    damage: 19,
    speed: 78,
    radius: 16,
    xpValue: 15,
    gemTier: 'amber',
    scale: 1.15,
    knockbackResist: 0.45,
  },
  hollow_knight: {
    kind: 'hollow_knight',
    name: 'Cavaleiro Oco',
    hp: 210,
    damage: 24,
    speed: 64,
    radius: 20,
    xpValue: 26,
    gemTier: 'ruby',
    scale: 1.28,
    knockbackResist: 0.72,
  },
  fenrir: {
    kind: 'fenrir',
    name: 'Fenrir da Lua Podre',
    isBoss: true,
    hp: 1450,
    damage: 28,
    speed: 104,
    radius: 30,
    xpValue: 120,
    gemTier: 'ruby',
    scale: 1.85,
    knockbackResist: 0.88,
  },
  malakor: {
    kind: 'malakor',
    name: 'Cardeal Malakor',
    isBoss: true,
    hp: 3200,
    damage: 34,
    speed: 96,
    radius: 32,
    xpValue: 240,
    gemTier: 'ruby',
    scale: 1.95,
    knockbackResist: 0.92,
  },
  reaper: {
    kind: 'reaper',
    name: 'O Ceifador Carmesim',
    isBoss: true,
    hp: 6800,
    damage: 45,
    speed: 118,
    radius: 36,
    xpValue: 500,
    gemTier: 'ruby',
    scale: 2.15,
    knockbackResist: 0.96,
  },
};

export interface LoreChapter {
  title: string;
  subtitle: string;
  body: string;
}

export const LORE_CHAPTERS: LoreChapter[] = [
  {
    title: 'I. A Traição dos Sete Cálices',
    subtitle: 'Crônica da Catedral de Alabastro',
    body: 'Temendo o fim de suas eras mortais, os Sete Cardeais do Conclave cravaram lanças de obsidiana no coração da aurora. O Sol não morreu — foi aprisionado por trás da Lua de Sangue, condenando Vespera a uma noite perpétua onde os mortos não encontram repouso.',
  },
  {
    title: 'II. As Gemas de Éter',
    subtitle: 'Fagulhas do Sol Despedaçado',
    body: 'A luz roubada vazou pelas feridas do céu e cristalizou-se nas veias das criaturas da Floresta dos Lamentos. Cada safira, âmbar ou rubi colhido no campo de batalha reconstrói na carne dos Juramentados o fogo primordial necessário para romper o Eclipse.',
  },
  {
    title: 'III. A Ressonância das Relíquias',
    subtitle: 'Segredo da Forja em Batalha',
    body: 'Uma Arma Sagrada levada ao seu 5º grau de maestria pode despertar sua forma ancestral quando combinada à sua Relíquia Catalisadora dentro de um Relicário Dourado deixado pelos Senhores do Eclipse.',
  },
];
