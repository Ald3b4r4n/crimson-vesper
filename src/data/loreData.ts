export type HeroId = 'alaric' | 'seraphina' | 'kaelen' | 'valeria';

export type StageId =
  | 'forest'
  | 'castle'
  | 'dungeon'
  | 'volcano_desert'
  | 'metropolis'
  | 'temple'
  | 'inferno';

export type BaseWeaponId =
  | 'whip'
  | 'wand'
  | 'bible'
  | 'axe'
  | 'thurible'
  | 'lightning'
  | 'daggers'
  | 'flask'
  | 'cross';

export type EvolvedWeaponId =
  | 'blood_rose'
  | 'star_torrent'
  | 'immortal_vesper'
  | 'eclipse_scythe'
  | 'devouring_shroud'
  | 'seven_judgment'
  | 'thousand_fangs'
  | 'purifying_tide'
  | 'celestial_blade';

export type WeaponId = BaseWeaponId | EvolvedWeaponId;

export type RelicId =
  | 'black_heart'
  | 'empty_tome'
  | 'amber_seal'
  | 'crimson_candelabra'
  | 'mercury_blood'
  | 'duplicator_ring'
  | 'assassin_gauntlet'
  | 'twilight_orb'
  | 'ash_clover';

export type EnemyKind =
  | 'bat'
  | 'flagellant'
  | 'dryad'
  | 'mist_steed'
  | 'banshee'
  | 'skeleton'
  | 'jailer'
  | 'magma_imp'
  | 'lava_golem'
  | 'plague_doctor'
  | 'fallen_seraph'
  | 'hollow_knight'
  | 'hell_fiend'
  // 7 Stage Bosses
  | 'boss_fenrir'
  | 'boss_carmilla'
  | 'boss_morghul'
  | 'boss_ignis'
  | 'boss_vane'
  | 'boss_malakor'
  | 'boss_reaper';

export interface HeroStats {
  maxHp: number;
  moveSpeed: number;
  might: number;
  area: number;
  cooldown: number;
  magnet: number;
  armor: number;
  regen: number;
  amount: number;
  projSpeed: number;
  critChance: number;
}

export interface HeroDefinition {
  id: HeroId;
  name: string;
  epithet: string;
  portraitUrl: string;
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
  category: string;
  isEvolved?: boolean;
  evolvesFrom?: BaseWeaponId;
  catalystRelic?: RelicId;
  evolvesInto?: EvolvedWeaponId;
  maxLevel: number;
  iconColor: string;
  glyph: string;
  tagline: string;
  mechanicSummary: string;
  descriptions: string[];
}

export interface RelicDefinition {
  id: RelicId;
  name: string;
  maxLevel: number;
  iconColor: string;
  glyph: string;
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
  knockbackResist: number;
}

export interface StageDefinition {
  id: StageId;
  roman: string;
  order: number;
  name: string;
  subtitle: string;
  bannerUrl: string;
  threatLabel: string;
  difficultyMult: number;
  durationSeconds: number;
  lore: string;
  palette: {
    groundBase: string;
    groundAccent: string;
    groundDetail: string;
    roadBase: string;
    roadStone: string;
    fogColor: number;
    ambientStart: number;
    ambientEnd: number;
    emberTint: number;
  };
  propStyle: 'forest' | 'castle' | 'dungeon' | 'volcano' | 'metropolis' | 'temple' | 'inferno';
  enemyPool: EnemyKind[];
  midBoss: EnemyKind;
  finalBoss: EnemyKind;
}

