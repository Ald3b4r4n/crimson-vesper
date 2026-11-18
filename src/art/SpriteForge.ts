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
  const cy = h / 2 + 4;
  const phase = (frame / 6) * Math.PI * 2;
  const bob = Math.sin(phase * 2) * 1.6;
  const legSwing = Math.sin(phase) * 7.5;
  const armSwing = Math.cos(phase) * 4.5;
  const capeWave = Math.sin(phase - 0.7) * 6;

  const pal =
    heroId === 'alaric'
      ? {
          cloakDeep: '#102418',
          cloakMid: '#214d33',
          cloakRim: '#4ca66d',
          coat: '#2e241f',
          metal: '#8c96a6',
          trim: '#e6c365',
          glow: 'rgba(230,195,101,0.22)',
          eye: '#fff0b3',
        }
      : heroId === 'seraphina'
        ? {
            cloakDeep: '#1b0e38',
            cloakMid: '#3f2278',
            cloakRim: '#7b52cc',
            coat: '#221a3a',
            metal: '#dce8ff',
            trim: '#7ce8ff',
            glow: 'rgba(124,232,255,0.25)',
            eye: '#9ef4ff',
          }
        : heroId === 'kaelen'
          ? {
              cloakDeep: '#3d090f',
              cloakMid: '#7d1520',
              cloakRim: '#c92e3d',
              coat: '#343842',
              metal: '#7c8599',
              trim: '#e8c478',
              glow: 'rgba(255,77,109,0.22)',
              eye: '#ff5969',
            }
          : {
              cloakDeep: '#3d3322',
              cloakMid: '#cfc4ad',
              cloakRim: '#ffffff',
              coat: '#6e1423',
              metal: '#e8dcc2',
              trim: '#ffd966',
              glow: 'rgba(255,225,120,0.26)',
              eye: '#ffe680',
            };

  // Subtle heroic rim backlight
  const aura = ctx.createRadialGradient(cx, cy - 4, 4, cx, cy - 4, 36);
  aura.addColorStop(0, pal.glow);
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 36, 0, Math.PI * 2);
  ctx.fill();

  // 1. Multi-fold Billowing Back Cloak
  const cloakGrad = ctx.createLinearGradient(cx - 20, cy - 22, cx + 14, cy + 28);
  cloakGrad.addColorStop(0, pal.cloakMid);
  cloakGrad.addColorStop(1, pal.cloakDeep);
  ctx.fillStyle = cloakGrad;
  ctx.strokeStyle = pal.cloakRim;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 11, cy - 18 + bob);
  ctx.bezierCurveTo(
    cx - 24 - capeWave * 0.6,
    cy - 2,
    cx - 26 - capeWave,
    cy + 16,
    cx - 18 - capeWave * 1.1,
    cy + 27
  );
  ctx.lineTo(cx - 6 - capeWave * 0.5, cy + 24);
  ctx.lineTo(cx + 3 - capeWave * 0.3, cy + 28);
  ctx.lineTo(cx + 14 - capeWave * 0.2, cy + 23);
  ctx.quadraticCurveTo(cx + 16, cy + 4, cx + 10, cy - 18 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. Articulated Striding Legs & Armored Greaves
  for (const side of [-1, 1]) {
    const swing = side * legSwing;
    const footX = cx + side * 5 + swing * 0.85;
    const footY = cy + 26 - Math.abs(swing) * 0.22;

    ctx.strokeStyle = '#1b161c';
    ctx.lineWidth = 5.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + side * 4.5, cy + 8 + bob);
    ctx.quadraticCurveTo(cx + side * 5 + swing * 0.4, cy + 17, footX, footY);
    ctx.stroke();

    // Metallic knee / boot cuff
    ctx.fillStyle = pal.metal;
    ctx.beginPath();
    ctx.ellipse(footX + 1.5, footY + 1, 4.8, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Tailored Coat / Cuirass Torso
  ctx.fillStyle = pal.coat;
  ctx.beginPath();
  ctx.moveTo(cx - 11, cy - 14 + bob);
  ctx.lineTo(cx + 11, cy - 14 + bob);
  ctx.lineTo(cx + 13, cy + 12 + bob);
  ctx.lineTo(cx - 13, cy + 12 + bob);
  ctx.closePath();
  ctx.fill();

  // Chestplate / Cross-Bandolier + Belt Buckle
  if (heroId === 'kaelen' || heroId === 'valeria') {
    const plateGrad = ctx.createLinearGradient(cx - 10, cy - 14, cx + 10, cy + 6);
    plateGrad.addColorStop(0, '#eef2fa');
    plateGrad.addColorStop(0.45, pal.metal);
    plateGrad.addColorStop(1, '#2b303b');
    ctx.fillStyle = plateGrad;
    ctx.beginPath();
    ctx.roundRect(cx - 10, cy - 13 + bob, 20, 17, 4);
    ctx.fill();
  } else {
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 12 + bob);
    ctx.lineTo(cx + 8, cy + 6 + bob);
    ctx.stroke();
  }

  // Belt + Golden Buckle
  ctx.fillStyle = '#1c1417';
  ctx.fillRect(cx - 11, cy + 4 + bob, 22, 4);
  ctx.fillStyle = pal.trim;
  ctx.fillRect(cx - 3, cy + 3.5 + bob, 6, 5);

  // 4. Layered Pauldrons / Shoulder Mantle
  ctx.fillStyle = pal.cloakMid;
  ctx.strokeStyle = pal.trim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy - 9 + bob);
  ctx.quadraticCurveTo(cx, cy - 19 + bob, cx + 16, cy - 9 + bob);
  ctx.lineTo(cx + 12, cy - 1 + bob);
  ctx.quadraticCurveTo(cx, cy + 3 + bob, cx - 12, cy - 1 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 5. Head, Cowl, Blindfold or Greathelm
  if (heroId === 'kaelen') {
    // Winged Dark-Iron Crusader Greathelm
    const helmGrad = ctx.createLinearGradient(cx - 9, cy - 31, cx + 9, cy - 14);
    helmGrad.addColorStop(0, '#aeb7c9');
    helmGrad.addColorStop(0.5, '#596173');
    helmGrad.addColorStop(1, '#282c36');
    ctx.fillStyle = helmGrad;
    ctx.beginPath();
    ctx.roundRect(cx - 8.5, cy - 30 + bob, 17, 17, [7, 7, 3, 3]);
    ctx.fill();
    // T-Visor + Glowing Crimson Slit
    ctx.fillStyle = '#140c10';
    ctx.fillRect(cx - 6, cy - 23 + bob, 12, 3.2);
    ctx.fillRect(cx - 1.5, cy - 25 + bob, 3, 10);
    ctx.fillStyle = pal.eye;
    ctx.fillRect(cx - 5, cy - 22.4 + bob, 4, 2);
    ctx.fillRect(cx + 1, cy - 22.4 + bob, 4, 2);
  } else {
    // Gothic Pointed Hood + Shadowed Face
    ctx.fillStyle = pal.cloakMid;
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 33 + bob);
    ctx.quadraticCurveTo(cx + 13, cy - 26 + bob, cx + 11, cy - 13 + bob);
    ctx.lineTo(cx - 11, cy - 13 + bob);
    ctx.quadraticCurveTo(cx - 13, cy - 26 + bob, cx, cy - 33 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#160f18';
    ctx.beginPath();
    ctx.arc(cx + 0.5, cy - 21 + bob, 6.8, 0, Math.PI * 2);
    ctx.fill();

    if (heroId === 'seraphina') {
      // Silver Astral Blindfold with glowing starlight
      ctx.fillStyle = '#dce8ff';
      ctx.fillRect(cx - 6, cy - 23.5 + bob, 13, 3.6);
      ctx.fillStyle = '#7ce8ff';
      ctx.fillRect(cx - 2, cy - 23 + bob, 5, 2.4);
    } else {
      ctx.fillStyle = pal.eye;
      ctx.fillRect(cx - 3.8, cy - 22.5 + bob, 2.8, 2.2);
      ctx.fillRect(cx + 2, cy - 22.5 + bob, 2.8, 2.2);
    }
  }

  // 6. Articulated Weapon Arm & Signature Relic Weapon
  ctx.save();
  ctx.translate(cx + 12, cy - 3 + bob + armSwing * 0.4);
  if (heroId === 'alaric') {
    // Glowing Silver Chain Whip
    ctx.strokeStyle = '#fff3cf';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-2, 2);
    ctx.bezierCurveTo(10, -8, 16, 8 + armSwing, 5, 16);
    ctx.stroke();
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(-4, -1, 5, 6);
  } else if (heroId === 'seraphina') {
    // Tall Ornate Astral Scepter
    ctx.strokeStyle = '#d4e4ff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-1, 15);
    ctx.lineTo(4, -20);
    ctx.stroke();
    const orb = ctx.createRadialGradient(4, -22, 1, 4, -22, 8);
    orb.addColorStop(0, '#ffffff');
    orb.addColorStop(0.5, '#7ce8ff');
    orb.addColorStop(1, 'rgba(124,232,255,0)');
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(4, -22, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (heroId === 'kaelen') {
    // Runic Double-Bladed Executioner Greataxe
    ctx.strokeStyle = '#7a5c43';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-2, 16);
    ctx.lineTo(6, -22);
    ctx.stroke();
    ctx.fillStyle = '#d8e0f0';
    ctx.strokeStyle = '#ff5969';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(5, -18);
    ctx.quadraticCurveTo(18, -22, 16, -7);
    ctx.quadraticCurveTo(9, -10, 4, -10);
    ctx.quadraticCurveTo(-4, -12, -5, -21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Sister Valeria's Radiant Golden Cross-Blade
    ctx.strokeStyle = '#ffe082';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, -19);
    ctx.lineTo(2, 12);
    ctx.moveTo(-7, -9);
    ctx.lineTo(11, -9);
    ctx.stroke();
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
  const cy = h / 2 + 2;
  const phase = (frame / 6) * Math.PI * 2;
  const bob = Math.sin(phase) * 2.6;
  const stride = Math.sin(phase) * 6;
  const wing = Math.sin(phase) * 12;

  ctx.save();

  switch (kind) {
    case 'bat': {
      // Veined Vampire Bat
      ctx.fillStyle = '#361024';
      ctx.strokeStyle = '#bd284d';
      ctx.lineWidth = 1.6;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - 2);
        ctx.quadraticCurveTo(cx + dir * 15, cy - 18 - wing, cx + dir * 28, cy - 4 - wing * 0.8);
        ctx.lineTo(cx + dir * 20, cy + 5 - wing * 0.3);
        ctx.lineTo(cx + dir * 11, cy + 2);
        ctx.lineTo(cx + dir * 4, cy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#1f0814';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pointed ears & glowing eyes
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 6);
      ctx.lineTo(cx - 8, cy - 15);
      ctx.lineTo(cx - 1, cy - 8);
      ctx.moveTo(cx + 5, cy - 6);
      ctx.lineTo(cx + 8, cy - 15);
      ctx.lineTo(cx + 1, cy - 8);
      ctx.fill();
      ctx.fillStyle = '#ff2a55';
      ctx.fillRect(cx - 4, cy - 3, 3, 2.4);
      ctx.fillRect(cx + 1, cy - 3, 3, 2.4);
      break;
    }

    case 'flagellant': {
      // Hooded Zealot swinging a spiked censer
      ctx.fillStyle = '#383425';
      ctx.strokeStyle = '#6b6449';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - 13, cy + 22);
      ctx.quadraticCurveTo(cx - 15, cy - 4 + bob, cx - 2, cy - 20 + bob);
      ctx.quadraticCurveTo(cx + 13, cy - 15 + bob, cx + 13, cy + 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Skull mask
      ctx.fillStyle = '#b8bfa8';
      ctx.beginPath();
      ctx.arc(cx + 3, cy - 11 + bob, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(cx + 1, cy - 12.5 + bob, 2.5, 2.2);
      ctx.fillRect(cx + 5.5, cy - 12.5 + bob, 2.5, 2.2);
      // Swinging chain censer
      ctx.strokeStyle = '#9aa0a6';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx + 8, cy - 1 + bob);
      ctx.lineTo(cx + 18, cy + 10 + stride * 0.7);
      ctx.stroke();
      ctx.fillStyle = '#ff9233';
      ctx.beginPath();
      ctx.arc(cx + 18, cy + 12 + stride * 0.7, 4.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'dryad': {
      // Stag-Antler Briar Dryad
      ctx.fillStyle = '#184d30';
      ctx.strokeStyle = '#4ad688';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - 12 - stride * 0.3, cy + 23);
      ctx.quadraticCurveTo(cx - 7, cy, cx - 6, cy - 10 + bob);
      ctx.lineTo(cx + 7, cy - 10 + bob);
      ctx.quadraticCurveTo(cx + 9, cy, cx + 13 - stride * 0.3, cy + 23);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Crown & branching antlers
      ctx.fillStyle = '#d4af63';
      ctx.beginPath();
      ctx.arc(cx, cy - 15 + bob, 6.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a8f0b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 20 + bob);
      ctx.lineTo(cx - 12, cy - 30 + bob);
      ctx.moveTo(cx - 8, cy - 25 + bob);
      ctx.lineTo(cx - 14, cy - 24 + bob);
      ctx.moveTo(cx + 4, cy - 20 + bob);
      ctx.lineTo(cx + 12, cy - 30 + bob);
      ctx.stroke();
      ctx.fillStyle = '#6bffb3';
      ctx.fillRect(cx - 3.5, cy - 16 + bob, 2.5, 2.2);
      ctx.fillRect(cx + 1.5, cy - 16 + bob, 2.5, 2.2);
      break;
    }

    case 'mist_steed': {
      // Spectral Armored Nightmare Steed
      ctx.fillStyle = '#113022';
      ctx.strokeStyle = '#52f29c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(cx - 2, cy + 2 + bob * 0.6, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Neck & armored head
      ctx.beginPath();
      ctx.moveTo(cx + 8, cy - 2 + bob);
      ctx.lineTo(cx + 16, cy - 18 + bob);
      ctx.lineTo(cx + 25, cy - 12 + bob);
      ctx.lineTo(cx + 14, cy + 2 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Blazing spectral mane
      ctx.fillStyle = '#6bffb8';
      ctx.beginPath();
      ctx.moveTo(cx + 6, cy - 5 + bob);
      ctx.quadraticCurveTo(cx + 4 - stride * 0.5, cy - 18 + bob, cx + 15, cy - 19 + bob);
      ctx.fill();
      // Galloping legs
      ctx.strokeStyle = '#256647';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(cx - 11, cy + 8);
      ctx.lineTo(cx - 17 - stride, cy + 24);
      ctx.moveTo(cx + 9, cy + 8);
      ctx.lineTo(cx + 16 + stride, cy + 24);
      ctx.stroke();
      break;
    }

    case 'banshee': {
      // Castle Wailing Phantasm with Lantern
      const shroud = ctx.createLinearGradient(cx, cy - 24, cx, cy + 26);
      shroud.addColorStop(0, 'rgba(195, 166, 255, 0.92)');
      shroud.addColorStop(1, 'rgba(72, 34, 128, 0.1)');
      ctx.fillStyle = shroud;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 24 + bob);
      ctx.quadraticCurveTo(cx + 16, cy - 6 + bob, cx + 15 - stride * 0.6, cy + 24);
      ctx.quadraticCurveTo(cx, cy + 18, cx - 16 - stride * 0.6, cy + 25);
      ctx.quadraticCurveTo(cx - 15, cy - 6 + bob, cx, cy - 24 + bob);
      ctx.fill();
      ctx.fillStyle = '#1b0d2e';
      ctx.beginPath();
      ctx.arc(cx + 1, cy - 13 + bob, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d8b4ff';
      ctx.fillRect(cx - 3, cy - 14 + bob, 2.5, 2.5);
      ctx.fillRect(cx + 2, cy - 14 + bob, 2.5, 2.5);
      // Ghostly blue lantern
      ctx.fillStyle = '#7ce8ff';
      ctx.beginPath();
      ctx.arc(cx + 15, cy + 2 + bob, 4.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'skeleton': {
      // Dungeon Skeleton Warrior with Scimitar & Buckler
      ctx.strokeStyle = '#d9d2c5';
      ctx.lineWidth = 2.6;
      // Spine + ribs + legs
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10 + bob);
      ctx.lineTo(cx, cy + 7 + bob);
      ctx.moveTo(cx - 7, cy - 6 + bob);
      ctx.lineTo(cx + 7, cy - 6 + bob);
      ctx.moveTo(cx - 6, cy - 2 + bob);
      ctx.lineTo(cx + 6, cy - 2 + bob);
      ctx.moveTo(cx - 4, cy + 7 + bob);
      ctx.lineTo(cx - 6 + stride * 0.7, cy + 23);
      ctx.moveTo(cx + 4, cy + 7 + bob);
      ctx.lineTo(cx + 6 - stride * 0.7, cy + 23);
      ctx.stroke();
      // Skull
      ctx.fillStyle = '#e6dfd3';
      ctx.beginPath();
      ctx.arc(cx, cy - 16 + bob, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#52ff9a';
      ctx.fillRect(cx - 3.5, cy - 17 + bob, 2.4, 2.4);
      ctx.fillRect(cx + 1.2, cy - 17 + bob, 2.4, 2.4);
      // Curved scimitar
      ctx.strokeStyle = '#aeb8c4';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx + 9, cy + 2 + bob);
      ctx.quadraticCurveTo(cx + 21, cy - 8 + stride * 0.5, cx + 16, cy - 20 + bob);
      ctx.stroke();
      break;
    }

    case 'jailer': {
      // Hulking Iron-Masked Dungeon Executioner
      ctx.fillStyle = '#2b302e';
      ctx.strokeStyle = '#62ff9c';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(cx - 15, cy - 11 + bob * 0.6, 30, 30, 7);
      ctx.fill();
      ctx.stroke();
      // Iron cage helm
      ctx.fillStyle = '#4a524f';
      ctx.fillRect(cx - 8, cy - 23 + bob * 0.6, 16, 14);
      ctx.fillStyle = '#62ff9c';
      ctx.fillRect(cx - 4, cy - 17 + bob * 0.6, 8, 2.5);
      // Giant meat hook
      ctx.strokeStyle = '#9ea8a4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + 15, cy + bob * 0.6);
      ctx.lineTo(cx + 24, cy - 12 + bob * 0.6);
      ctx.arc(cx + 20, cy - 14 + bob * 0.6, 5, 0, Math.PI, true);
      ctx.stroke();
      break;
    }

    case 'magma_imp': {
      // Volcanic Winged Gargoyle with Lava Cracks
      ctx.fillStyle = '#291410';
      ctx.strokeStyle = '#ff6d1f';
      ctx.lineWidth = 1.8;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - 4);
        ctx.lineTo(cx + dir * 24, cy - 16 - wing * 0.7);
        ctx.lineTo(cx + dir * 17, cy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffbe3b';
      ctx.fillRect(cx - 5, cy - 3, 3.2, 2.6);
      ctx.fillRect(cx + 2, cy - 3, 3.2, 2.6);
      break;
    }

    case 'lava_golem': {
      // Towering Basalt & Molten Magma Juggernaut
      ctx.fillStyle = '#261816';
      ctx.strokeStyle = '#ff5400';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(cx - 18, cy - 16 + bob * 0.5, 36, 36, 9);
      ctx.fill();
      ctx.stroke();
      // Glowing molten core fissures
      ctx.strokeStyle = '#ffd000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy - 6 + bob * 0.5);
      ctx.lineTo(cx, cy + 4 + bob * 0.5);
      ctx.lineTo(cx + 10, cy - 5 + bob * 0.5);
      ctx.stroke();
      ctx.fillStyle = '#fff066';
      ctx.fillRect(cx - 6, cy - 12 + bob * 0.5, 4, 3);
      ctx.fillRect(cx + 2, cy - 12 + bob * 0.5, 4, 3);
      break;
    }

    case 'plague_doctor': {
      // Beaked Alchemist Cultist
      ctx.fillStyle = '#1f1b29';
      ctx.strokeStyle = '#80ed99';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - 13, cy + 23);
      ctx.lineTo(cx - 9, cy - 10 + bob);
      ctx.lineTo(cx + 9, cy - 10 + bob);
      ctx.lineTo(cx + 13, cy + 23);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Bone raven beak mask + wide hat
      ctx.fillStyle = '#120f17';
      ctx.fillRect(cx - 13, cy - 20 + bob, 26, 3.5);
      ctx.fillStyle = '#e0d8c8';
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 17 + bob);
      ctx.lineTo(cx + 15, cy - 12 + bob);
      ctx.lineTo(cx - 4, cy - 9 + bob);
      ctx.closePath();
      ctx.fill();
      // Glowing green flask in hand
      ctx.fillStyle = '#52ff9a';
      ctx.beginPath();
      ctx.arc(cx + 14, cy + 4 + stride * 0.4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'fallen_seraph': {
      // Four-Winged Desecrated Cathedral Angel
      ctx.fillStyle = '#3b152b';
      ctx.strokeStyle = '#ff7aa2';
      ctx.lineWidth = 1.4;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6 + bob);
        ctx.quadraticCurveTo(cx + dir * 24, cy - 24 - wing * 0.5, cx + dir * 26, cy + 2);
        ctx.quadraticCurveTo(cx + dir * 14, cy + 12, cx, cy + 4 + bob);
        ctx.fill();
        ctx.stroke();
      }
      // Broken golden halo
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy - 22 + bob, 8, -Math.PI * 0.8, Math.PI * 0.4);
      ctx.stroke();
      ctx.fillStyle = '#e8dce4';
      ctx.beginPath();
      ctx.roundRect(cx - 7, cy - 14 + bob, 14, 32, 4);
      ctx.fill();
      ctx.fillStyle = '#ff1e42';
      ctx.fillRect(cx - 3.5, cy - 11 + bob, 2.5, 4);
      ctx.fillRect(cx + 1.5, cy - 11 + bob, 2.5, 4);
      break;
    }

    case 'hollow_knight':
    case 'hell_fiend': {
      const isDemon = kind === 'hell_fiend';
      if (isDemon) {
        ctx.fillStyle = '#590814';
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx, cy - 8);
          ctx.lineTo(cx + dir * 27, cy - 22 - wing * 0.5);
          ctx.lineTo(cx + dir * 21, cy + 8);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = isDemon ? '#7a0f1e' : '#2a2e3d';
      ctx.strokeStyle = isDemon ? '#ff4d6d' : '#7c87a6';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(cx - 14, cy - 11 + bob * 0.6, 28, 30, 6);
      ctx.fill();
      ctx.stroke();

      // Horned helm / Demon horns
      ctx.fillStyle = isDemon ? '#45060f' : '#3d4359';
      ctx.beginPath();
      ctx.arc(cx, cy - 16 + bob * 0.6, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isDemon ? '#ff9e44' : '#cbd3eb';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 19 + bob * 0.6);
      ctx.lineTo(cx - 15, cy - 29 + bob * 0.6);
      ctx.moveTo(cx + 6, cy - 19 + bob * 0.6);
      ctx.lineTo(cx + 15, cy - 29 + bob * 0.6);
      ctx.stroke();

      ctx.fillStyle = isDemon ? '#ffe066' : '#ff4757';
      ctx.fillRect(cx - 5.5, cy - 17 + bob * 0.6, 11, 2.6);
      break;
    }

    default: {
      // 7 STAGE BOSSES (116x116 majestic silhouettes!)
      const auraColors: Record<string, string> = {
        boss_fenrir: 'rgba(255, 175, 64, 0.30)',
        boss_carmilla: 'rgba(215, 70, 255, 0.30)',
        boss_morghul: 'rgba(82, 255, 154, 0.28)',
        boss_ignis: 'rgba(255, 90, 20, 0.34)',
        boss_vane: 'rgba(130, 180, 255, 0.28)',
        boss_malakor: 'rgba(255, 42, 85, 0.34)',
        boss_reaper: 'rgba(255, 20, 68, 0.42)',
      };
      const aura = ctx.createRadialGradient(cx, cy, 8, cx, cy, 50);
      aura.addColorStop(0, auraColors[kind] ?? 'rgba(255,42,85,0.32)');
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, 50, 0, Math.PI * 2);
      ctx.fill();

      // Boss body & distinct crown/wings/scythe
      const bodyColor =
        kind === 'boss_fenrir'
          ? '#4a3931'
          : kind === 'boss_carmilla'
            ? '#5c0e2d'
            : kind === 'boss_morghul'
              ? '#263830'
              : kind === 'boss_ignis'
                ? '#4a170b'
                : kind === 'boss_vane'
                  ? '#252b3d'
                  : kind === 'boss_malakor'
                    ? '#6e0b22'
                    : '#1f0510';

      const trimColor =
        kind === 'boss_ignis'
          ? '#ff9e00'
          : kind === 'boss_morghul'
            ? '#62ff9c'
            : kind === 'boss_carmilla'
              ? '#e0aaff'
              : '#ffd166';

      // Sweeping Boss Wings / Sovereign Mantle
      ctx.fillStyle = bodyColor;
      ctx.strokeStyle = trimColor;
      ctx.lineWidth = 2.4;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - 16 + bob);
        ctx.quadraticCurveTo(
          cx + dir * 42,
          cy - 36 - wing * 0.8,
          cx + dir * 44,
          cy + 12 - wing * 0.3
        );
        ctx.quadraticCurveTo(cx + dir * 24, cy + 28, cx + dir * 8, cy + 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Central Sovereign Torso
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy - 22 + bob);
      ctx.lineTo(cx + 20, cy - 22 + bob);
      ctx.lineTo(cx + 24, cy + 34);
      ctx.quadraticCurveTo(cx, cy + 42, cx - 24, cy + 34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Crowned / Horned Boss Head
      ctx.fillStyle = '#170a14';
      ctx.beginPath();
      ctx.arc(cx, cy - 28 + bob, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Crown Spires
      ctx.fillStyle = trimColor;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 37 + bob);
      ctx.lineTo(cx - 13, cy - 49 + bob);
      ctx.lineTo(cx - 4, cy - 40 + bob);
      ctx.lineTo(cx, cy - 52 + bob);
      ctx.lineTo(cx + 4, cy - 40 + bob);
      ctx.lineTo(cx + 13, cy - 49 + bob);
      ctx.lineTo(cx + 10, cy - 37 + bob);
      ctx.closePath();
      ctx.fill();

      // Blazing Boss Eyes
      ctx.fillStyle = '#ff2a55';
      ctx.fillRect(cx - 7, cy - 30 + bob, 5, 3.5);
      ctx.fillRect(cx + 2, cy - 30 + bob, 5, 3.5);

      // Giant Eclipse Great-Scythe / Boss Halberd
      ctx.strokeStyle = '#fff0f5';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx + 22, cy + 34);
      ctx.lineTo(cx + 28, cy - 36 + bob);
      ctx.quadraticCurveTo(cx - 6, cy - 48 + bob, cx - 26, cy - 20 + bob);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

export function forgeStageTextures(scene: Phaser.Scene, stage: StageDefinition): {
  groundKey: string;
  roadKey: string;
  propKeys: [string, string, string];
} {
  const groundKey = `ground_${stage.id}`;
  const roadKey = `road_${stage.id}`;
  const propKeys: [string, string, string] = [
    `prop_${stage.id}_0`,
    `prop_${stage.id}_1`,
    `prop_${stage.id}_2`,
  ];

  // 1. Stage-Specific Ground Tile (256x256)
  registerSingle(scene, groundKey, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = stage.palette.groundBase;
    ctx.fillRect(0, 0, w, h);

    let seed = stage.order * 7919;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    if (stage.propStyle === 'castle' || stage.propStyle === 'temple' || stage.propStyle === 'dungeon') {
      // Checkered / Flagstone Architectural Floor
      const tileSz = 64;
      for (let y = 0; y < h; y += tileSz) {
        for (let x = 0; x < w; x += tileSz) {
          const alt = ((x / tileSz + y / tileSz) % 2) === 0;
          ctx.fillStyle = alt ? stage.palette.groundAccent : stage.palette.groundBase;
          ctx.fillRect(x + 1, y + 1, tileSz - 2, tileSz - 2);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.strokeRect(x, y, tileSz, tileSz);
        }
      }
    } else {
      // Organic Terrain (Forest, Volcano Desert, Metropolis Rubble, Inferno)
      for (let i = 0; i < 85; i++) {
        ctx.fillStyle = i % 2 === 0 ? stage.palette.groundAccent : stage.palette.groundDetail;
        ctx.globalAlpha = 0.38;
        ctx.beginPath();
        ctx.arc(rand() * w, rand() * h, 10 + rand() * 26, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Cracks / Lava veins / Grass tufts
    for (let i = 0; i < 120; i++) {
      const gx = rand() * w;
      const gy = rand() * h;
      if (stage.propStyle === 'volcano' || stage.propStyle === 'inferno') {
        ctx.strokeStyle = stage.propStyle === 'volcano' ? 'rgba(255,105,25,0.45)' : 'rgba(255,35,75,0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + (rand() - 0.5) * 24, gy + (rand() - 0.5) * 24);
        ctx.stroke();
      } else {
        ctx.fillStyle = stage.palette.groundDetail;
        ctx.fillRect(gx, gy, 2.5, 5);
      }
    }
  });

  // 2. Stage-Specific Road / Carpet / Magma Stream (168x256)
  registerSingle(scene, roadKey, 168, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.16, stage.palette.roadBase);
    grad.addColorStop(0.5, stage.palette.roadStone);
    grad.addColorStop(0.84, stage.palette.roadBase);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (stage.propStyle === 'castle' || stage.propStyle === 'temple') {
      // Royal Gold Filigree Carpet Trim
      ctx.fillStyle = '#e2c066';
      ctx.fillRect(28, 0, 3, h);
      ctx.fillRect(w - 31, 0, 3, h);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let y = 10; y < h; y += 36) {
        ctx.beginPath();
        ctx.roundRect(36, y, 42, 22, 4);
        ctx.roundRect(88, y + 12, 42, 22, 4);
        ctx.fill();
      }
    }
  });

  // 3. Stage Props (0 = Architectural Pillar/Statue, 1 = Organic/Rubble Obstacle, 2 = Illuminated Brazier/Vent)
  registerSingle(scene, propKeys[0], 64, 92, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(32, 82, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (stage.propStyle === 'inferno') {
      // Giant Demonic Bone Rib
      ctx.strokeStyle = '#d9c8b8';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(22, 82);
      ctx.quadraticCurveTo(8, 32, 46, 12);
      ctx.stroke();
    } else if (stage.propStyle === 'volcano') {
      // Jagged Obsidian Monolith
      ctx.fillStyle = '#1c1721';
      ctx.strokeStyle = '#ff6d1f';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(16, 82);
      ctx.lineTo(30, 10);
      ctx.lineTo(48, 82);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Fluted Gothic / Alabaster / Dungeon Pillar
      ctx.fillStyle = stage.propStyle === 'temple' ? '#cfc7d4' : '#585963';
      ctx.fillRect(18, 20, 28, 60);
      ctx.fillStyle = stage.propStyle === 'temple' ? '#e2c066' : '#747682';
      ctx.fillRect(13, 14, 38, 8);
      ctx.fillRect(13, 74, 38, 9);
    }
  });

  registerSingle(scene, propKeys[1], 76, 96, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(38, 86, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (stage.propStyle === 'dungeon') {
      // Hanging Iron Cage
      ctx.strokeStyle = '#6c757d';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(20, 24, 36, 48);
      ctx.beginPath();
      ctx.moveTo(38, 4);
      ctx.lineTo(38, 24);
      ctx.moveTo(29, 24);
      ctx.lineTo(29, 72);
      ctx.moveTo(47, 24);
      ctx.lineTo(47, 72);
      ctx.stroke();
    } else if (stage.propStyle === 'metropolis') {
      // Broken Siege Barricade & Banner
      ctx.strokeStyle = '#4a3525';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(14, 80);
      ctx.lineTo(62, 34);
      ctx.moveTo(62, 80);
      ctx.lineTo(14, 34);
      ctx.stroke();
    } else {
      // Gnarled Dead Tree / Gothic Spire Ruin
      ctx.strokeStyle = '#2b201d';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(38, 84);
      ctx.quadraticCurveTo(34, 52, 38, 28);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(37, 46);
      ctx.lineTo(16, 22);
      ctx.moveTo(38, 36);
      ctx.lineTo(60, 16);
      ctx.stroke();
    }
  });

  registerSingle(scene, propKeys[2], 52, 68, (ctx) => {
    ctx.fillStyle = '#2c2730';
    ctx.beginPath();
    ctx.moveTo(15, 36);
    ctx.lineTo(37, 36);
    ctx.lineTo(31, 60);
    ctx.lineTo(21, 60);
    ctx.closePath();
    ctx.fill();

    const hex = `#${stage.palette.emberTint.toString(16).padStart(6, '0')}`;
    const flame = ctx.createRadialGradient(26, 24, 2, 26, 24, 20);
    flame.addColorStop(0, '#ffffff');
    flame.addColorStop(0.45, hex);
    flame.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.arc(26, 24, 20, 0, Math.PI * 2);
    ctx.fill();
  });

  return { groundKey, roadKey, propKeys };
}

