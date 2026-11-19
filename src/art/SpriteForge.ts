import Phaser from 'phaser';
import { BaseWeaponId, EnemyKind, HERO_ORDER, StageDefinition } from '../data/loreData';

function makeCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  return { canvas, ctx };
}

function registerSingle(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): void {
  if (scene.textures.exists(key)) return;
  const { canvas, ctx } = makeCanvas(width, height);
  draw(ctx, width, height);
  scene.textures.addCanvas(key, canvas);
}

const REGULAR_ENEMIES: EnemyKind[] = [
  'bat',
  'flagellant',
  'dryad',
  'mist_steed',
  'banshee',
  'skeleton',
  'jailer',
  'magma_imp',
  'lava_golem',
  'plague_doctor',
  'fallen_seraph',
  'hollow_knight',
  'hell_fiend',
  'werewolf',
  'necromancer',
  'gargoyle',
  'bone_crawler',
  'ash_wraith',
  'inquisitor',
  'abyssal_worm',
];

const BOSS_ENEMIES: EnemyKind[] = [
  'boss_fenrir',
  'boss_carmilla',
  'boss_morghul',
  'boss_ignis',
  'boss_vane',
  'boss_malakor',
  'boss_reaper',
];

const STATIC_ENV_ASSETS = [
  // Monumental Props & Ruins
  'prop_dead_tree',
  'prop_gothic_pillar',
  'prop_iron_brazier',
  'prop_dungeon_cage',
  'prop_obsidian_spire',
  'prop_bone_arch',
  'prop_weapon_altar',
  'ruin_crumbled_wall',
  'ruin_broken_arch',
  'ruin_weathered_statue',
  // Painted Gothic Forest Trees
  'tree_ancient_oak',
  'tree_weeping_willow',
  'tree_pine_shadow',
  // Vegetation
  'veg_bramble_bush',
  'veg_twisted_shrub',
  'veg_charred_thicket',
  // Breakable Destructibles
  'break_wooden_barrel',
  'break_clay_urn',
  'break_candelabra',
  'break_crystal_cluster',
  // Pickups
  'pickup_blood_chalice',
  'pickup_astral_magnet',
] as const;

export interface StageEnvCatalog {
  groundKey: string;
  roadKey: string;
  ruinKeys: string[];
  vegKeys: string[];
  breakableKeys: string[];
}