export const HEROES: Record<HeroId, HeroDefinition> = {
  alaric: {
    id: 'alaric',
    name: 'Alaric Belmont',
    epithet: 'O Flagelador da Cinza',
    portraitUrl: './art/hero-alaric.jpg',
    startingWeapon: 'whip',
    cloakColor: 0x245436,
    accentColor: 0xe6c365,
    trimColor: '#58b878',
    perkSummary: '+20 Vida Máx · +15% Área de Corte',
    lore: 'Último inquisidor renegado de Valen. Empunha o chicote consagrado trançado em prata lunar e banhado nas cinzas dos mártires solares.',
    quote: '“A noite deles é longa, mas minha corrente alcança cada sombra.”',
    baseStats: {
      maxHp: 125,
      moveSpeed: 172,
      might: 1.05,
      area: 1.15,
      cooldown: 1.0,
      magnet: 98,
      armor: 1,
      regen: 0.25,
      amount: 0,
      projSpeed: 1.0,
      critChance: 0.1,
    },
  },
  seraphina: {
    id: 'seraphina',
    name: 'Seraphina de Noctis',
    epithet: 'A Tecelã Astral',
    portraitUrl: './art/hero-seraphina.jpg',
    startingWeapon: 'wand',
    cloakColor: 0x482882,
    accentColor: 0x7ce8ff,
    trimColor: '#7ce8ff',
    perkSummary: '+15% Velocidade · -12% Recarga · +25% Ímã',
    lore: 'Astrônoma da Torre de Marfim que cobriu os olhos feridos pela ruptura do Sol, enxergando agora as correntes puras do Éter no escuro.',
    quote: '“Mesmo despedaçada, a luz ainda lembra como queimar.”',
    baseStats: {
      maxHp: 100,
      moveSpeed: 196,
      might: 1.0,
      area: 1.0,
      cooldown: 0.88,
      magnet: 126,
      armor: 0,
      regen: 0.2,
      amount: 0,
      projSpeed: 1.15,
      critChance: 0.12,
    },
  },
  kaelen: {
    id: 'kaelen',
    name: 'Sor Kaelen',
    epithet: 'O Penitente de Ferro',
    portraitUrl: './art/hero-kaelen.jpg',
    startingWeapon: 'axe',
    cloakColor: 0x8a1c24,
    accentColor: 0xe8c478,
    trimColor: '#eb5760',
    perkSummary: '+3 Armadura · +22% Dano · +25 Vida Máx',
    lore: 'Ex-capitão da Guarda Cardeal amaldiçoado por recusar o massacre de Solaris. Carrega no ferro rachado o peso de um reino caído.',
    quote: '“Não peço perdão ao Sol. Peço apenas peso no meu ferro.”',
    baseStats: {
      maxHp: 145,
      moveSpeed: 160,
      might: 1.22,
      area: 1.08,
      cooldown: 1.02,
      magnet: 94,
      armor: 3,
      regen: 0.35,
      amount: 0,
      projSpeed: 1.0,
      critChance: 0.15,
    },
  },
  valeria: {
    id: 'valeria',
    name: 'Irmã Valéria',
    epithet: 'A Justiciera de Alabastro',
    portraitUrl: './art/hero-valeria.jpg',
    startingWeapon: 'cross',
    cloakColor: 0x9e8b56,
    accentColor: 0xfff0b3,
    trimColor: '#ffd97d',
    perkSummary: '+20% Crítico · +15% Vel. Projétil · +1 Regeneração',
    lore: 'Última guardiã do coro de Alabastro. Arremessa cruzes consagradas que cortam a escuridão e retornam trazendo o julgamento solar.',
    quote: '“Onde o altar caiu, minha própria fé será a catedral.”',
    baseStats: {
      maxHp: 115,
      moveSpeed: 180,
      might: 1.1,
      area: 1.05,
      cooldown: 0.95,
      magnet: 110,
      armor: 1,
      regen: 0.6,
      amount: 0,
      projSpeed: 1.18,
      critChance: 0.22,
    },
  },
};