export function forgeAllTexturesAndAnims(scene: Phaser.Scene): void {
  // Ground shadow
  registerSingle(scene, 'vfx_shadow', 52, 24, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.62)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // 4 Upgraded Heroes (84x84, 6 frames each)
  const heroIds: HeroId[] = ['alaric', 'seraphina', 'kaelen', 'valeria'];
  for (const hId of heroIds) {
    const key = `hero_${hId}`;
    registerSheet(scene, key, 84, 84, 6, (ctx, frame, w, h) =>
      drawHeroFrame(ctx, hId, frame, w, h)
    );
    if (!scene.anims.exists(`${key}_walk`)) {
      scene.anims.create({
        key: `${key}_walk`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 5 }),
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  // 13 Regular Enemies (72x72, 6 frames)
  const regularEnemies: EnemyKind[] = [
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
  for (const kind of regularEnemies) {
    const key = `enemy_${kind}`;
    registerSheet(scene, key, 72, 72, 6, (ctx, frame, w, h) =>
      drawEnemyFrame(ctx, kind, frame, w, h)
    );
    if (!scene.anims.exists(`${key}_move`)) {
      scene.anims.create({
        key: `${key}_move`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 5 }),
        frameRate: kind === 'bat' || kind === 'mist_steed' || kind === 'magma_imp' ? 13 : 9,
        repeat: -1,
      });
    }
  }

  // 7 Stage Bosses (116x116, 6 frames)
  const bosses: EnemyKind[] = [
    'boss_fenrir',
    'boss_carmilla',
    'boss_morghul',
    'boss_ignis',
    'boss_vane',
    'boss_malakor',
    'boss_reaper',
  ];
  for (const kind of bosses) {
    const key = `enemy_${kind}`;
    registerSheet(scene, key, 116, 116, 6, (ctx, frame, w, h) =>
      drawEnemyFrame(ctx, kind, frame, w, h)
    );
    if (!scene.anims.exists(`${key}_move`)) {
      scene.anims.create({
        key: `${key}_move`,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 5 }),
        frameRate: 9,
        repeat: -1,
      });
    }
  }

  // Weapons & VFX
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

  // NEW: Phantom Silver Dagger
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

  // NEW: Sacred Fire Pool (Flask zone)
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

  // NEW: Judgment Cross & Celestial Greatsword
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
    g.addColorStop(0, 'rgba(220, 225, 245, 0.18)');
    g.addColorStop(1, 'rgba(220, 225, 245, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
