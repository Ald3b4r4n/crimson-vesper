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

const PROP_ASSETS = [
  'prop_dead_tree',
  'prop_gothic_pillar',
  'prop_iron_brazier',
  'prop_dungeon_cage',
  'prop_obsidian_spire',
  'prop_bone_arch',
] as const;

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

  for (const propKey of PROP_ASSETS) {
    if (!scene.textures.exists(propKey)) {
      scene.load.image(propKey, `./art/sprites/${propKey}.webp`);
    }
  }
}

export function forgeStageTextures(scene: Phaser.Scene, stage: StageDefinition): {
  groundKey: string;
  roadKey: string;
  propKeys: [string, string, string];
} {
  const groundKey = `ground_${stage.id}`;
  const roadKey = `road_${stage.id}`;

  // Map authentic AI-generated dark-fantasy props to each of the 7 stages!
  const propMap: Record<StageDefinition['propStyle'], [string, string, string]> = {
    forest: ['prop_dead_tree', 'prop_gothic_pillar', 'prop_iron_brazier'],
    castle: ['prop_gothic_pillar', 'prop_dungeon_cage', 'prop_iron_brazier'],
    dungeon: ['prop_dungeon_cage', 'prop_gothic_pillar', 'prop_iron_brazier'],
    volcano: ['prop_obsidian_spire', 'prop_dead_tree', 'prop_iron_brazier'],
    metropolis: ['prop_gothic_pillar', 'prop_dead_tree', 'prop_iron_brazier'],
    temple: ['prop_gothic_pillar', 'prop_bone_arch', 'prop_iron_brazier'],
    inferno: ['prop_bone_arch', 'prop_obsidian_spire', 'prop_iron_brazier'],
  };
  const propKeys = propMap[stage.propStyle];

  // Seamless 512x512 Subtle Painterly Ground Tile (toroidally wrapped so ZERO grid seams!)
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

    // Soft organic mossy / stone / volcanic shading clouds (seamlessly tiled!)
    for (let i = 0; i < 110; i++) {
      const col = i % 2 === 0 ? stage.palette.groundAccent : stage.palette.groundDetail;
      drawSeamlessBlob(rand() * w, rand() * h, 28 + rand() * 58, col, 0.28);
    }

    if (
      stage.propStyle === 'castle' ||
      stage.propStyle === 'dungeon' ||
      stage.propStyle === 'temple' ||
      stage.propStyle === 'metropolis'
    ) {
      // Subtle worn stone masonry mortar lines (low-contrast so characters pop!)
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
      // Subtle glowing magma fissures in deep dark rock
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

  // Stage Road / Carpet / Magma Path (180x256)
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

  return { groundKey, roadKey, propKeys };
}

export function forgeAllTexturesAndAnims(scene: Phaser.Scene): void {
  // Register 4-frame Phaser animations for all loaded WebP character & monster spritesheets
  const heroIds: HeroId[] = ['alaric', 'seraphina', 'kaelen', 'valeria'];
  for (const hId of heroIds) {
    const key = `hero_${hId}`;
    if (scene.textures.exists(key) && !scene.anims.exists(`${key}_walk`)) {
      scene.anims.create({
        key: `${key}_walk`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
    }
  }

  for (const kind of REGULAR_ENEMIES) {
    const key = `enemy_${kind}`;
    if (scene.textures.exists(key) && !scene.anims.exists(`${key}_move`)) {
      scene.anims.create({
        key: `${key}_move`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
        frameRate: kind === 'bat' || kind === 'mist_steed' || kind === 'magma_imp' ? 10 : 7,
        repeat: -1,
      });
    }
  }

  for (const kind of BOSS_ENEMIES) {
    const key = `enemy_${kind}`;
    if (scene.textures.exists(key) && !scene.anims.exists(`${key}_move`)) {
      scene.anims.create({
        key: `${key}_move`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
        frameRate: 7,
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
}
