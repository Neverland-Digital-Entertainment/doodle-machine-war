import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { CONFIG } from './config.js';

// Fonts live in public/fonts/ → copied to dist/fonts/ as separate files.
// FontFace API uses relative paths; CSS font-loading is NOT blocked by file://
// CORS (unlike XHR), so this works when the HTML is opened directly from disk.
async function loadFonts() {
  const rudiment  = new FontFace('rudiment_medium', 'url(fonts/rudiment_medium.ttf)');
  const sketchBlock = new FontFace('sketch_block',  'url(fonts/sketch_block.ttf)');
  const loaded = await Promise.all([rudiment.load(), sketchBlock.load()]);
  loaded.forEach(f => document.fonts.add(f));
}

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.CANVAS_WIDTH,
  height: CONFIG.CANVAS_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MenuScene, GameScene],
};

loadFonts().then(() => {
  new Phaser.Game(gameConfig);
});
