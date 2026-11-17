import Phaser from 'phaser';
import { EnemyKind, HeroId } from '../data/loreData';

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

function registerSheet(
  scene: Phaser.Scene,
  key: string,
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
  drawFrame: (ctx: CanvasRenderingContext2D, frame: number, w: number, h: number) => void
): void {
  if (scene.textures.exists(key)) return;
  const { canvas, ctx } = makeCanvas(frameWidth * frameCount, frameHeight);
  for (let f = 0; f < frameCount; f++) {
    ctx.save();
    ctx.translate(f * frameWidth, 0);
    drawFrame(ctx, f, frameWidth, frameHeight);
    ctx.restore();
  }
  const tex = scene.textures.addCanvas(key, canvas);
  if (tex) {
    for (let f = 0; f < frameCount; f++) {
      tex.add(f, 0, f * frameWidth, 0, frameWidth, frameHeight);
    }
  }
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

function drawHeroFrame(
  ctx: CanvasRenderingContext2D,
  heroId: HeroId,
  frame: number,
  w: number,
  h: number
): void {
  const cx = w / 2;
  const cy = h / 2 + 2;
  const phase = (frame / 4) * Math.PI * 2;
  const bob = Math.sin(phase) * 1.8;
  const stride = Math.sin(phase) * 5;
  const capeWave = Math.cos(phase) * 4.5;

  const palette =
    heroId === 'alaric'
      ? {
          cloakDark: '#173322',
          cloakMid: '#28593a',
          cloakLight: '#478f61',
          armor: '#3e352f',
          trim: '#e2c066',
          eye: '#fff1b8',
          skin: '#dec3ad',
        }
      : heroId === 'seraphina'
        ? {
            cloakDark: '#231445',
            cloakMid: '#45287d',
            cloakLight: '#734bc2',
            armor: '#dfe8f7',
            trim: '#7ce2ff',
            eye: '#9ef4ff',
            skin: '#ead7cc',
          }
        : {
            cloakDark: '#470d12',
            cloakMid: '#7d1922',
            cloakLight: '#b82e39',
            armor: '#595f6b',
            trim: '#e6c27a',
            eye: '#ff6978',
            skin: '#ccb4a2',
          };

  // Subtle rim aura
  const aura = ctx.createRadialGradient(cx, cy, 4, cx, cy, 26);
  aura.addColorStop(0, 'rgba(255,255,255,0.14)');
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fill();

  // Flowing back cape
  ctx.fillStyle = palette.cloakDark;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 11 + bob);
  ctx.quadraticCurveTo(cx - 19 - capeWave * 0.6, cy + 8, cx - 15 - capeWave, cy + 20);
  ctx.quadraticCurveTo(cx, cy + 23 + bob * 0.5, cx + 13 - capeWave * 0.4, cy + 19);
  ctx.quadraticCurveTo(cx + 15, cy + 4, cx + 9, cy - 11 + bob);
  ctx.closePath();
  ctx.fill();

  // Boots (animated stride)
  ctx.fillStyle = '#1b1618';
  ctx.beginPath();
  ctx.ellipse(cx - 5 + stride * 0.7, cy + 19, 4.2, 3.2, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 5 - stride * 0.7, cy + 19, 4.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Torso / armor coat
  ctx.fillStyle = palette.armor;
  ctx.beginPath();
  ctx.roundRect(cx - 9, cy - 8 + bob, 18, 22, 5);
  ctx.fill();

  // Shoulder mantle
  const cloakGrad = ctx.createLinearGradient(cx, cy - 16, cx, cy + 14);
  cloakGrad.addColorStop(0, palette.cloakLight);
  cloakGrad.addColorStop(1, palette.cloakMid);
  ctx.fillStyle = cloakGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy - 5 + bob);
  ctx.quadraticCurveTo(cx, cy - 14 + bob, cx + 13, cy - 5 + bob);
  ctx.lineTo(cx + 10, cy + 7 + bob);
  ctx.quadraticCurveTo(cx, cy + 11 + bob, cx - 10, cy + 7 + bob);
  ctx.closePath();
  ctx.fill();

  // Gold / Astral trim
  ctx.strokeStyle = palette.trim;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy + 6 + bob);
  ctx.quadraticCurveTo(cx, cy + 10 + bob, cx + 10, cy + 6 + bob);
  ctx.stroke();

  // Head / Hood / Greathelm
  if (heroId === 'kaelen') {
    // Iron Penitent Greathelm
    ctx.fillStyle = '#798191';
    ctx.beginPath();
    ctx.roundRect(cx - 8, cy - 22 + bob, 16, 15, 5);
    ctx.fill();
    ctx.fillStyle = '#1d181c';
    ctx.fillRect(cx - 5, cy - 16 + bob, 10, 3);
    ctx.fillRect(cx - 1.2, cy - 19 + bob, 2.4, 9);
  } else {
    // Gothic Cowl + Face
    ctx.fillStyle = palette.cloakMid;
    ctx.beginPath();
    ctx.arc(cx, cy - 15 + bob, 9.5, Math.PI * 0.85, Math.PI * 2.15);
    ctx.lineTo(cx + 9, cy - 7 + bob);
    ctx.lineTo(cx - 9, cy - 7 + bob);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#161118';
    ctx.beginPath();
    ctx.arc(cx + 1, cy - 14 + bob, 6.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Luminous eyes
  ctx.fillStyle = palette.eye;
  ctx.fillRect(cx - 3, cy - 15.5 + bob, 2.5, 2);
  ctx.fillRect(cx + 2, cy - 15.5 + bob, 2.5, 2);

  // Signature weapon silhouette in hand
  ctx.save();
  ctx.translate(cx + 11, cy + 1 + bob);
  if (heroId === 'alaric') {
    // Coiled silver whip handle + glowing tail
    ctx.strokeStyle = '#e8d8a8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.quadraticCurveTo(8, -4 + stride * 0.4, 6, 8);
    ctx.stroke();
  } else if (heroId === 'seraphina') {
    // Astral scepter
    ctx.strokeStyle = '#c5d8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(3, -12);
    ctx.stroke();
    ctx.fillStyle = '#7ce2ff';
    ctx.beginPath();
    ctx.arc(3, -14, 3.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Greataxe rested at side
    ctx.strokeStyle = '#8f7256';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-1, 11);
    ctx.lineTo(4, -14);
    ctx.stroke();
    ctx.fillStyle = '#cfd6e6';
    ctx.beginPath();
    ctx.arc(5, -10, 6.5, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemyFrame(
  ctx: CanvasRenderingContext2D,
  kind: EnemyKind,
  frame: number,
  w: number,
  h: number
): void {
  const cx = w / 2;
  const cy = h / 2;
  const phase = (frame / 4) * Math.PI * 2;
  const bob = Math.sin(phase) * 2.2;
  const swing = Math.cos(phase) * 4.5;

  ctx.save();
  switch (kind) {
    case 'bat': {
      const wingY = Math.sin(phase) * 9;
      ctx.fillStyle = '#3b1528';
      ctx.strokeStyle = '#9e2a47';
      ctx.lineWidth = 1.5;
      // Left & right wings
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx + dir * 12, cy - 11 - wingY, cx + dir * 21, cy - 2 - wingY * 0.8);
        ctx.quadraticCurveTo(cx + dir * 13, cy + 5, cx + dir * 3, cy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // Body + ears + red eyes
      ctx.fillStyle = '#240c18';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1, 5.5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff385c';
      ctx.fillRect(cx - 3, cy - 2, 2, 2);
      ctx.fillRect(cx + 1, cy - 2, 2, 2);
      break;
    }

    case 'flagellant': {
      // Hunched tattered pilgrim zombie (like screenshot 1)
      ctx.fillStyle = '#4c4a32';
      ctx.beginPath();
      ctx.moveTo(cx - 11, cy + 16);
      ctx.quadraticCurveTo(cx - 13, cy - 6 + bob, cx - 2, cy - 15 + bob);
      ctx.quadraticCurveTo(cx + 12, cy - 12 + bob, cx + 11, cy + 16);
      ctx.closePath();
      ctx.fill();

      // Pale hunched shoulders & skull-like face
      ctx.fillStyle = '#8b916f';
      ctx.beginPath();
      ctx.arc(cx + 2, cy - 8 + bob, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d94e4e';
      ctx.fillRect(cx + 1, cy - 9.5 + bob, 2, 2);
      ctx.fillRect(cx + 5, cy - 9.5 + bob, 2, 2);

      // Reaching arms
      ctx.strokeStyle = '#787d5f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + 4, cy - 1 + bob);
      ctx.lineTo(cx + 13, cy + 2 + swing * 0.4);
      ctx.stroke();
      break;
    }

    case 'dryad': {
      // Emerald forest spirit with golden hair/crown (homage to screenshot 3!)
      ctx.fillStyle = '#1d5e3a';
      ctx.beginPath();
      ctx.moveTo(cx - 9 - swing * 0.3, cy + 17);
      ctx.lineTo(cx - 5, cy - 5 + bob);
      ctx.lineTo(cx + 6, cy - 5 + bob);
      ctx.lineTo(cx + 10 - swing * 0.3, cy + 17);
      ctx.closePath();
      ctx.fill();

      // Golden crown/hair
      ctx.fillStyle = '#e0b865';
      ctx.beginPath();
      ctx.arc(cx, cy - 11 + bob, 6.5, 0, Math.PI * 2);
      ctx.fill();
      // Antler twigs
      ctx.strokeStyle = '#99e699';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy - 16 + bob);
      ctx.lineTo(cx - 7, cy - 22 + bob);
      ctx.moveTo(cx + 3, cy - 16 + bob);
      ctx.lineTo(cx + 7, cy - 22 + bob);
      ctx.stroke();

      ctx.fillStyle = '#7dffb3';
      ctx.fillRect(cx - 2.5, cy - 12 + bob, 2, 2);
      ctx.fillRect(cx + 1.5, cy - 12 + bob, 2, 2);
      break;
    }

    case 'mist_steed': {
      // Spectral dark-emerald galloping nightmare horse (homage to screenshot 3!)
      const gallop = Math.sin(phase) * 5;
      ctx.fillStyle = '#123824';
      ctx.strokeStyle = '#4ad688';
      ctx.lineWidth = 1.3;
      // Horse torso
      ctx.beginPath();
      ctx.ellipse(cx - 1, cy + 2 + bob * 0.6, 13, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Neck + head
      ctx.beginPath();
      ctx.moveTo(cx + 7, cy - 2 + bob);
      ctx.lineTo(cx + 13, cy - 13 + bob);
      ctx.lineTo(cx + 20, cy - 9 + bob);
      ctx.lineTo(cx + 12, cy + 2 + bob);
      ctx.closePath();
      ctx.fill();
      // Legs
      ctx.strokeStyle = '#1c5436';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy + 7);
      ctx.lineTo(cx - 13 - gallop, cy + 19);
      ctx.moveTo(cx + 8, cy + 7);
      ctx.lineTo(cx + 12 + gallop, cy + 19);
      ctx.stroke();
      // Spectral eye & mane
      ctx.fillStyle = '#8affc1';
      ctx.fillRect(cx + 14, cy - 11 + bob, 2.5, 2);
      break;
    }

    case 'acolyte': {
      // Floating crimson cultist with golden stole
      ctx.fillStyle = '#5e1123';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 19 + bob);
      ctx.lineTo(cx + 13, cy + 16 + bob * 0.5);
      ctx.quadraticCurveTo(cx, cy + 21, cx - 13, cy + 16 + bob * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#e8b954';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 6 + bob);
      ctx.lineTo(cx - 6, cy + 14 + bob * 0.5);
      ctx.moveTo(cx + 4, cy - 6 + bob);
      ctx.lineTo(cx + 6, cy + 14 + bob * 0.5);
      ctx.stroke();

      ctx.fillStyle = '#17070c';
      ctx.beginPath();
      ctx.arc(cx, cy - 10 + bob, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(cx - 3, cy - 11 + bob, 2.2, 2);
      ctx.fillRect(cx + 1, cy - 11 + bob, 2.2, 2);
      break;
    }

    case 'hollow_knight': {
      // Heavy dark-plate knight with horned helm & glowing visor
      ctx.fillStyle = '#2d3142';
      ctx.strokeStyle = '#6c7594';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(cx - 12, cy - 8 + bob * 0.6, 24, 24, 5);
      ctx.fill();
      ctx.stroke();

      // Horned helm
      ctx.fillStyle = '#3d4359';
      ctx.beginPath();
      ctx.arc(cx, cy - 13 + bob * 0.6, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b8c0d9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 16 + bob * 0.6);
      ctx.lineTo(cx - 13, cy - 24 + bob * 0.6);
      ctx.moveTo(cx + 6, cy - 16 + bob * 0.6);
      ctx.lineTo(cx + 13, cy - 24 + bob * 0.6);
      ctx.stroke();

      // Visor slit
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(cx - 5, cy - 14 + bob * 0.6, 10, 2.4);
      break;
    }

    case 'fenrir':
    case 'malakor':
    case 'reaper': {
      // Boss silhouettes (drawn on 72x72 canvas)
      const auraColor =
        kind === 'fenrir'
          ? 'rgba(255, 170, 64, 0.24)'
          : kind === 'malakor'
            ? 'rgba(255, 42, 85, 0.28)'
            : 'rgba(200, 60, 255, 0.30)';
      const grad = ctx.createRadialGradient(cx, cy, 6, cx, cy, 32);
      grad.addColorStop(0, auraColor);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.fill();

      if (kind === 'fenrir') {
        // Giant Werewolf Beast (homage to screenshot 3 mini-boss!)
        ctx.fillStyle = '#4a3d36';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 2 + bob, 16, 19, 0, 0, Math.PI * 2);
        ctx.fill();
        // Wolf head & ears
        ctx.fillStyle = '#5e4e45';
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy - 26 + bob);
        ctx.lineTo(cx - 5, cy - 14 + bob);
        ctx.lineTo(cx + 5, cy - 14 + bob);
        ctx.lineTo(cx + 10, cy - 26 + bob);
        ctx.lineTo(cx + 12, cy - 8 + bob);
        ctx.lineTo(cx - 12, cy - 8 + bob);
        ctx.closePath();
        ctx.fill();
        // Glowing amber eyes & claws
        ctx.fillStyle = '#ffbe3b';
        ctx.fillRect(cx - 5, cy - 14 + bob, 3.2, 2.6);
        ctx.fillRect(cx + 2, cy - 14 + bob, 3.2, 2.6);
        ctx.strokeStyle = '#e8dfd5';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cx + 14, cy + bob);
        ctx.lineTo(cx + 24, cy + 8 + swing);
        ctx.moveTo(cx - 14, cy + bob);
        ctx.lineTo(cx - 24, cy + 8 - swing);
        ctx.stroke();
      } else if (kind === 'malakor') {
        // Vampire Cardinal with high crimson collar (homage to cover art!)
        ctx.fillStyle = '#6e0b1e';
        ctx.beginPath();
        ctx.moveTo(cx - 22, cy - 18 + bob);
        ctx.quadraticCurveTo(cx, cy - 8 + bob, cx + 22, cy - 18 + bob);
        ctx.lineTo(cx + 18, cy + 25);
        ctx.quadraticCurveTo(cx, cy + 30, cx - 18, cy + 25);
        ctx.closePath();
        ctx.fill();
        // Pale vampire face
        ctx.fillStyle = '#d8ced6';
        ctx.beginPath();
        ctx.arc(cx, cy - 13 + bob, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff1e42';
        ctx.fillRect(cx - 4.5, cy - 14.5 + bob, 3, 2.4);
        ctx.fillRect(cx + 1.5, cy - 14.5 + bob, 3, 2.4);
      } else {
        // Crimson Reaper with Giant Scythe
        ctx.fillStyle = '#2b0918';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 28 + bob);
        ctx.lineTo(cx + 20, cy + 25);
        ctx.quadraticCurveTo(cx, cy + 31, cx - 20, cy + 25);
        ctx.closePath();
        ctx.fill();
        // Scythe blade
        ctx.strokeStyle = '#ffccd7';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + 12, cy + 22);
        ctx.lineTo(cx + 16, cy - 24 + bob);
        ctx.quadraticCurveTo(cx - 12, cy - 30 + bob, cx - 22, cy - 12 + bob);
        ctx.stroke();
        ctx.fillStyle = '#ff2a55';
        ctx.fillRect(cx - 5, cy - 15 + bob, 3.2, 3);
        ctx.fillRect(cx + 2, cy - 15 + bob, 3.2, 3);
      }
      break;
    }
  }
  ctx.restore();
}

export function createHeroPortraitDataUrl(heroId: HeroId): string {
  const { canvas, ctx } = makeCanvas(96, 96);
  ctx.save();
  ctx.scale(1.5, 1.5);
  drawHeroFrame(ctx, heroId, 0, 64, 64);
  ctx.restore();
  return canvas.toDataURL();
}

export function forgeAllTexturesAndAnims(scene: Phaser.Scene): void {
  // 1. Lush Dark Gothic Forest Tile (256x256)
  registerSingle(scene, 'forest_tile', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1b2b18';
    ctx.fillRect(0, 0, w, h);

    // Subtle mossy patches & grass tufts (seeded deterministic look)
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < 95; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 10 + rand() * 26;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(38, 61, 31, 0.42)' : 'rgba(18, 31, 16, 0.45)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crisp pixel/painterly grass blades
    for (let i = 0; i < 240; i++) {
      const gx = Math.floor(rand() * w);
      const gy = Math.floor(rand() * h);
      ctx.fillStyle = rand() > 0.5 ? '#2f4d27' : '#243d1e';
      ctx.fillRect(gx, gy, 2, 5);
      ctx.fillRect(gx + 3, gy + 1, 2, 4);
    }
  });

  // 2. Ancient Dirt & Cobblestone Cathedral Road Tile (160x256)
  registerSingle(scene, 'road_tile', 160, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(54, 43, 33, 0)');
    grad.addColorStop(0.18, 'rgba(62, 49, 37, 0.88)');
    grad.addColorStop(0.5, 'rgba(74, 59, 45, 0.95)');
    grad.addColorStop(0.82, 'rgba(62, 49, 37, 0.88)');
    grad.addColorStop(1, 'rgba(54, 43, 33, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Worn flagstones
    ctx.fillStyle = 'rgba(98, 84, 70, 0.35)';
    for (let y = 12; y < h; y += 32) {
      ctx.beginPath();
      ctx.roundRect(34 + ((y * 7) % 18), y, 36, 20, 5);
      ctx.roundRect(84 + ((y * 3) % 14), y + 10, 38, 20, 5);
      ctx.fill();
    }
  });

  // 3. Gothic Scenery Props (Ruined Pillar, Dead Tree, Flickering Brazier)
  registerSingle(scene, 'prop_pillar', 56, 84, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(28, 76, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5d6057';
    ctx.fillRect(14, 22, 28, 52);
    ctx.fillStyle = '#75796e';
    ctx.fillRect(10, 16, 36, 8);
    ctx.fillRect(10, 68, 36, 9);
    // Fluted grooves
    ctx.fillStyle = '#43463f';
    ctx.fillRect(19, 26, 3, 40);
    ctx.fillRect(27, 26, 3, 40);
    ctx.fillRect(35, 26, 3, 40);
  });

  registerSingle(scene, 'prop_tree', 76, 96, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(38, 86, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#2d221c';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(38, 84);
    ctx.quadraticCurveTo(35, 52, 38, 30);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(37, 46);
    ctx.lineTo(16, 24);
    ctx.moveTo(38, 38);
    ctx.lineTo(60, 18);
    ctx.moveTo(38, 30);
    ctx.lineTo(28, 10);
    ctx.stroke();
  });

  registerSingle(scene, 'prop_brazier', 48, 64, (ctx) => {
    ctx.fillStyle = '#363238';
    ctx.beginPath();
    ctx.moveTo(14, 34);
    ctx.lineTo(34, 34);
    ctx.lineTo(29, 56);
    ctx.lineTo(19, 56);
    ctx.closePath();
    ctx.fill();
    // Glowing flame
    const flame = ctx.createRadialGradient(24, 24, 2, 24, 24, 18);
    flame.addColorStop(0, '#fff6bd');
    flame.addColorStop(0.45, '#ff7b29');
    flame.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.arc(24, 24, 18, 0, Math.PI * 2);
    ctx.fill();
  });

  // 4. Ground Shadow
  registerSingle(scene, 'vfx_shadow', 48, 24, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.58)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // 5. Heroes (4 frames each + Phaser anims)
  const heroIds: HeroId[] = ['alaric', 'seraphina', 'kaelen'];
  for (const hId of heroIds) {
    const key = `hero_${hId}`;
    registerSheet(scene, key, 64, 64, 4, (ctx, frame, w, h) => drawHeroFrame(ctx, hId, frame, w, h));
    if (!scene.anims.exists(`${key}_walk`)) {
      scene.anims.create({
        key: `${key}_walk`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
    }
  }

  // 6. Enemies & Bosses (4 frames each + Phaser anims)
  const regularEnemies: EnemyKind[] = [
    'bat',
    'flagellant',
    'dryad',
    'mist_steed',
    'acolyte',
    'hollow_knight',
  ];
  for (const kind of regularEnemies) {
    const key = `enemy_${kind}`;
    registerSheet(scene, key, 48, 48, 4, (ctx, frame, w, h) =>
      drawEnemyFrame(ctx, kind, frame, w, h)
    );
    if (!scene.anims.exists(`${key}_move`)) {
      scene.anims.create({
        key: `${key}_move`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
        frameRate: kind === 'bat' || kind === 'mist_steed' ? 11 : 7,
        repeat: -1,
      });
    }
  }

  const bosses: EnemyKind[] = ['fenrir', 'malakor', 'reaper'];
  for (const kind of bosses) {
    const key = `enemy_${kind}`;
    registerSheet(scene, key, 72, 72, 4, (ctx, frame, w, h) =>
      drawEnemyFrame(ctx, kind, frame, w, h)
    );
    if (!scene.anims.exists(`${key}_move`)) {
      scene.anims.create({
        key: `${key}_move`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
        frameRate: 7,
        repeat: -1,
      });
    }
  }

  // 7. Weapon & VFX Textures
  // Whip crescent slash (inspired by screenshot 1's iconic sweeping white crescent!)
  registerSingle(scene, 'vfx_whip_slash', 156, 68, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(10, h / 2, w - 8, h / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.35, 'rgba(255,248,225,0.92)');
    grad.addColorStop(0.85, '#ffffff');
    grad.addColorStop(1, 'rgba(255,240,190,0.2)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(8, h * 0.62);
    ctx.quadraticCurveTo(w * 0.56, h * 0.04, w - 8, h * 0.48);
    ctx.quadraticCurveTo(w * 0.58, h * 0.36, 8, h * 0.62);
    ctx.closePath();
    ctx.fill();
  });

  // Wand astral bolt
  registerSingle(scene, 'vfx_wand_bolt', 36, 18, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.68, h / 2, 1, w * 0.5, h / 2, 16);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#6ee2ff');
    g.addColorStop(1, 'rgba(60,150,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(2, h / 2);
    ctx.lineTo(w * 0.7, 3);
    ctx.lineTo(w - 2, h / 2);
    ctx.lineTo(w * 0.7, h - 3);
    ctx.closePath();
    ctx.fill();
  });

  // Sacred Bible orbital
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

  // Executioner Axe & Eclipse Scythe
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

  // Sacred Thurible Runic Aura Ring (like screenshot 1's concentric rings!)
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

  // Lightning bolt
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

  // XP Gems (Sapphire, Amber, Ruby — faceted crystals like screenshots 1 & 3!)
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

  // Golden Reliquary Chest
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

  // Soft particle & mist wisp
  registerSingle(scene, 'vfx_particle', 16, 16, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  registerSingle(scene, 'vfx_fog', 160, 96, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(185, 195, 225, 0.16)');
    g.addColorStop(1, 'rgba(185, 195, 225, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
