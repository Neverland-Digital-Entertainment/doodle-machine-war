import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import { CONFIG } from './config.js';

// Import fonts as data URLs so vite-plugin-singlefile inlines them
import rudimentUrl from './fonts/rudiment_medium.ttf';
import sketchBlockUrl from './fonts/sketch_block.ttf';

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.CANVAS_WIDTH,
  height: CONFIG.CANVAS_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
};

// Load custom fonts via FontFace API before starting Phaser,
// so text objects can use them immediately in create().
async function loadFonts() {
  const rudiment = new FontFace('rudiment_medium', `url(${rudimentUrl})`);
  const sketchBlock = new FontFace('sketch_block', `url(${sketchBlockUrl})`);
  const loaded = await Promise.all([rudiment.load(), sketchBlock.load()]);
  loaded.forEach(f => document.fonts.add(f));
}

loadFonts().then(() => {
  new Phaser.Game(gameConfig);
});
