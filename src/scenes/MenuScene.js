import Phaser from 'phaser';
import { CONFIG } from '../config.js';

import startBgUrl    from '../images/start_bg.webp';
import logoUrl       from '../images/logo.webp';
import buttonStartUrl from '../images/button_start.webp';

const FONT_TITLE = 'sketch_block';
const FONT_BODY  = 'rudiment_medium';

const CW = CONFIG.CANVAS_WIDTH;
const CH = CONFIG.CANVAS_HEIGHT;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  preload() {
    this.load.image('start-bg',     startBgUrl);
    this.load.image('logo',         logoUrl);
    this.load.image('button-start', buttonStartUrl);
  }

  create() {
    // ── Background ─────────────────────────────────────────────────────────
    const bg = this.add.image(CW / 2, CH / 2, 'start-bg');
    bg.setDisplaySize(CW, CH);
    bg.setDepth(0);

    // ── Pencil popup ────────────────────────────────────────────────────────
    this._showPopup();
  }

  // ── Popup ─────────────────────────────────────────────────────────────────

  _showPopup() {
    const margin = 36;           // gap from canvas edges
    const rx = margin;
    const ry = margin;
    const rw = CW - margin * 2;
    const rh = CH - margin * 2;
    const depth = 10;

    // Pencil-style rectangle (3-pass jitter)
    const box = this.add.graphics();
    box.setDepth(depth);
    this._pencilRect(box, rx, ry, rw, rh, 0xf5f0e8, 0x2a2a2a);

    // ── Placeholder rules text ─────────────────────────────────────────────
    const textX = rx + 28;
    const textY = ry + 28;
    const textW = rw - 56;

    const title = this.add.text(rx + rw / 2, textY + 10, 'HOW TO PLAY', {
      fontFamily: FONT_TITLE,
      fontSize: '28px',
      color: '#2a2a2a',
    });
    title.setOrigin(0.5, 0);
    title.setDepth(depth + 1);

    const rules = [
      'Draw a LINE  →  place a Shield',
      'Draw a TRIANGLE  →  place a Fighter',
      '',
      'In Attack Mode, draw a line from',
      'your Fighter toward the enemy.',
      '',
      'Destroy the enemy Base to win!',
    ];

    const body = this.add.text(textX, textY + 68, rules.join('\n'), {
      fontFamily: FONT_BODY,
      fontSize: '18px',
      color: '#2a2a2a',
      lineSpacing: 8,
      wordWrap: { width: textW },
    });
    body.setDepth(depth + 1);

    // ── Close button (pencil circle with X) ───────────────────────────────
    const btnR  = 22;
    const btnX  = rx + rw - 2;   // sits on the corner of the popup
    const btnY  = ry + 2;

    const closeBtn = this.add.graphics();
    closeBtn.setDepth(depth + 2);
    this._pencilCircle(closeBtn, btnX, btnY, btnR, 0xf5f0e8, 0x2a2a2a);
    this._pencilX(closeBtn, btnX, btnY, btnR * 0.52, 0x2a2a2a);

    // Invisible hit area
    const hitZone = this.add.circle(btnX, btnY, btnR + 6);
    hitZone.setDepth(depth + 3);
    hitZone.setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      closeBtn.clear();
      this._pencilCircle(closeBtn, btnX, btnY, btnR, 0xe8e0d0, 0x2a2a2a);
      this._pencilX(closeBtn, btnX, btnY, btnR * 0.52, 0xaa1111);
    });
    hitZone.on('pointerout', () => {
      closeBtn.clear();
      this._pencilCircle(closeBtn, btnX, btnY, btnR, 0xf5f0e8, 0x2a2a2a);
      this._pencilX(closeBtn, btnX, btnY, btnR * 0.52, 0x2a2a2a);
    });
    hitZone.on('pointerdown', () => {
      // Destroy all popup objects
      [box, title, body, closeBtn, hitZone].forEach(o => o.destroy());
      this._showStartScreen();
    });

    this._popupObjects = [box, title, body, closeBtn, hitZone];
  }

  // ── Start screen (logo + start button) ────────────────────────────────────

  _showStartScreen() {
    // Logo — top quarter of screen, natural size
    const logo = this.add.image(CW / 2, CH / 4, 'logo');
    logo.setDepth(5);
    logo.setAlpha(0);
    this.tweens.add({ targets: logo, alpha: 1, duration: 400, ease: 'Quad.easeOut' });

    // Start button — bottom third of screen, natural size
    const startBtn = this.add.image(CW / 2, (CH / 3) * 2, 'button-start');
    startBtn.setDepth(5);
    startBtn.setAlpha(0);
    this.tweens.add({ targets: startBtn, alpha: 1, duration: 400, delay: 120, ease: 'Quad.easeOut' });

    startBtn.setInteractive({ useHandCursor: true });
    startBtn.on('pointerover', () => startBtn.setAlpha(0.8));
    startBtn.on('pointerout',  () => startBtn.setAlpha(1));
    startBtn.on('pointerdown', () => {
      this.cameras.main.fade(300, 0, 0, 0, false, (_cam, progress) => {
        if (progress === 1) this.scene.start('GameScene');
      });
    });
  }

  // ── Pencil drawing helpers ─────────────────────────────────────────────────

  _pencilRect(g, x, y, w, h, fillColor, strokeColor) {
    // Fill
    g.fillStyle(fillColor, 0.97);
    g.fillRect(x, y, w, h);

    // 3-pass jittered outline
    for (let pass = 0; pass < 3; pass++) {
      const lw = pass === 0 ? 3.5 : pass === 1 ? 2.2 : 1.2;
      const a  = pass === 0 ? 0.30 : pass === 1 ? 0.65 : 0.90;
      const j  = () => (Math.random() - 0.5) * (pass === 0 ? 3 : pass === 1 ? 1.5 : 0.8);

      g.lineStyle(lw, strokeColor, a);
      g.beginPath();
      g.moveTo(x + j(),     y + j());
      g.lineTo(x + w + j(), y + j());
      g.lineTo(x + w + j(), y + h + j());
      g.lineTo(x + j(),     y + h + j());
      g.closePath();
      g.strokePath();
    }
  }

  _pencilCircle(g, cx, cy, r, fillColor, strokeColor) {
    g.fillStyle(fillColor, 0.97);
    g.fillCircle(cx, cy, r);

    for (let pass = 0; pass < 3; pass++) {
      const lw = pass === 0 ? 3 : pass === 1 ? 2 : 1.2;
      const a  = pass === 0 ? 0.28 : pass === 1 ? 0.62 : 0.88;
      const jx = (Math.random() - 0.5) * 1.5;
      const jy = (Math.random() - 0.5) * 1.5;
      g.lineStyle(lw, strokeColor, a);
      g.strokeCircle(cx + jx, cy + jy, r);
    }
  }

  _pencilX(g, cx, cy, half, color) {
    for (let pass = 0; pass < 3; pass++) {
      const lw = pass === 0 ? 3.5 : pass === 1 ? 2.2 : 1.4;
      const a  = pass === 0 ? 0.28 : pass === 1 ? 0.65 : 0.92;
      const j  = () => (Math.random() - 0.5) * 1.5;
      g.lineStyle(lw, color, a);
      g.beginPath();
      g.moveTo(cx - half + j(), cy - half + j());
      g.lineTo(cx + half + j(), cy + half + j());
      g.strokePath();
      g.beginPath();
      g.moveTo(cx + half + j(), cy - half + j());
      g.lineTo(cx - half + j(), cy + half + j());
      g.strokePath();
    }
  }
}
