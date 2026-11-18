import Phaser from 'phaser';
import { EnemyKind, HeroId, StageDefinition } from '../data/loreData';

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
  const heroIds: HeroId[] = ['alaric', 'seraphina', 'kaelen', 'valeria'];
  for (const hId of heroIds) {
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
        'veg_bramble_bush',
        'veg_twisted_shrub',
        'veg_fern_cluster',
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
  // 8-frame Articulated Walk + Idle + 4-frame Attack Swing for all 4 Heroes!
  const heroIds: HeroId[] = ['alaric', 'seraphina', 'kaelen', 'valeria'];
  for (const hId of heroIds) {
    const key = `hero_${hId}`;
    if (!scene.textures.exists(key)) continue;

    if (!scene.anims.exists(`${key}_idle`)) {
      scene.anims.create({
        key: `${key}_idle`,
        frames: [
          { key, frame: 0 },
          { key, frame: 4 },
        ],
        frameRate: 2.2,
        repeat: -1,
      });
    }
    if (!scene.anims.exists(`${key}_walk`)) {
      scene.anims.create({
        key: `${key}_walk`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 7 }),
        frameRate: 12,
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

  // Lush Painterly Gothic Flora Textures (Trees loaded from painted .webp assets above!)
  registerSingle(scene, 'veg_fern_cluster', 78, 64, (ctx, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.84;
    for (let i = -4; i <= 4; i++) {
      const ang = i * 0.28 - Math.PI / 2;
      const len = 26 + (4 - Math.abs(i)) * 3.5;
      const tipX = cx + Math.cos(ang) * len;
      const tipY = cy + Math.sin(ang) * len;
      ctx.strokeStyle = i % 2 === 0 ? '#1d4c27' : '#2a6635';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo((cx + tipX) * 0.5 + i * 2, cy - 16, tipX, tipY);
      ctx.stroke();

      // Feather leaflets along fern frond
      for (let f = 0.25; f < 0.95; f += 0.18) {
        const lx = cx + (tipX - cx) * f;
        const ly = cy + (tipY - cy) * f;
        ctx.fillStyle = f > 0.6 ? '#397d43' : '#23592d';
        ctx.beginPath();
        ctx.ellipse(lx, ly, 4.5 * (1 - f * 0.5), 2.2, ang + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  registerSingle(scene, 'veg_glowing_mushrooms', 64, 54, (ctx, w, h) => {
    // Moss bed base
    const mgBase = ctx.createRadialGradient(w * 0.5, h * 0.78, 2, w * 0.5, h * 0.78, 24);
    mgBase.addColorStop(0, '#1e3e26');
    mgBase.addColorStop(1, 'rgba(12, 24, 16, 0)');
    ctx.fillStyle = mgBase;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.78, 24, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    const caps = [
      { x: w * 0.36, y: h * 0.64, rx: 9, ry: 5.5, stemH: 13 },
      { x: w * 0.54, y: h * 0.54, rx: 11, ry: 7, stemH: 17 },
      { x: w * 0.67, y: h * 0.68, rx: 7.5, ry: 5, stemH: 11 },
    ];
    for (const c of caps) {
      ctx.fillStyle = '#8b8378';
      ctx.strokeStyle = '#181412';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(c.x - 2, c.y, 4, c.stemH, 2);
      ctx.fill();
      ctx.stroke();

      const mg = ctx.createRadialGradient(c.x, c.y - 2, 1, c.x, c.y, c.rx + 2);
      mg.addColorStop(0, '#96f2d7');
      mg.addColorStop(0.55, '#2b9374');
      mg.addColorStop(1, '#123e35');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, Math.PI, Math.PI * 2);
      ctx.quadraticCurveTo(c.x, c.y + 3, c.x - c.rx, c.y);
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

  // Live Physics Flame & Ember Textures (wispy sinuous flame tongue!)
  registerSingle(scene, 'vfx_flame_tongue', 26, 48, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, h, 0, 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.32, '#ffd166');
    grad.addColorStop(0.68, 'rgba(255, 110, 35, 0.85)');
    grad.addColorStop(1, 'rgba(255, 45, 15, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(w * 0.55, 2);
    ctx.bezierCurveTo(w * 0.85, h * 0.35, w * 0.92, h * 0.82, w * 0.5, h - 3);
    ctx.bezierCurveTo(w * 0.08, h * 0.82, w * 0.2, h * 0.38, w * 0.55, 2);
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
}