export function preloadAllSpriteAssets(scene: Phaser.Scene): void {
  for (const hId of HERO_ORDER) {
    const key = `hero_${hId}`;
    if (!scene.textures.exists(key)) {
      scene.load.spritesheet(key, `./art/sprites/${key}.webp`, {
        frameWidth: 112,
        frameHeight: 112,
      });
    }
  }

  for (const kind of REGULAR_ENEMIES) {
    const key = `enemy_${kind}`;
    if (!scene.textures.exists(key)) {
      scene.load.spritesheet(key, `./art/sprites/${key}.webp`, {
        frameWidth: 96,
        frameHeight: 96,
      });
    }
  }

  for (const kind of BOSS_ENEMIES) {
    const key = `enemy_${kind}`;
    if (!scene.textures.exists(key)) {
      scene.load.spritesheet(key, `./art/sprites/${key}.webp`, {
        frameWidth: 160,
        frameHeight: 160,
      });
    }
  }

  for (const assetKey of STATIC_ENV_ASSETS) {
    if (!scene.textures.exists(assetKey)) {
      scene.load.image(assetKey, `./art/sprites/${assetKey}.webp`);
    }
  }

  const baseWeapons: BaseWeaponId[] = [
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
  for (const wId of baseWeapons) {
    const texKey = `weapon_icon_${wId}`;
    if (!scene.textures.exists(texKey)) {
      scene.load.image(texKey, `./art/icons/${wId}.webp`);
    }
  }
}

export function forgeStageTextures(scene: Phaser.Scene, stage: StageDefinition): StageEnvCatalog {
  const groundKey = `ground_${stage.id}`;
  const roadKey = `road_${stage.id}`;

  const stageCatalogs: Record<
    StageDefinition['propStyle'],
    { ruinKeys: string[]; vegKeys: string[]; breakableKeys: string[] }
  > = {
    forest: {
      ruinKeys: [
        'tree_ancient_oak',
        'tree_weeping_willow',
        'tree_pine_shadow',
        'prop_dead_tree',
        'tree_ancient_oak',
        'ruin_broken_arch',
        'ruin_weathered_statue',
        'prop_iron_brazier',
      ],
      vegKeys: [
        'veg_fern_cluster',
        'veg_bramble_bush',
        'veg_twisted_shrub',
        'veg_glowing_mushrooms',
      ],
      breakableKeys: ['break_candelabra', 'break_wooden_barrel', 'break_clay_urn'],
    },
    castle: {
      ruinKeys: [
        'ruin_broken_arch',
        'prop_gothic_pillar',
        'ruin_weathered_statue',
        'ruin_crumbled_wall',
        'prop_iron_brazier',
      ],
      vegKeys: ['veg_bramble_bush', 'veg_twisted_shrub'],
      breakableKeys: ['break_candelabra', 'break_clay_urn', 'break_wooden_barrel'],
    },
    dungeon: {
      ruinKeys: [
        'prop_dungeon_cage',
        'ruin_crumbled_wall',
        'prop_gothic_pillar',
        'prop_iron_brazier',
      ],
      vegKeys: ['veg_twisted_shrub', 'veg_charred_thicket'],
      breakableKeys: ['break_wooden_barrel', 'break_clay_urn', 'break_crystal_cluster'],
    },
    volcano: {
      ruinKeys: [
        'prop_obsidian_spire',
        'ruin_crumbled_wall',
        'prop_bone_arch',
        'prop_iron_brazier',
      ],
      vegKeys: ['veg_charred_thicket', 'prop_dead_tree'],
      breakableKeys: ['break_crystal_cluster', 'break_clay_urn', 'break_candelabra'],
    },
    metropolis: {
      ruinKeys: [
        'ruin_crumbled_wall',
        'ruin_broken_arch',
        'ruin_weathered_statue',
        'prop_gothic_pillar',
        'prop_iron_brazier',
      ],
      vegKeys: ['veg_charred_thicket', 'veg_bramble_bush'],
      breakableKeys: ['break_wooden_barrel', 'break_candelabra', 'break_clay_urn'],
    },
    temple: {
      ruinKeys: [
        'prop_gothic_pillar',
        'ruin_weathered_statue',
        'ruin_broken_arch',
        'prop_iron_brazier',
      ],
      vegKeys: ['veg_bramble_bush', 'veg_twisted_shrub'],
      breakableKeys: ['break_candelabra', 'break_clay_urn', 'break_crystal_cluster'],
    },
    inferno: {
      ruinKeys: [
        'prop_bone_arch',
        'prop_obsidian_spire',
        'ruin_weathered_statue',
        'prop_iron_brazier',
      ],
      vegKeys: ['veg_charred_thicket'],
      breakableKeys: ['break_crystal_cluster', 'break_candelabra', 'break_clay_urn'],
    },
  };

  const chosen = stageCatalogs[stage.propStyle];

  // Seamless 512x512 Painterly Ground Tile
  registerSingle(scene, groundKey, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = stage.palette.groundBase;
    ctx.fillRect(0, 0, w, h);

    let seed = stage.order * 9973;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const drawSeamlessBlob = (x: number, y: number, r: number, color: string, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      for (const ox of [-w, 0, w]) {
        for (const oy of [-h, 0, h]) {
          const cx = x + ox;
          const cy = y + oy;
          if (cx + r < 0 || cx - r > w || cy + r < 0 || cy - r > h) continue;
          const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
          g.addColorStop(0, color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };

    for (let i = 0; i < 110; i++) {
      const col = i % 2 === 0 ? stage.palette.groundAccent : stage.palette.groundDetail;
      drawSeamlessBlob(rand() * w, rand() * h, 28 + rand() * 58, col, 0.28);
    }

    if (stage.propStyle === 'forest') {
      // Rich mossy forest floor with creeping roots, clover tufts, and fallen autumn/twilight leaves!
      for (let i = 0; i < 36; i++) {
        drawSeamlessBlob(rand() * w, rand() * h, 14 + rand() * 24, '#244721', 0.22);
      }
      ctx.strokeStyle = 'rgba(28, 22, 16, 0.34)';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 18; i++) {
        const rx = rand() * w;
        const ry = rand() * h;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.quadraticCurveTo(rx + 22, ry + (rand() - 0.5) * 18, rx + 46, ry + (rand() - 0.5) * 26);
        ctx.stroke();
      }
      for (let i = 0; i < 75; i++) {
        ctx.save();
        ctx.translate(rand() * w, rand() * h);
        ctx.rotate(rand() * Math.PI * 2);
        ctx.fillStyle =
          i % 3 === 0
            ? 'rgba(138, 86, 46, 0.42)'
            : i % 3 === 1
              ? 'rgba(72, 132, 74, 0.45)'
              : 'rgba(165, 118, 62, 0.36)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.6, 1.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    if (
      stage.propStyle === 'castle' ||
      stage.propStyle === 'dungeon' ||
      stage.propStyle === 'temple' ||
      stage.propStyle === 'metropolis'
    ) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.26)';
      ctx.lineWidth = 1.5;
      const rowH = 64;
      const colW = 96;
      for (let row = 0; row < h / rowH; row++) {
        const y = row * rowH;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        const offset = (row % 2) * (colW / 2);
        for (let x = offset; x < w; x += colW) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + rowH);
          ctx.stroke();
        }
      }
    } else if (stage.propStyle === 'volcano' || stage.propStyle === 'inferno') {
      ctx.strokeStyle =
        stage.propStyle === 'volcano' ? 'rgba(255, 90, 20, 0.22)' : 'rgba(220, 25, 65, 0.22)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 28; i++) {
        const sx = rand() * w;
        const sy = rand() * h;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + 18, sy + 12, sx + 34, sy - 6);
        ctx.stroke();
      }
    }
  });

  registerSingle(scene, roadKey, 180, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.16, stage.palette.roadBase);
    grad.addColorStop(0.5, stage.palette.roadStone);
    grad.addColorStop(0.84, stage.palette.roadBase);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (stage.propStyle === 'castle' || stage.propStyle === 'temple') {
      ctx.fillStyle = 'rgba(226, 192, 102, 0.55)';
      ctx.fillRect(30, 0, 2.5, h);
      ctx.fillRect(w - 32.5, 0, 2.5, h);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 8; y < h; y += 42) {
        ctx.beginPath();
        ctx.roundRect(38, y, 46, 28, 6);
        ctx.roundRect(94, y + 16, 46, 28, 6);
        ctx.fill();
      }
    }
  });

  return {
    groundKey,
    roadKey,
    ruinKeys: chosen.ruinKeys,
    vegKeys: chosen.vegKeys,
    breakableKeys: chosen.breakableKeys,
  };
}

