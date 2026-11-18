import Phaser from 'phaser';
import { HeroId, StageId } from './data/loreData';
import { ArenaCallbacks, ArenaScene } from './scenes/ArenaScene';
import './styles.css';
import { UIManager } from './ui/UIManager';

const phaserContainer = document.getElementById('phaser-container')!;
const uiLayer = document.getElementById('ui-layer')!;

const arenaScene = new ArenaScene();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: phaserContainer,
  backgroundColor: '#08050b',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  scene: [],
});

game.scene.add('ArenaScene', arenaScene, false);

function getActiveArena(): ArenaScene | null {
  return game.scene.isActive('ArenaScene') ? arenaScene : null;
}

new UIManager(uiLayer, {
  onStartRun: (heroId: HeroId, stageId: StageId, callbacks: ArenaCallbacks) => {
    arenaScene.configureRun(heroId, stageId, callbacks);
    if (game.scene.isActive('ArenaScene') || game.scene.isPaused('ArenaScene')) {
      game.scene.stop('ArenaScene');
    }
    game.scene.start('ArenaScene');
  },
  onSetVirtualJoystick: (dx: number, dy: number) => {
    getActiveArena()?.setVirtualJoystick(dx, dy);
  },
  onTriggerDash: () => {
    getActiveArena()?.triggerDash();
  },
  onTogglePause: () => {
    getActiveArena()?.toggleUserPause();
  },
  onResumeFromPause: () => {
    getActiveArena()?.setUserPause(false);
  },
  onStopArena: () => {
    if (game.scene.isActive('ArenaScene')) {
      game.scene.stop('ArenaScene');
    }
  },
});
