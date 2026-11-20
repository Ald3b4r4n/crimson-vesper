import Phaser from 'phaser';
import {
  BaseWeaponId,
  DifficultyId,
  ExclusiveWeaponId,
  ForgeableWeaponId,
  HeroId,
  HeroUpgradeLevels,
  StageId,
} from './data/loreData';
import { ArenaCallbacks, ArenaScene, SavedActiveRun } from './scenes/ArenaScene';
import './styles.css';
import { UIManager } from './ui/UIManager';
import { ViewportManager } from './ui/ViewportManager';

const gameRoot = document.getElementById('game-root')!;
const phaserContainer = document.getElementById('phaser-container')!;
const uiLayer = document.getElementById('ui-layer')!;

const viewport = new ViewportManager(gameRoot);
const initialWorldSize = viewport.getWorldSize();
const arenaScene = new ArenaScene();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: phaserContainer,
  backgroundColor: '#07040a',
  scale: {
    mode: Phaser.Scale.NONE,
    width: initialWorldSize.width,
    height: initialWorldSize.height,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
    batchSize: 4096,
  },
  scene: [],
});

game.scene.add('ArenaScene', arenaScene, false);

viewport.onChange(() => {
  const sz = viewport.getWorldSize();
  game.scale.resize(sz.width, sz.height);
});

function getActiveArena(): ArenaScene | null {
  return game.scene.isActive('ArenaScene') ? arenaScene : null;
}

new UIManager(uiLayer, viewport, {
  onStartRun: (
    heroId: HeroId,
    stageId: StageId,
    difficultyId: DifficultyId,
    callbacks: ArenaCallbacks,
    metaProgression?: {
      unlockedWeapons: BaseWeaponId[];
      purchasedExclusiveWeapons?: ExclusiveWeaponId[];
      heroUpgrades?: HeroUpgradeLevels;
      weaponForge: Partial<Record<ForgeableWeaponId, number>>;
    },
    resumeCheckpoint?: SavedActiveRun
  ) => {
    const sz = viewport.getWorldSize();
    game.scale.resize(sz.width, sz.height);
    arenaScene.configureRun(
      heroId,
      stageId,
      difficultyId,
      callbacks,
      metaProgression,
      resumeCheckpoint
    );
    if (game.scene.isActive('ArenaScene') || game.scene.isPaused('ArenaScene')) {
      game.scene.stop('ArenaScene');
    }
    game.scene.start('ArenaScene');
  },
  onSetVirtualJoystick: (dx: number, dy: number) => {
    getActiveArena()?.setVirtualJoystick(dx, dy);
  },
  onTriggerDash: () => {
    return getActiveArena()?.triggerDash() ?? false;
  },
  onTogglePause: () => {
    getActiveArena()?.toggleUserPause();
  },
  onResumeFromPause: () => {
    getActiveArena()?.setUserPause(false);
  },
  onSaveActiveRun: () => {
    return getActiveArena()?.exportRunCheckpoint() ?? null;
  },
  onStopArena: () => {
    if (game.scene.isActive('ArenaScene')) {
      game.scene.stop('ArenaScene');
    }
  },
});