export const STAGES: StageDefinition[] = [
  {
    id: 'forest',
    roman: 'I',
    order: 1,
    name: 'Floresta dos Lamentos',
    subtitle: 'Bosque Ancestral Sob a Névoa',
    bannerUrl: './art/stage-1-forest.jpg',
    threatLabel: 'Ameaça I · Iniciante',
    difficultyMult: 1.0,
    durationSeconds: 360,
    lore: 'As raízes antigas beberam as primeiras lágrimas de Éter após o Eclipse. Peregrinos perdidos, revoadas vampíricas e espíritos silvestres vagam entre os carvalhos mortos.',
    palette: {
      groundBase: '#182817',
      groundAccent: '#233b20',
      groundDetail: '#2e4f29',
      roadBase: '#3d3024',
      roadStone: '#5e4f40',
      fogColor: 0x8fb8c9,
      ambientStart: 0x141024,
      ambientEnd: 0x3b0c1d,
      emberTint: 0x7effb2,
    },
    propStyle: 'forest',
    enemyPool: ['bat', 'flagellant', 'dryad', 'mist_steed'],
    midBoss: 'boss_fenrir',
    finalBoss: 'boss_fenrir',
  },
  {
    id: 'castle',
    roman: 'II',
    order: 2,
    name: 'Castelo Assombrado de Valen',
    subtitle: 'Salões Abandonados da Nobreza Sangrenta',
    bannerUrl: './art/stage-2-castle.jpg',
    threatLabel: 'Ameaça II · Assombrado',
    difficultyMult: 1.22,
    durationSeconds: 390,
    lore: 'Nos salões de mármore quebrado do Castelo de Valen, candelabros flutuam sozinhos e os antigos cortesãos dançam como espectros uivantes ao som de órgãos invisíveis.',
    palette: {
      groundBase: '#1c1829',
      groundAccent: '#262038',
      groundDetail: '#352d4d',
      roadBase: '#591626',
      roadStone: '#7a2237',
      fogColor: 0xb19cd9,
      ambientStart: 0x160f29,
      ambientEnd: 0x420b26,
      emberTint: 0xc792ff,
    },
    propStyle: 'castle',
    enemyPool: ['bat', 'banshee', 'hollow_knight', 'fallen_seraph'],
    midBoss: 'boss_carmilla',
    finalBoss: 'boss_carmilla',
  },
  {
    id: 'dungeon',
    roman: 'III',
    order: 3,
    name: 'Masmorras da Inquisição',
    subtitle: 'Calabouços Subterrâneos de Ferro e Ossos',
    bannerUrl: './art/stage-3-dungeon.jpg',
    threatLabel: 'Ameaça III · Brutal',
    difficultyMult: 1.45,
    durationSeconds: 420,
    lore: 'Abaixo do castelo estendem-se quilômetros de celas alagadas e câmaras de tortura onde dissidentes foram acorrentados. O ar cheira a ferrugem, lodo e fogo alquímico verde.',
    palette: {
      groundBase: '#161d1b',
      groundAccent: '#1f2926',
      groundDetail: '#2c3b36',
      roadBase: '#292e2d',
      roadStone: '#434a48',
      fogColor: 0x74d69d,
      ambientStart: 0x0d1a16,
      ambientEnd: 0x243319,
      emberTint: 0x62ff9c,
    },
    propStyle: 'dungeon',
    enemyPool: ['skeleton', 'jailer', 'flagellant', 'plague_doctor'],
    midBoss: 'boss_morghul',
    finalBoss: 'boss_morghul',
  },
  {
    id: 'volcano_desert',
    roman: 'IV',
    order: 4,
    name: 'Deserto das Crateras Rubras',
    subtitle: 'Dunas de Cinza Negra e Vulcões em Erupção',
    bannerUrl: './art/stage-4-volcano.jpg',
    threatLabel: 'Ameaça IV · Incandescente',
    difficultyMult: 1.72,
    durationSeconds: 420,
    lore: 'Onde a primeira lança perfurou o Sol, gotas de plasma divino secaram o Mar do Sul, criando um deserto de areia obsidiana cortado por rios de lava e vulcões furiosos.',
    palette: {
      groundBase: '#241411',
      groundAccent: '#361c16',
      groundDetail: '#52261b',
      roadBase: '#5e2414',
      roadStone: '#9e3f19',
      fogColor: 0xff8c5a,
      ambientStart: 0x29110a,
      ambientEnd: 0x521608,
      emberTint: 0xff7b29,
    },
    propStyle: 'volcano',
    enemyPool: ['magma_imp', 'lava_golem', 'skeleton', 'mist_steed'],
    midBoss: 'boss_ignis',
    finalBoss: 'boss_ignis',
  },
  {
    id: 'metropolis',
    roman: 'V',
    order: 5,
    name: 'Metrópole Devastada de Solaris',
    subtitle: 'A Capital Medieval em Chamas e Peste',
    bannerUrl: './art/stage-5-metropolis.jpg',
    threatLabel: 'Ameaça V · Cerco Total',
    difficultyMult: 2.0,
    durationSeconds: 450,
    lore: 'A maior cidade do continente arde em silêncio fúnebre. Aquedutos colapsados, torres de sino em chamas e legiões da antiga guarda real marcham sobre escombros.',
    palette: {
      groundBase: '#211d21',
      groundAccent: '#2e282e',
      groundDetail: '#40373d',
      roadBase: '#383136',
      roadStone: '#574c54',
      fogColor: 0xd9a78b,
      ambientStart: 0x1c141c,
      ambientEnd: 0x47151f,
      emberTint: 0xffad66,
    },
    propStyle: 'metropolis',
    enemyPool: ['flagellant', 'plague_doctor', 'hollow_knight', 'mist_steed'],
    midBoss: 'boss_vane',
    finalBoss: 'boss_vane',
  },
  {
    id: 'temple',
    roman: 'VI',
    order: 6,
    name: 'Templo Profanado de Alabastro',
    subtitle: 'O Santuário Corrompido dos Sete Cardeais',
    bannerUrl: './art/stage-6-temple.jpg',
    threatLabel: 'Ameaça VI · Sacrilégio',
    difficultyMult: 2.35,
    durationSeconds: 480,
    lore: 'O mármore sagrado foi tingido de carmesim e os serafins de pedra choram sangue escuro. Aqui os Cardeais entoam a liturgia inversa que mantém o Sol aprisionado.',
    palette: {
      groundBase: '#29222b',
      groundAccent: '#382d3b',
      groundDetail: '#4f3d54',
      roadBase: '#6e1428',
      roadStone: '#a88f59',
      fogColor: 0xf5b0cb,
      ambientStart: 0x211126,
      ambientEnd: 0x540d28,
      emberTint: 0xff5c8a,
    },
    propStyle: 'temple',
    enemyPool: ['fallen_seraph', 'hollow_knight', 'banshee', 'jailer'],
    midBoss: 'boss_malakor',
    finalBoss: 'boss_malakor',
  },
  {
    id: 'inferno',
    roman: 'VII',
    order: 7,
    name: 'O Inferno Rubro',
    subtitle: 'Nono Círculo do Eclipse Perpétuo',
    bannerUrl: './art/stage-7-inferno.jpg',
    threatLabel: 'Ameaça VII · Apocalipse',
    difficultyMult: 2.8,
    durationSeconds: 540,
    lore: 'Abaixo do altar despedaçado abre-se a própria garganta do Abismo: pontes de enxofre e ossos titânicos suspensas sobre mares de sangue astral onde reina o Ceifador.',
    palette: {
      groundBase: '#29080f',
      groundAccent: '#3d0b16',
      groundDetail: '#5c1121',
      roadBase: '#4a0f18',
      roadStone: '#8c1d2c',
      fogColor: 0xff3b5c,
      ambientStart: 0x2e050d,
      ambientEnd: 0x660718,
      emberTint: 0xff2a55,
    },
    propStyle: 'inferno',
    enemyPool: ['hell_fiend', 'lava_golem', 'fallen_seraph', 'hollow_knight'],
    midBoss: 'boss_malakor',
    finalBoss: 'boss_reaper',
  },
];

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  whip: {
    id: 'whip',
    name: 'Açoite Consagrado',
    category: 'Corpo a Corpo Horizontal',
    catalystRelic: 'black_heart',
    evolvesInto: 'blood_rose',
    maxLevel: 5,
    iconColor: '#e8d8a8',
    glyph: '〰',
    tagline: 'Corte horizontal em meia-lua que varre hordas laterais.',
    mechanicSummary: 'Ataca à frente (e atrás no Nv.2+), empurrando inimigos.',
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
    category: 'Projétil Teleguiado',
    catalystRelic: 'empty_tome',
    evolvesInto: 'star_torrent',
    maxLevel: 5,
    iconColor: '#67d4ff',
    glyph: '✦',
    tagline: 'Dispara lanças astrais automáticas no inimigo mais próximo.',
    mechanicSummary: 'Foca sempre na ameaça mais próxima do herói com alta cadência.',
    descriptions: [
      'Lança um estilhaço astral na ameaça mais próxima.',
      'Dispara +1 projétil adicional em rápida sucessão.',
      'Projéteis atravessam +1 inimigo e causam +25% de dano.',
      '+1 projétil adicional e recarga 18% mais rápida.',
      'Mestre: rajada de lanças perfurantes de alta velocidade.',
    ],
  },
  bible: {
    id: 'bible',
    name: 'Bíblia das Cinzas',
    category: 'Escudo Orbital',
    catalystRelic: 'amber_seal',
    evolvesInto: 'immortal_vesper',
    maxLevel: 5,
    iconColor: '#f5b942',
    glyph: '❖',
    tagline: 'Grimórios flamejantes giram ao redor do herói repelindo enxames.',
    mechanicSummary: 'Cria anel giratório protetor que bloqueia aproximação.',
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
    category: 'Arremesso Parabólico Pesado',
    catalystRelic: 'crimson_candelabra',
    evolvesInto: 'eclipse_scythe',
    maxLevel: 5,
    iconColor: '#b993ff',
    glyph: '🪓',
    tagline: 'Lâminas pesadas lançadas em arco alto que atravessam multidões.',
    mechanicSummary: 'Alto dano crítico e perfuração múltipla em parábola.',
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
    category: 'Aura de Santuário',
    catalystRelic: 'mercury_blood',
    evolvesInto: 'devouring_shroud',
    maxLevel: 5,
    iconColor: '#7be0ad',
    glyph: '❂',
    tagline: 'Aura contínua ao redor do herói que queima enxames próximos.',
    mechanicSummary: 'Pulsa dano em área constante 360° colado ao personagem.',
    descriptions: [
      'Cria um círculo consagrado que fere inimigos próximos.',
      '+25% de raio da aura e pulso mais frequente.',
      'Enfraquece resistência a recuo dos inimigos e +35% dano.',
      '+25% de raio adicional e desacelera quem entra no círculo.',
      'Mestre: santuário incandescente que pulveriza enxames menores.',
    ],
  },
  lightning: {
    id: 'lightning',
    name: 'Anel do Trovão Rubro',
    category: 'Invocação Celestial',
    catalystRelic: 'duplicator_ring',
    evolvesInto: 'seven_judgment',
    maxLevel: 5,
    iconColor: '#ff5d73',
    glyph: '⚡',
    tagline: 'Relâmpagos escarlates caem do céu com explosão em área.',
    mechanicSummary: 'Atinge alvos aleatórios na tela com dano explosivo.',
    descriptions: [
      'Fulmina inimigos na tela com um raio escarlate em área.',
      '+1 raio por invocação e +20% de área de choque.',
      '+35% de dano elétrico e recarga reduzida.',
      '+1 raio adicional e ondas de choque mais largas.',
      'Mestre: tempestade implacável de trovões rubros.',
    ],
  },
  // 3 BRAND NEW BASE WEAPONS!
  daggers: {
    id: 'daggers',
    name: 'Adagas Fantasmas',
    category: 'Rajada Direcional [NOVO]',
    catalystRelic: 'assassin_gauntlet',
    evolvesInto: 'thousand_fangs',
    maxLevel: 5,
    iconColor: '#d0f4ff',
    glyph: '🗡',
    tagline: 'Dispara um leque veloz de punhais de prata na direção do movimento.',
    mechanicSummary: 'Você mira com o movimento! Excelente para abrir caminho na horda.',
    descriptions: [
      'Arremessa 2 punhais velozes na direção em que você caminha.',
      '+1 punhal por rajada e +15% de chance crítica.',
      '+30% de dano e atravessa +1 inimigo.',
      '+2 punhais por rajada e recarga reduzida.',
      'Mestre: leque letal de lâminas prateadas de alta precisão.',
    ],
  },
  flask: {
    id: 'flask',
    name: 'Fogo Alquímico Bento',
    category: 'Zona de Chamas no Solo [NOVO]',
    catalystRelic: 'twilight_orb',
    evolvesInto: 'purifying_tide',
    maxLevel: 5,
    iconColor: '#4dffb8',
    glyph: '🧪',
    tagline: 'Arremessa frascos que criam poças de fogo sagrado ardente no chão.',
    mechanicSummary: 'Cria zonas persistentes de dano contínuo que derretem chefes e hordas.',
    descriptions: [
      'Lança um frasco que incendeia o chão por 2.8 segundos.',
      '+1 frasco lançado e +20% de área das chamas.',
      '+35% de dano por pulso nas chamas consagradas.',
      '+1 frasco adicional e maior duração no solo.',
      'Mestre: tapete purificador de chamas esmeraldas.',
    ],
  },
  cross: {
    id: 'cross',
    name: 'Cruz do Julgamento',
    category: 'Bumerangue Perfurante [NOVO]',
    catalystRelic: 'ash_clover',
    evolvesInto: 'celestial_blade',
    maxLevel: 5,
    iconColor: '#ffe082',
    glyph: '✞',
    tagline: 'Cruzes rúnicas giratórias que avançam e retornam rasgando toda a tela.',
    mechanicSummary: 'Atinge na ida e na volta com perfuração infinita!',
    descriptions: [
      'Lança uma cruz giratória que retorna como bumerangue.',
      '+25% de alcance, velocidade e dano no retorno.',
      '+1 cruz lançada simultaneamente.',
      '+35% de tamanho e maior chance de acerto crítico.',
      'Mestre: vórtice duplo de cruzes solares implacáveis.',
    ],
  },

  // 9 EVOLVED WEAPONS
  blood_rose: {
    id: 'blood_rose',
    name: 'Rosa Sangrenta',
    category: 'Evolução Ancestral',
    isEvolved: true,
    evolvesFrom: 'whip',
    maxLevel: 1,
    iconColor: '#ff2a55',
    glyph: '🌹',
    tagline: 'Cortes cruzados carmesins que causam crítico garantido e drenam vida.',
    mechanicSummary: 'Cura o herói a cada golpe desferido contra a horda.',
    descriptions: ['Cortes imperiais carmesins que curam o herói a cada massacre.'],
  },
  star_torrent: {
    id: 'star_torrent',
    name: 'Torrente Estelar',
    category: 'Evolução Ancestral',
    isEvolved: true,
    evolvesFrom: 'wand',
    maxLevel: 1,
    iconColor: '#9ef0ff',
    glyph: '☄',
    tagline: 'Fluxo ininterrupto de cometas astrais teleguiados sem pausa.',
    mechanicSummary: 'Metralhadora arcana automática que perfura alvos.',
    descriptions: ['Dispara cometas astrais perfurantes em cadência ininterrupta.'],
  },
  immortal_vesper: {
    id: 'immortal_vesper',
    name: 'Véspera Imortal',
    category: 'Evolução Ancestral',
    isEvolved: true,
    evolvesFrom: 'bible',
    maxLevel: 1,
    iconColor: '#ffd966',
    glyph: '☀',
    tagline: 'Anel perpétuo de 6 escrituras solares que jamais se apaga.',
    mechanicSummary: 'Barreira giratória permanente ao redor do herói.',
    descriptions: ['Seis grimórios solares giram eternamente em velocidade letal.'],
  },
  eclipse_scythe: {
    id: 'eclipse_scythe',
    name: 'Foice do Eclipse',
    category: 'Evolução Ancestral',
    isEvolved: true,
    evolvesFrom: 'axe',
    maxLevel: 1,
    iconColor: '#d08bff',
    glyph: '🌙',
    tagline: 'Foices espectrais voam em espiral 360° atravessando toda a tela.',
    mechanicSummary: 'Dispara foices gigantes perfurantes em todas as direções.',
    descriptions: ['Ceifa tudo ao redor com foices lunares perfurantes infinitas.'],
  },
  devouring_shroud: {
    id: 'devouring_shroud',
    name: 'Mortalha Devoradora',
    category: 'Evolução Ancestral',
    isEvolved: true,
    evolvesFrom: 'thurible',
    maxLevel: 1,
    iconColor: '#ff477e',
    glyph: '◉',
    tagline: 'Vórtice carmesim gigante que drena a alma da horda e regenera vida.',
    mechanicSummary: 'Aura colossal com roubo de vitalidade contínuo.',
    descriptions: ['Campo abissal gigante que dissolve inimigos e restaura vitalidade.'],
  },
  seven_judgment: {
    id: 'seven_judgment',
    name: 'Julgamento dos Sete',
    category: 'Evolução Ancestral',
    isEvolved: true,
    evolvesFrom: 'lightning',
    maxLevel: 1,
    iconColor: '#ff9e44',
    glyph: '🌩',
    tagline: 'Tempestade dupla de relâmpagos solares com ondas explosivas.',
    mechanicSummary: 'Bombardeio elétrico massivo em toda a visão.',
    descriptions: ['Fúria celestial encadeada sobre os servos do Eclipse.'],
  },
  thousand_fangs: {
    id: 'thousand_fangs',
    name: 'Mil Presas de Prata',
    category: 'Evolução Ancestral [NOVO]',
    isEvolved: true,
    evolvesFrom: 'daggers',
    maxLevel: 1,
    iconColor: '#ffffff',
    glyph: '⚔',
    tagline: 'Rajada hipersônica contínua de adagas espectrais críticas.',
    mechanicSummary: 'Disparo contínuo de punhais perfurantes na sua direção.',
    descriptions: ['Chuva ininterrupta de punhais lunares que rasgam qualquer armadura.'],
  },
  purifying_tide: {
    id: 'purifying_tide',
    name: 'Maré Purificadora',
    category: 'Evolução Ancestral [NOVO]',
    isEvolved: true,
    evolvesFrom: 'flask',
    maxLevel: 1,
    iconColor: '#00f5d4',
    glyph: '🔥',
    tagline: 'Vórtices colossais de fogo astral azul que incineram o mapa.',
    mechanicSummary: 'Cria grandes santuários de fogo azul de altíssimo dano.',
    descriptions: ['Chamas sagradas gigantescas que purificam tudo em seu raio.'],
  },
  celestial_blade: {
    id: 'celestial_blade',
    name: 'Espada Celestial',
    category: 'Evolução Ancestral [NOVO]',
    isEvolved: true,
    evolvesFrom: 'cross',
    maxLevel: 1,
    iconColor: '#fff3b0',
    glyph: '⚜',
    tagline: 'Gládios solares colossais que cortam o horizonte em bumerangue crítico.',
    mechanicSummary: 'Espadas luminosas gigantes com dano crítico dobrado.',
    descriptions: ['Lâminas divinas retornam cortando exércitos inteiros ao meio.'],
  },
};

