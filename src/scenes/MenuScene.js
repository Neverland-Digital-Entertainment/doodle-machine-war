import Phaser from 'phaser';
import { CONFIG } from '../config.js';

import startBgUrl     from '../images/start_bg.webp';
import logoUrl        from '../images/logo.webp';
import buttonStartUrl from '../images/button_start.webp';

const FONT_TITLE = 'sketch_block';
const FONT_BODY  = 'rudiment_medium';

const CW = CONFIG.CANVAS_WIDTH;
const CH = CONFIG.CANVAS_HEIGHT;

// Popup geometry
const MARGIN  = 32;           // gap from canvas edges
const PAD     = 22;           // inner padding
const PX      = MARGIN;       // popup left
const PY      = MARGIN;       // popup top
const PW      = CW - MARGIN * 2;  // 448
const PH      = CH - MARGIN * 2;  // 832
const DEPTH   = 10;

// Drawing column (left side of each row)
const DRAW_X  = PX + PAD + 44;    // centre of drawing area
const DRAW_W  = 96;                // width reserved for sketch
// Text column starts after the drawing area
const TEXT_X  = PX + PAD + DRAW_W + 16;
const TEXT_W  = PW - PAD * 2 - DRAW_W - 16;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this._popupGroup = [];
  }

  preload() {
    this.load.image('start-bg',     startBgUrl);
    this.load.image('logo',         logoUrl);
    this.load.image('button-start', buttonStartUrl);
  }

  create() {
    // Background
    const bg = this.add.image(CW / 2, CH / 2, 'start-bg');
    bg.setDisplaySize(CW, CH);
    bg.setDepth(0);

    this._showPopup();
  }

  // ── Popup ──────────────────────────────────────────────────────────────────

  _showPopup() {
    const objs = this._popupGroup;
    const d = DEPTH;

    // Box fill + border
    const box = this.add.graphics();
    box.setDepth(d);
    this._pencilRect(box, PX, PY, PW, PH, 0xf5f0e8, 0x2a2a2a);
    objs.push(box);

    let cy = PY + PAD; // running cursor Y

    // ── Title ────────────────────────────────────────────────────────────────
    const title = this._txt(PX + PW / 2, cy + 2, 'HOW TO PLAY', FONT_TITLE, 28, '#2a2a2a', d + 1);
    title.setOrigin(0.5, 0);
    objs.push(title);
    cy += 40;

    cy = this._divider(cy, objs, d + 1);

    // ── GOAL ─────────────────────────────────────────────────────────────────
    cy += 6;
    const goalHdr = this._txt(PX + PAD, cy, 'GOAL', FONT_TITLE, 21, '#2a2a2a', d + 1);
    objs.push(goalHdr);
    cy += 30;

    const goalBody = this._txt(PX + PAD, cy,
      'Erase all 4 letters of the enemy\'s BASE.\nDestroy theirs before they destroy yours!',
      FONT_BODY, 18, '#2a2a2a', d + 1, PW - PAD * 2);
    objs.push(goalBody);
    cy += goalBody.height + 14;

    cy = this._divider(cy, objs, d + 1);

    // ── DRAW TO BUILD ─────────────────────────────────────────────────────────
    cy += 6;
    const buildHdr = this._txt(PX + PAD, cy, 'DRAW TO BUILD', FONT_TITLE, 21, '#2a2a2a', d + 1);
    objs.push(buildHdr);
    cy += 32;

    const rows = [
      {
        draw: (g, cx, rcY) => this._sketchLine(g, cx, rcY),
        name: 'SHIELD',
        nameColor: '#1a5fa8',
        desc: 'Draw a HORIZONTAL LINE to place a Shield. Shields block incoming attacks from the enemy.',
      },
      {
        draw: (g, cx, rcY) => this._sketchTriangle(g, cx, rcY),
        name: 'FIGHTER',
        nameColor: '#2a7a2a',
        desc: 'Draw a TRIANGLE to deploy a Fighter. Use it to launch attacks toward enemy targets.',
      },
      {
        draw: (g, cx, rcY) => this._sketchCircle2(g, cx, rcY),
        name: 'CANNON',
        nameColor: '#888888',
        desc: 'Draw a CIRCLE to build a Cannon.\n(Coming soon!)',
        dim: true,
      },
    ];

    for (const row of rows) {
      const rowH = 108;
      const rcY  = cy + rowH / 2;   // vertical centre of row

      // Pencil sketch illustration
      const g = this.add.graphics();
      g.setDepth(d + 1);
      row.draw(g, DRAW_X, rcY);
      objs.push(g);

      // Item name
      const nameColor = row.dim ? '#aaaaaa' : row.nameColor;
      const bodyColor = row.dim ? '#aaaaaa' : '#2a2a2a';
      const nm = this._txt(TEXT_X, cy + 6, row.name, FONT_TITLE, 20, nameColor, d + 1);
      objs.push(nm);

      const desc = this._txt(TEXT_X, cy + 32, row.desc, FONT_BODY, 16, bodyColor, d + 1, TEXT_W);
      objs.push(desc);

      // Thin row separator (except after last row)
      if (row !== rows[rows.length - 1]) {
        const sep = this.add.graphics();
        sep.setDepth(d + 1);
        sep.lineStyle(1, 0x2a2a2a, 0.18);
        sep.beginPath();
        sep.moveTo(PX + PAD, cy + rowH - 2);
        sep.lineTo(PX + PW - PAD, cy + rowH - 2);
        sep.strokePath();
        objs.push(sep);
      }

      cy += rowH;
    }

    cy = this._divider(cy, objs, d + 1);

    // ── LINE TO ATTACK ────────────────────────────────────────────────────────
    cy += 6;
    const atkHdr = this._txt(PX + PAD, cy, 'LINE TO ATTACK', FONT_TITLE, 21, '#2a2a2a', d + 1);
    objs.push(atkHdr);
    cy += 32;

    // Attack illustration: fighter → arrow → shield/base
    const ag = this.add.graphics();
    ag.setDepth(d + 1);
    this._sketchAttackArrow(ag, PX + PAD + 10, cy + 28);
    objs.push(ag);

    const atkDesc = this._txt(PX + PAD, cy + 62,
      'Switch to Attack Mode, then draw a line FROM your Fighter TOWARD the enemy target.',
      FONT_BODY, 17, '#2a2a2a', d + 1, PW - PAD * 2);
    objs.push(atkDesc);

    // ── Close (X) button ─────────────────────────────────────────────────────
    const btnR = 22;
    const btnX = PX + PW - 4;
    const btnY = PY + 4;

    const closeG = this.add.graphics();
    closeG.setDepth(d + 2);
    this._pencilCircle(closeG, btnX, btnY, btnR, 0xf5f0e8, 0x2a2a2a);
    this._pencilX(closeG, btnX, btnY, btnR * 0.5, 0x2a2a2a);
    objs.push(closeG);

    const hit = this.add.circle(btnX, btnY, btnR + 8).setDepth(d + 3).setInteractive({ useHandCursor: true });
    objs.push(hit);

    hit.on('pointerover', () => {
      closeG.clear();
      this._pencilCircle(closeG, btnX, btnY, btnR, 0xe8e0d0, 0x2a2a2a);
      this._pencilX(closeG, btnX, btnY, btnR * 0.5, 0xaa1111);
    });
    hit.on('pointerout', () => {
      closeG.clear();
      this._pencilCircle(closeG, btnX, btnY, btnR, 0xf5f0e8, 0x2a2a2a);
      this._pencilX(closeG, btnX, btnY, btnR * 0.5, 0x2a2a2a);
    });
    hit.on('pointerdown', () => {
      objs.forEach(o => o.destroy());
      objs.length = 0;
      this._showStartScreen();
    });
  }

  // ── Start screen ──────────────────────────────────────────────────────────

  _showStartScreen() {
    const logo = this.add.image(CW / 2, CH / 4, 'logo');
    logo.setScale(0.75);
    logo.setDepth(5);
    logo.setAlpha(0);
    this.tweens.add({ targets: logo, alpha: 1, duration: 400, ease: 'Quad.easeOut' });

    const startBtn = this.add.image(CW / 2, (CH / 4) * 3, 'button-start');
    startBtn.setScale(0.75);
    startBtn.setDepth(5);
    startBtn.setAlpha(0);
    this.tweens.add({ targets: startBtn, alpha: 1, duration: 400, delay: 120, ease: 'Quad.easeOut' });

    startBtn.setInteractive({ useHandCursor: true });
    startBtn.on('pointerover', () => startBtn.setTint(0xcccccc));
    startBtn.on('pointerout',  () => startBtn.clearTint());
    startBtn.on('pointerdown', () => {
      this.cameras.main.fade(300, 0, 0, 0, false, (_cam, progress) => {
        if (progress === 1) this.scene.start('GameScene');
      });
    });
  }

  // ── Shape sketch helpers ──────────────────────────────────────────────────

  /** Horizontal pencil line — represents "draw a line → Shield" */
  _sketchLine(g, cx, cy) {
    const hw = 34;
    for (let p = 0; p < 3; p++) {
      const lw = p === 0 ? 3.5 : p === 1 ? 2.2 : 1.2;
      const a  = p === 0 ? 0.25 : p === 1 ? 0.6 : 0.88;
      const jy = (Math.random() - 0.5) * (p === 0 ? 2.5 : 1);
      g.lineStyle(lw, 0x1a5fa8, a);
      g.beginPath();
      g.moveTo(cx - hw, cy + jy);
      g.lineTo(cx + hw, cy + jy);
      g.strokePath();
    }
    // Arrow tips at both ends
    g.lineStyle(1.8, 0x1a5fa8, 0.7);
    g.beginPath(); g.moveTo(cx - hw + 8, cy - 6); g.lineTo(cx - hw, cy); g.lineTo(cx - hw + 8, cy + 6); g.strokePath();
    g.beginPath(); g.moveTo(cx + hw - 8, cy - 6); g.lineTo(cx + hw, cy); g.lineTo(cx + hw - 8, cy + 6); g.strokePath();
    // Label under
    this._sketchLabel(g, cx, cy + 16, '← line →', 0x1a5fa8);
  }

  /** Triangle — represents "draw a triangle → Fighter" */
  _sketchTriangle(g, cx, cy) {
    const s = 30;
    const pts = [
      { x: cx,     y: cy - s },
      { x: cx + s, y: cy + s * 0.8 },
      { x: cx - s, y: cy + s * 0.8 },
    ];
    for (let p = 0; p < 3; p++) {
      const lw = p === 0 ? 3.5 : p === 1 ? 2.2 : 1.2;
      const a  = p === 0 ? 0.25 : p === 1 ? 0.6 : 0.88;
      const j  = () => (Math.random() - 0.5) * (p === 0 ? 2 : 0.8);
      g.lineStyle(lw, 0x2a7a2a, a);
      g.beginPath();
      g.moveTo(pts[0].x + j(), pts[0].y + j());
      g.lineTo(pts[1].x + j(), pts[1].y + j());
      g.lineTo(pts[2].x + j(), pts[2].y + j());
      g.closePath();
      g.strokePath();
    }
    this._sketchLabel(g, cx, cy + s * 0.8 + 14, 'triangle', 0x2a7a2a);
  }

  /** Circle — represents "draw a circle → Cannon" */
  _sketchCircle2(g, cx, cy) {
    const r = 26;
    for (let p = 0; p < 3; p++) {
      const lw = p === 0 ? 3 : p === 1 ? 2 : 1.2;
      const a  = p === 0 ? 0.18 : p === 1 ? 0.40 : 0.60;
      const jx = (Math.random() - 0.5) * 1.5;
      const jy = (Math.random() - 0.5) * 1.5;
      g.lineStyle(lw, 0x888888, a);
      g.strokeCircle(cx + jx, cy + jy, r);
    }
    // Centre dot
    g.fillStyle(0x888888, 0.45);
    g.fillCircle(cx, cy, 5);
    this._sketchLabel(g, cx, cy + r + 14, 'circle', 0x888888);
  }

  /** Attack arrow: fighter icon → arrow → target icon */
  _sketchAttackArrow(g, x, cy) {
    const totalW = PW - PAD * 2 - 20;
    const ex = x + totalW;
    const mx = (x + ex) / 2;

    // Fighter triangle (left)
    const ts = 18;
    g.lineStyle(2, 0x2a7a2a, 0.85);
    g.beginPath();
    g.moveTo(x + ts, cy); g.lineTo(x, cy + ts); g.lineTo(x, cy - ts); g.closePath(); g.strokePath();

    // Pencil attack line
    for (let p = 0; p < 3; p++) {
      const lw = p === 0 ? 3 : p === 1 ? 2 : 1.2;
      const a  = p === 0 ? 0.22 : p === 1 ? 0.55 : 0.85;
      const jy = (Math.random() - 0.5) * (p === 0 ? 2 : 0.8);
      g.lineStyle(lw, 0x228822, a);
      g.beginPath();
      g.moveTo(x + ts + 4, cy + jy);
      g.lineTo(ex - ts - 4, cy + jy);
      g.strokePath();
    }
    // Arrow head pointing right
    g.lineStyle(2, 0x228822, 0.85);
    g.beginPath(); g.moveTo(ex - ts - 4, cy - 7); g.lineTo(ex - ts + 6, cy); g.lineTo(ex - ts - 4, cy + 7); g.strokePath();

    // Target (shield arc on right)
    g.lineStyle(2, 0x1a5fa8, 0.85);
    g.beginPath();
    g.arc(ex, cy, ts, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(160), false);
    g.strokePath();
    g.lineStyle(1.5, 0x1a5fa8, 0.5);
    g.beginPath();
    g.moveTo(ex - ts, cy); g.lineTo(ex + ts, cy); g.strokePath();
  }

  /** Tiny text label under a sketch shape */
  _sketchLabel(g, cx, cy, text, color) {
    // We can't put text in graphics — caller must use _txt separately.
    // This is a no-op placeholder; labels are handled in the row loop via _txt.
  }

  // ── Layout helpers ────────────────────────────────────────────────────────

  _divider(cy, objs, depth) {
    const g = this.add.graphics();
    g.setDepth(depth);
    for (let p = 0; p < 2; p++) {
      g.lineStyle(p === 0 ? 2 : 1, 0x2a2a2a, p === 0 ? 0.22 : 0.55);
      g.beginPath();
      g.moveTo(PX + PAD,        cy + p * 1.5 + 5);
      g.lineTo(PX + PW - PAD,  cy + p * 1.5 + 5);
      g.strokePath();
    }
    objs.push(g);
    return cy + 14;
  }

  _txt(x, y, str, font, size, color, depth, wrapWidth = 0) {
    const style = { fontFamily: font, fontSize: `${size}px`, color };
    if (wrapWidth) style.wordWrap = { width: wrapWidth };
    const t = this.add.text(x, y, str, style);
    t.setDepth(depth);
    return t;
  }

  // ── Pencil primitives ─────────────────────────────────────────────────────

  _pencilRect(g, x, y, w, h, fillColor, strokeColor) {
    g.fillStyle(fillColor, 0.97);
    g.fillRect(x, y, w, h);
    for (let p = 0; p < 3; p++) {
      const lw = p === 0 ? 3.5 : p === 1 ? 2.2 : 1.2;
      const a  = p === 0 ? 0.28 : p === 1 ? 0.65 : 0.90;
      const j  = () => (Math.random() - 0.5) * (p === 0 ? 3 : p === 1 ? 1.5 : 0.8);
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
    for (let p = 0; p < 3; p++) {
      const lw = p === 0 ? 3 : p === 1 ? 2 : 1.2;
      const a  = p === 0 ? 0.28 : p === 1 ? 0.62 : 0.88;
      const jx = (Math.random() - 0.5) * 1.5;
      const jy = (Math.random() - 0.5) * 1.5;
      g.lineStyle(lw, strokeColor, a);
      g.strokeCircle(cx + jx, cy + jy, r);
    }
  }

  _pencilX(g, cx, cy, half, color) {
    for (let p = 0; p < 3; p++) {
      const lw = p === 0 ? 3.5 : p === 1 ? 2.2 : 1.4;
      const a  = p === 0 ? 0.28 : p === 1 ? 0.65 : 0.92;
      const j  = () => (Math.random() - 0.5) * 1.5;
      g.lineStyle(lw, color, a);
      g.beginPath(); g.moveTo(cx - half + j(), cy - half + j()); g.lineTo(cx + half + j(), cy + half + j()); g.strokePath();
      g.beginPath(); g.moveTo(cx + half + j(), cy - half + j()); g.lineTo(cx - half + j(), cy + half + j()); g.strokePath();
    }
  }
}
