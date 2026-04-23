import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { CONFIG } from './config.js';

// Import fonts as assets so vite inlines them as base64 data URIs
import brownBigLunchUrl from './assets/fonts/brown_big_lunch.ttf';
import sketchBlockUrl from './assets/fonts/sketch_block.ttf';

async function loadFonts() {
  try {
    const body        = new FontFace('brown_big_lunch', `url(${brownBigLunchUrl})`);
    const sketchBlock = new FontFace('sketch_block',    `url(${sketchBlockUrl})`);
    const loaded = await Promise.all([body.load(), sketchBlock.load()]);
    loaded.forEach(f => document.fonts.add(f));
  } catch (e) {
    console.warn('Font loading failed, starting game anyway:', e);
  }
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