export const RELICS: Record<RelicId, RelicDefinition> = {
  black_heart: {
    id: 'black_heart',
    name: 'Coração Negro',
    maxLevel: 5,
    iconColor: '#e63956',
    glyph: '♥',
    synergyWeapon: 'whip',
    tagline: '+20% Vida Máxima por nível.',
    bonusPerLevel: '+20% Vida Máxima e cura imediata de 20 HP.',
  },
  empty_tome: {
    id: 'empty_tome',
    name: 'Tomo Vazio',
    maxLevel: 5,
    iconColor: '#5bc0eb',
    glyph: '📖',
    synergyWeapon: 'wand',
    tagline: '-8% Tempo de Recarga por nível.',
    bonusPerLevel: 'Todas as armas atacam 8% mais rápido.',
  },
  amber_seal: {
    id: 'amber_seal',
    name: 'Selo de Âmbar',
    maxLevel: 5,
    iconColor: '#f4b942',
    glyph: '◈',
    synergyWeapon: 'bible',
    tagline: '+12% Dano Global e +5% Velocidade.',
    bonusPerLevel: '+12% Poder de Dano e +5% Velocidade de Movimento.',
  },
  crimson_candelabra: {
    id: 'crimson_candelabra',
    name: 'Candelabro Rubro',
    maxLevel: 5,
    iconColor: '#ff7b54',
    glyph: '🕯',
    synergyWeapon: 'axe',
    tagline: '+14% Área de Ataque por nível.',
    bonusPerLevel: 'Amplia o tamanho e alcance das armas em +14%.',
  },
  mercury_blood: {
    id: 'mercury_blood',
    name: 'Sangue de Mercúrio',
    maxLevel: 5,
    iconColor: '#6fffe9',
    glyph: '💧',
    synergyWeapon: 'thurible',
    tagline: '+0.8 HP/s Regeneração, +1 Armadura e +20% Ímã.',
    bonusPerLevel: '+0.8 HP/s, +1 Armadura e +20% Raio de Coleta de Éter.',
  },
  duplicator_ring: {
    id: 'duplicator_ring',
    name: 'Anel Duplicador',
    maxLevel: 3,
    iconColor: '#ffd166',
    glyph: '◎',
    synergyWeapon: 'lightning',
    tagline: '+1 Projétil adicional para todas as armas.',
    bonusPerLevel: 'Adiciona +1 projétil ou feixe extra por disparo.',
  },
  assassin_gauntlet: {
    id: 'assassin_gauntlet',
    name: 'Manopla da Sombra',
    maxLevel: 5,
    iconColor: '#c7f9cc',
    glyph: '🧤',
    synergyWeapon: 'daggers',
    tagline: '+15% Velocidade de Projétil e +6% Crítico [NOVO].',
    bonusPerLevel: '+15% Velocidade dos Projéteis e +6% Chance Crítica.',
  },
  twilight_orb: {
    id: 'twilight_orb',
    name: 'Orbe do Crepúsculo',
    maxLevel: 5,
    iconColor: '#80ffdb',
    glyph: '🔮',
    synergyWeapon: 'flask',
    tagline: '+10% Área, +10% Dano e maior duração de zonas [NOVO].',
    bonusPerLevel: '+10% Área Global e +10% Poder Alquímico.',
  },
  ash_clover: {
    id: 'ash_clover',
    name: 'Trevo de Cinza',
    maxLevel: 5,
    iconColor: '#ffe66d',
    glyph: '☘',
    synergyWeapon: 'cross',
    tagline: '+8% Chance Crítica e +15% Raio de Coleta [NOVO].',
    bonusPerLevel: '+8% Chance de Acerto Crítico e +15% Ímã de Éter.',
  },
};