export function forgeAllTexturesAndAnims(scene: Phaser.Scene): void {
  // 8-frame Articulated Walk + Idle + 4-frame Attack Swing for all Heroes!
  for (const hId of HERO_ORDER) {
    const key = `hero_${hId}`;
    if (!scene.textures.exists(key)) continue;

    if (!scene.anims.exists(`${key}_idle`)) {
      scene.anims.create({
        key: `${key}_idle`,
        frames: scene.anims.generateFrameNumbers(key, { start: 12, end: 15 }),
        frameRate: 4.5,
        repeat: -1,
      });
    }
    if (!scene.anims.exists(`${key}_walk`)) {
      scene.anims.create({
        key: `${key}_walk`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 7 }),
        frameRate: 13,
        repeat: -1,
      });
    }
    if (!scene.anims.exists(`${key}_attack`)) {
      scene.anims.create({
        key: `${key}_attack`,
        frames: scene.anims.generateFrameNumbers(key, { start: 8, end: 11 }),
        frameRate: 16,
        repeat: 0,
      });
    }
  }

  // 8-frame Articulated Walk / Wing-Flap for all 20 Regular Enemies!
  for (const kind of REGULAR_ENEMIES) {
    const key = `enemy_${kind}`;
    if (scene.textures.exists(key) && !scene.anims.exists(`${key}_move`)) {
      scene.anims.create({
        key: `${key}_move`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 7 }),
        frameRate:
          kind === 'bat' ||
            kind === 'mist_steed' ||
            kind === 'magma_imp' ||
            kind === 'gargoyle' ||
            kind === 'ash_wraith' ||
            kind === 'bone_crawler'
            ? 14
            : 10,
        repeat: -1,
      });
    }
  }

  // Lush Gothic Forest Trees & Flora Textures
  registerSingle(scene, 'tree_ancient_oak', 128, 148, (ctx, w, h) => {
    // Exposed twisted roots & gnarled trunk
    ctx.fillStyle = '#2d2018';
    ctx.strokeStyle = '#140d09';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h - 8);
    ctx.quadraticCurveTo(w * 0.43, h - 32, w * 0.42, h * 0.44);
    ctx.lineTo(w * 0.58, h * 0.44);
    ctx.quadraticCurveTo(w * 0.57, h - 32, w * 0.68, h - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bark ridges
    ctx.strokeStyle = 'rgba(92, 68, 48, 0.55)';
    ctx.lineWidth = 1.5;
    for (const bx of [w * 0.46, w * 0.5, w * 0.54]) {
      ctx.beginPath();
      ctx.moveTo(bx, h - 14);
      ctx.lineTo(bx + (bx > w * 0.5 ? 2 : -2), h * 0.48);
      ctx.stroke();
    }

    // 3-layer dense canopy clusters
    const clusters = [
      { cx: w * 0.33, cy: h * 0.45, r: 30, col: '#18301c' },
      { cx: w * 0.67, cy: h * 0.45, r: 30, col: '#18301c' },
      { cx: w * 0.5, cy: h * 0.36, r: 36, col: '#203f25' },
      { cx: w * 0.36, cy: h * 0.33, r: 24, col: '#294f2d' },
      { cx: w * 0.64, cy: h * 0.33, r: 24, col: '#294f2d' },
      { cx: w * 0.5, cy: h * 0.24, r: 29, col: '#356338' },
    ];
    for (const cl of clusters) {
      const g = ctx.createRadialGradient(cl.cx - 4, cl.cy - 5, cl.r * 0.15, cl.cx, cl.cy, cl.r);
      g.addColorStop(0, cl.col);
      g.addColorStop(1, '#0d1b10');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cl.cx, cl.cy, cl.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Ethereal glowing forest spores in foliage
    ctx.fillStyle = 'rgba(130, 255, 185, 0.55)';
    for (const [sx, sy] of [
      [w * 0.38, h * 0.28],
      [w * 0.6, h * 0.38],
      [w * 0.48, h * 0.19],
    ]) {
      ctx.beginPath();
      ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  registerSingle(scene, 'tree_weeping_willow', 120, 144, (ctx, w, h) => {
    ctx.fillStyle = '#292226';
    ctx.strokeStyle = '#120e12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.37, h - 8);
    ctx.quadraticCurveTo(w * 0.45, h * 0.68, w * 0.45, h * 0.38);
    ctx.lineTo(w * 0.56, h * 0.38);
    ctx.quadraticCurveTo(w * 0.55, h * 0.68, w * 0.63, h - 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hanging willow curtain strands
    for (let i = -5; i <= 5; i++) {
      const sx = w * 0.5 + i * 7.5;
      const topY = h * 0.24 + Math.abs(i) * 2.6;
      const len = h * 0.58 - Math.abs(i) * 3.5;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(54, 96, 76, 0.72)' : 'rgba(34, 68, 56, 0.78)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, topY);
      ctx.quadraticCurveTo(sx + i * 1.4, topY + len * 0.55, sx + i * 0.7, topY + len);
      ctx.stroke();
    }

    // Crown Dome
    const cg = ctx.createRadialGradient(w * 0.5, h * 0.26, 6, w * 0.5, h * 0.28, 42);
    cg.addColorStop(0, '#3a6e59');
    cg.addColorStop(0.65, '#1e4234');
    cg.addColorStop(1, '#0e211a');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.28, 42, 27, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  registerSingle(scene, 'tree_pine_shadow', 104, 148, (ctx, w, h) => {
    ctx.fillStyle = '#241812';
    ctx.fillRect(w * 0.44, h - 34, w * 0.12, 26);

    const tiers = [
      { yTop: h * 0.36, yBot: h * 0.8, halfW: 40, col: '#132819' },
      { yTop: h * 0.2, yBot: h * 0.62, halfW: 32, col: '#1b3a22' },
      { yTop: h * 0.06, yBot: h * 0.42, halfW: 23, col: '#264d2e' },
    ];
    for (const tier of tiers) {
      ctx.fillStyle = tier.col;
      ctx.strokeStyle = '#0a160d';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, tier.yTop);
      ctx.lineTo(w * 0.5 + tier.halfW, tier.yBot);
      ctx.quadraticCurveTo(w * 0.5, tier.yBot - 6, w * 0.5 - tier.halfW, tier.yBot);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  });

  registerSingle(scene, 'veg_fern_cluster', 76, 64, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.8;
    for (let i = -3; i <= 3; i++) {
      const ang = i * 0.34 - Math.PI / 2;
      const tipX = cx + Math.cos(ang) * 30;
      const tipY = cy + Math.sin(ang) * 32;
      ctx.strokeStyle = i % 2 === 0 ? '#2f6e3a' : '#22522b';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo((cx + tipX) * 0.5 + i * 2, cy - 18, tipX, tipY);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(130, 255, 195, 0.65)';
    for (const [sx, sy] of [
      [cx - 8, cy - 22],
      [cx + 10, cy - 19],
      [cx, cy - 28],
    ]) {
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  registerSingle(scene, 'veg_glowing_mushrooms', 68, 58, (ctx, w, h) => {
    const caps = [
      { x: w * 0.34, y: h * 0.64, rx: 11, ry: 7, stemH: 15 },
      { x: w * 0.56, y: h * 0.52, rx: 14, ry: 9, stemH: 20 },
      { x: w * 0.68, y: h * 0.7, rx: 9, ry: 6, stemH: 12 },
    ];
    for (const c of caps) {
      ctx.fillStyle = '#c8c2b4';
      ctx.fillRect(c.x - 2.5, c.y, 5, c.stemH);
      const mg = ctx.createRadialGradient(c.x, c.y - 2, 2, c.x, c.y, c.rx + 4);
      mg.addColorStop(0, '#a8ffea');
      mg.addColorStop(0.55, '#34d399');
      mg.addColorStop(1, 'rgba(16, 95, 72, 0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
  });

  // 8-frame Articulated Walk / Wing-Flap for all 7 Bosses!
  for (const kind of BOSS_ENEMIES) {
    const key = `enemy_${kind}`;
    if (scene.textures.exists(key) && !scene.anims.exists(`${key}_move`)) {
      scene.anims.create({
        key: `${key}_move`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 7 }),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  // Ground shadow
  registerSingle(scene, 'vfx_shadow', 64, 28, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.68)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // Splinter / Debris shard for breakables!
  registerSingle(scene, 'vfx_shard', 14, 10, (ctx, w, h) => {
    ctx.fillStyle = '#d9b99b';
    ctx.strokeStyle = '#2b1d14';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(1, h * 0.6);
    ctx.lineTo(w * 0.45, 1);
    ctx.lineTo(w - 1, h * 0.45);
    ctx.lineTo(w * 0.6, h - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Weapons & VFX Textures
  registerSingle(scene, 'vfx_whip_slash', 164, 72, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(8, h / 2, w - 6, h / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.35, 'rgba(255,248,225,0.95)');
    grad.addColorStop(0.85, '#ffffff');
    grad.addColorStop(1, 'rgba(255,240,190,0.2)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(8, h * 0.65);
    ctx.quadraticCurveTo(w * 0.56, h * 0.02, w - 8, h * 0.48);
    ctx.quadraticCurveTo(w * 0.58, h * 0.36, 8, h * 0.65);
    ctx.closePath();
    ctx.fill();
  });

  registerSingle(scene, 'vfx_wand_bolt', 38, 18, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.68, h / 2, 1, w * 0.5, h / 2, 17);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#6ee2ff');
    g.addColorStop(1, 'rgba(60,150,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(2, h / 2);
    ctx.lineTo(w * 0.7, 2);
    ctx.lineTo(w - 2, h / 2);
    ctx.lineTo(w * 0.7, h - 2);
    ctx.closePath();
    ctx.fill();
  });

  registerSingle(scene, 'vfx_dagger', 40, 14, (ctx, w, h) => {
    ctx.fillStyle = '#e8f7ff';
    ctx.strokeStyle = '#7ce8ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(8, h / 2);
    ctx.lineTo(w - 2, h / 2);
    ctx.lineTo(14, 2);
    ctx.lineTo(14, h - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(8, 3, 4, h - 6);
  });

  registerSingle(scene, 'vfx_fire_pool', 140, 140, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 6, c, c, c - 4);
    g.addColorStop(0, 'rgba(200, 255, 235, 0.78)');
    g.addColorStop(0.55, 'rgba(45, 255, 175, 0.42)');
    g.addColorStop(0.88, 'rgba(20, 160, 140, 0.22)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c - 4, 0, Math.PI * 2);
    ctx.fill();
  });

  registerSingle(scene, 'vfx_cross', 42, 42, (ctx, w, h) => {
    const c = w / 2;
    ctx.fillStyle = '#ffe082';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(c - 4, 4, 8, h - 8, 2);
    ctx.roundRect(4, c - 4, w - 8, 8, 2);
    ctx.fill();
    ctx.stroke();
  });

  registerSingle(scene, 'vfx_celestial_blade', 64, 64, (ctx, w, h) => {
    const c = w / 2;
    ctx.fillStyle = '#fff6cc';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c, 2);
    ctx.lineTo(c + 8, c + 10);
    ctx.lineTo(c, h - 4);
    ctx.lineTo(c - 8, c + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(c - 18, c + 4, 36, 5);
  });

  registerSingle(scene, 'vfx_bible', 32, 32, (ctx) => {
    ctx.fillStyle = '#7a1c28';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(6, 4, 20, 24, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(15, 9, 2, 14);
    ctx.fillRect(11, 13, 10, 2);
  });

  registerSingle(scene, 'vfx_axe', 44, 44, (ctx) => {
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(22, 38);
    ctx.lineTo(22, 6);
    ctx.stroke();
    ctx.fillStyle = '#dce4f2';
    ctx.strokeStyle = '#9aa8c7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(22, 10);
    ctx.quadraticCurveTo(38, 6, 37, 22);
    ctx.quadraticCurveTo(28, 20, 22, 18);
    ctx.quadraticCurveTo(16, 20, 7, 22);
    ctx.quadraticCurveTo(6, 6, 22, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  registerSingle(scene, 'vfx_scythe', 56, 56, (ctx) => {
    ctx.strokeStyle = '#e0aaff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(28, 28, 21, -Math.PI * 0.75, Math.PI * 0.35);
    ctx.stroke();
    ctx.fillStyle = 'rgba(224,170,255,0.45)';
    ctx.beginPath();
    ctx.arc(28, 28, 21, -Math.PI * 0.75, Math.PI * 0.35);
    ctx.arc(28, 28, 14, Math.PI * 0.35, -Math.PI * 0.75, true);
    ctx.closePath();
    ctx.fill();
  });

  registerSingle(scene, 'vfx_aura_ring', 192, 192, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 24, c, c, c - 4);
    g.addColorStop(0, 'rgba(140, 240, 190, 0.04)');
    g.addColorStop(0.75, 'rgba(140, 240, 190, 0.16)');
    g.addColorStop(0.95, 'rgba(210, 255, 230, 0.38)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(210, 255, 230, 0.32)';
    ctx.lineWidth = 1.5;
    for (const r of [c * 0.58, c * 0.78, c * 0.92]) {
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  registerSingle(scene, 'vfx_lightning', 48, 220, (ctx, w, h) => {
    ctx.strokeStyle = '#ff4d6d';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w * 0.28, h * 0.32);
    ctx.lineTo(w * 0.68, h * 0.55);
    ctx.lineTo(w * 0.35, h * 0.8);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.6;
    ctx.stroke();
  });

  const gemConfigs: Array<{ key: string; outer: string; inner: string }> = [
    { key: 'gem_sapphire', outer: '#1d78f2', inner: '#9be7ff' },
    { key: 'gem_amber', outer: '#e09f1f', inner: '#fff3b0' },
    { key: 'gem_ruby', outer: '#e01e48', inner: '#ff9ebb' },
  ];
  for (const gem of gemConfigs) {
    registerSingle(scene, gem.key, 22, 26, (ctx, w, h) => {
      ctx.fillStyle = gem.outer;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(w / 2, 2);
      ctx.lineTo(w - 3, h * 0.42);
      ctx.lineTo(w / 2, h - 2);
      ctx.lineTo(3, h * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = gem.inner;
      ctx.beginPath();
      w = w + 0;
      ctx.moveTo(w / 2, 5);
      ctx.lineTo(w - 7, h * 0.42);
      ctx.lineTo(w / 2, h * 0.65);
      ctx.lineTo(7, h * 0.42);
      ctx.closePath();
      ctx.fill();
    });
  }

  registerSingle(scene, 'relic_chest', 44, 40, (ctx) => {
    ctx.fillStyle = '#5c2c1d';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(6, 10, 32, 24, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(6, 19, 32, 4);
    ctx.fillRect(19, 16, 6, 10);
  });

  registerSingle(scene, 'vfx_particle', 16, 16, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  registerSingle(scene, 'vfx_fog', 160, 96, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(220, 225, 245, 0.16)');
    g.addColorStop(1, 'rgba(220, 225, 245, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // Live Physics Flame & Ember Textures!
  registerSingle(scene, 'vfx_flame_tongue', 36, 64, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.32, '#ffd166');
    grad.addColorStop(0.68, 'rgba(255, 110, 35, 0.85)');
    grad.addColorStop(1, 'rgba(255, 45, 15, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 2);
    ctx.bezierCurveTo(w * 0.92, h * 0.42, w * 0.95, h * 0.84, w * 0.5, h - 3);
    ctx.bezierCurveTo(w * 0.05, h * 0.84, w * 0.08, h * 0.42, w * 0.5, 2);
    ctx.closePath();
    ctx.fill();
  });

  registerSingle(scene, 'vfx_flame_core', 64, 64, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 3, c, c, c - 2);
    g.addColorStop(0, 'rgba(255, 255, 240, 0.92)');
    g.addColorStop(0.38, 'rgba(255, 185, 75, 0.65)');
    g.addColorStop(0.75, 'rgba(255, 85, 25, 0.25)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fill();
  });

  registerSingle(scene, 'vfx_ember_spark', 12, 12, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0.5, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#ffbe55');
    g.addColorStop(1, 'rgba(255, 75, 20, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // Ornate Gothic Stone Reliquary Altar Pedestal for Stage-Hidden Weapons (84x96)
  registerSingle(scene, 'prop_weapon_altar', 84, 96, (ctx, w, h) => {
    const cx = w * 0.5;
    // Lower stepped plinth
    ctx.fillStyle = '#251d2b';
    ctx.strokeStyle = '#0c0810';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(10, h - 24, w - 20, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#362a3d';
    ctx.beginPath();
    ctx.roundRect(16, h - 38, w - 32, 16, 3);
    ctx.fill();
    ctx.stroke();

    // Central carved column with crimson-gold runes
    const colGrad = ctx.createLinearGradient(22, 0, w - 22, 0);
    colGrad.addColorStop(0, '#231a29');
    colGrad.addColorStop(0.5, '#4b3b54');
    colGrad.addColorStop(1, '#201824');
    ctx.fillStyle = colGrad;
    ctx.beginPath();
    ctx.roundRect(24, 34, w - 48, h - 68, 3);
    ctx.fill();
    ctx.stroke();

    // Glowing rune veins along column front
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, 40);
    ctx.lineTo(cx, h - 42);
    ctx.moveTo(cx - 8, 49);
    ctx.lineTo(cx + 8, 49);
    ctx.stroke();

    // Top altar bowl / cradle trimmed in gold
    ctx.fillStyle = '#5c4666';
    ctx.strokeStyle = '#ffe082';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(14, 24);
    ctx.lineTo(w - 14, 24);
    ctx.lineTo(w - 22, 37);
    ctx.lineTo(22, 37);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Golden-crimson aura core above cradle
    const g = ctx.createRadialGradient(cx, 18, 2, cx, 18, 18);
    g.addColorStop(0, 'rgba(255, 250, 200, 0.95)');
    g.addColorStop(0.55, 'rgba(255, 195, 70, 0.55)');
    g.addColorStop(1, 'rgba(255, 65, 95, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, 18, 18, 0, Math.PI * 2);
    ctx.fill();
  });

  // Directional Compass Pointer pointing toward Stage-Hidden Weapon Altar
  registerSingle(scene, 'vfx_compass_arrow', 28, 28, (ctx, w, h) => {
    ctx.fillStyle = '#ffe066';
    ctx.strokeStyle = '#290715';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(w - 3, h / 2);
    ctx.lineTo(6, 4);
    ctx.lineTo(11, h / 2);
    ctx.lineTo(6, h - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Celestial Golden Light Pillar & Runic Halo for Hidden Weapon Reliquary Shrines
  registerSingle(scene, 'vfx_reliquary_beam', 96, 220, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, 'rgba(255, 225, 130, 0.72)');
    grad.addColorStop(0.35, 'rgba(255, 195, 75, 0.36)');
    grad.addColorStop(0.78, 'rgba(255, 85, 110, 0.14)');
    grad.addColorStop(1, 'rgba(255, 85, 110, 0)');
    const hGrad = ctx.createLinearGradient(0, 0, w, 0);
    hGrad.addColorStop(0, 'rgba(0,0,0,0)');
    hGrad.addColorStop(0.3, 'rgba(255,255,255,0.65)');
    hGrad.addColorStop(0.5, 'rgba(255,255,255,1)');
    hGrad.addColorStop(0.7, 'rgba(255,255,255,0.65)');
    hGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.fillRect(14, 0, w - 28, h);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  });

  registerSingle(scene, 'vfx_reliquary_halo', 96, 96, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, cx - 2);
    g.addColorStop(0, 'rgba(255, 245, 185, 0.52)');
    g.addColorStop(0.6, 'rgba(255, 200, 75, 0.18)');
    g.addColorStop(1, 'rgba(255, 80, 100, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 228, 120, 0.86)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 140, 160, 0.72)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#fff5b0';
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const px = cx + Math.cos(a) * 38;
      const py = cy + Math.sin(a) * 38;
      ctx.beginPath();
      ctx.moveTo(px, py - 4);
      ctx.lineTo(px + 4, py);
      ctx.lineTo(px, py + 4);
      ctx.lineTo(px - 4, py);
      ctx.closePath();
      ctx.fill();
    }
  });
}
