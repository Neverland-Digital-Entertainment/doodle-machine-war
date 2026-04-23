import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { CONFIG } from './config.js';

// Fonts live in public/fonts/ → copied to dist/fonts/ as separate files.
// FontFace API uses relative paths; CSS font-loading is NOT blocked by file://
// CORS (unlike XHR), so this works when the HTML is opened directly from disk.
async function loadFonts() {
  const body        = new FontFace('brown_big_lunch', 'url(fonts/brown_big_lunch.ttf)');
  const sketchBlock = new FontFace('sketch_block',    'url(fonts/sketch_block.ttf)');
  const loaded = await Promise.all([body.load(), sketchBlock.load()]);
  loaded.forEach(f => document.fonts.add(f));
}

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.CANVAS_WIDTH,
  height: CONFIG.CANVAS_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  scene: [MenuScene, GameScene],
};

loadFonts().then(async () => {
  new Phaser.Game(gameConfig);

  // Notify Wavedash that the game has loaded (dismisses the loading screen).
  // window.Wavedash is undefined when running outside Wavedash — safe to skip.
  try {
    if (window.Wavedash) {
      const Wavedash = await window.Wavedash;
      Wavedash.updateLoadProgressZeroToOne(1);
      Wavedash.init({});
    }
  } catch (e) {
    console.warn('Wavedash SDK init skipped:', e);
  }
});