export const ENEMIES: Record<EnemyKind, EnemyDefinition> = {
  bat: {
    kind: 'bat',
    name: 'Morcego Vampírico',
    hp: 18,
    damage: 7,
    speed: 112,
    radius: 13,
    xpValue: 2,
    gemTier: 'sapphire',
    scale: 1.0,
    knockbackResist: 0.05,
  },
  flagellant: {
    kind: 'flagellant',
    name: 'Zelote Flagelado',
    hp: 38,
    damage: 11,
    speed: 70,
    radius: 15,
    xpValue: 4,
    gemTier: 'sapphire',
    scale: 1.05,
    knockbackResist: 0.2,
  },
  dryad: {
    kind: 'dryad',
    name: 'Dríade de Espinhos',
    hp: 58,
    damage: 13,
    speed: 86,
    radius: 15,
    xpValue: 7,
    gemTier: 'amber',
    scale: 1.08,
    knockbackResist: 0.25,
  },
  mist_steed: {
    kind: 'mist_steed',
    name: 'Corcel Pesadelo',
    hp: 82,
    damage: 16,
    speed: 128,
    radius: 18,
    xpValue: 10,
    gemTier: 'amber',
    scale: 1.15,
    knockbackResist: 0.35,
  },
  banshee: {
    kind: 'banshee',
    name: 'Dama Espectral',
    hp: 52,
    damage: 15,
    speed: 102,
    radius: 15,
    xpValue: 8,
    gemTier: 'amber',
    scale: 1.08,
    knockbackResist: 0.15,
  },
  skeleton: {
    kind: 'skeleton',
    name: 'Esqueleto Acorrentado',
    hp: 66,
    damage: 14,
    speed: 82,
    radius: 15,
    xpValue: 8,
    gemTier: 'sapphire',
    scale: 1.06,
    knockbackResist: 0.25,
  },
  jailer: {
    kind: 'jailer',
    name: 'Carcereiro de Ferro',
    hp: 155,
    damage: 21,
    speed: 62,
    radius: 19,
    xpValue: 18,
    gemTier: 'amber',
    scale: 1.2,
    knockbackResist: 0.65,
  },
  magma_imp: {
    kind: 'magma_imp',
    name: 'Gárgula de Magma',
    hp: 74,
    damage: 17,
    speed: 116,
    radius: 15,
    xpValue: 11,
    gemTier: 'amber',
    scale: 1.06,
    knockbackResist: 0.2,
  },
  lava_golem: {
    kind: 'lava_golem',
    name: 'Colosso de Basalto',
    hp: 240,
    damage: 26,
    speed: 56,
    radius: 22,
    xpValue: 28,
    gemTier: 'ruby',
    scale: 1.3,
    knockbackResist: 0.8,
  },
  plague_doctor: {
    kind: 'plague_doctor',
    name: 'Alquimista da Peste',
    hp: 96,
    damage: 18,
    speed: 80,
    radius: 16,
    xpValue: 14,
    gemTier: 'amber',
    scale: 1.1,
    knockbackResist: 0.35,
  },
  fallen_seraph: {
    kind: 'fallen_seraph',
    name: 'Serafim Profanado',
    hp: 135,
    damage: 22,
    speed: 94,
    radius: 17,
    xpValue: 20,
    gemTier: 'ruby',
    scale: 1.16,
    knockbackResist: 0.48,
  },
  hollow_knight: {
    kind: 'hollow_knight',
    name: 'Cavaleiro Oco',
    hp: 195,
    damage: 24,
    speed: 68,
    radius: 20,
    xpValue: 24,
    gemTier: 'ruby',
    scale: 1.22,
    knockbackResist: 0.72,
  },
  hell_fiend: {
    kind: 'hell_fiend',
    name: 'Demônio do Abismo',
    hp: 220,
    damage: 28,
    speed: 98,
    radius: 20,
    xpValue: 30,
    gemTier: 'ruby',
    scale: 1.24,
    knockbackResist: 0.68,
  },

  // 7 STAGE BOSSES
  boss_fenrir: {
    kind: 'boss_fenrir',
    name: 'Fenrir da Lua Podre',
    isBoss: true,
    hp: 1550,
    damage: 26,
    speed: 105,
    radius: 30,
    xpValue: 130,
    gemTier: 'ruby',
    scale: 1.45,
    knockbackResist: 0.88,
  },
  boss_carmilla: {
    kind: 'boss_carmilla',
    name: 'Condessa Carmilla de Valen',
    isBoss: true,
    hp: 2100,
    damage: 30,
    speed: 112,
    radius: 30,
    xpValue: 160,
    gemTier: 'ruby',
    scale: 1.45,
    knockbackResist: 0.88,
  },
  boss_morghul: {
    kind: 'boss_morghul',
    name: 'Morghul, o Carcereiro de Ossos',
    isBoss: true,
    hp: 2700,
    damage: 34,
    speed: 94,
    radius: 34,
    xpValue: 200,
    gemTier: 'ruby',
    scale: 1.55,
    knockbackResist: 0.92,
  },
  boss_ignis: {
    kind: 'boss_ignis',
    name: 'Ignis, Titã da Cratera',
    isBoss: true,
    hp: 3400,
    damage: 38,
    speed: 90,
    radius: 36,
    xpValue: 240,
    gemTier: 'ruby',
    scale: 1.6,
    knockbackResist: 0.94,
  },
  boss_vane: {
    kind: 'boss_vane',
    name: 'Marechal Vane de Solaris',
    isBoss: true,
    hp: 4100,
    damage: 40,
    speed: 116,
    radius: 34,
    xpValue: 280,
    gemTier: 'ruby',
    scale: 1.55,
    knockbackResist: 0.92,
  },
  boss_malakor: {
    kind: 'boss_malakor',
    name: 'Arcebispo Malakor, o Traidor',
    isBoss: true,
    hp: 5000,
    damage: 44,
    speed: 104,
    radius: 34,
    xpValue: 350,
    gemTier: 'ruby',
    scale: 1.6,
    knockbackResist: 0.94,
  },
  boss_reaper: {
    kind: 'boss_reaper',
    name: 'O Ceifador Carmesim',
    isBoss: true,
    hp: 6800,
    damage: 50,
    speed: 120,
    radius: 38,
    xpValue: 600,
    gemTier: 'ruby',
    scale: 1.7,
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
    subtitle: 'O Dia em que a Alvorada Sangrou',
    body: 'Durante mil anos o Conclave de Alabastro guardou o Pacto Solar. Mas os Sete Cardeais Imortais, temendo o fim de sua era, cravaram sete lanças de obsidiana no coração do Sol nascente. A estrela não morreu: ficou aprisionada atrás da Lua Rubra, mergulhando o mundo na noite eterna chamada A Véspera.',
  },
  {
    title: 'II. A Peregrinação das Sete Regiões',
    subtitle: 'Da Floresta dos Lamentos ao Nono Círculo',
    body: 'Para alcançar o núcleo do Eclipse, os Juramentados da Cinza precisam atravessar sete domínios corrompidos: a Floresta dos Lamentos, o Castelo Assombrado de Valen, as Masmorras da Inquisição, o Deserto Vulcânico das Crateras Rubras, as ruínas em chamas da Metrópole de Solaris, o Templo Profanado de Alabastro e, por fim, o próprio Inferno Rubro.',
  },
  {
    title: 'III. A Forja de Éter e Sinergias',
    subtitle: 'A Ressonância das Armas Ancestrais',
    body: 'Cada criatura abatida libera Gemas de Éter — safiras, âmbares e rubis de luz solar cristalizada. Quando uma Arma Sagrada atinge o Grau 5 e o Juramentado carrega sua Relíquia Catalisadora, abrir o Relicário Dourado de um Guardião transmuta a arma em uma Evolução Ancestral.',
  },
];
