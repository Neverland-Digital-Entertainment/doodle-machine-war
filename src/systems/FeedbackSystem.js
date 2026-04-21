import { CONFIG } from '../config.js';

/**
 * FeedbackSystem - Pencil-style visual effects
 *
 * showSpawnEffect(sprite, type)            — sketch outline → sprite fades in
 * showDestructionEffect(sprite, cx, cy)   — scribble + fade out 0.5 s
 * animateAttackLine(sx,sy,ex,ey,color,cb) — progressive pencil line, cb fires on done
 * animateHPStrike(cx, cy, cellW, cellH)  — animated red X, returns Graphics obj
 */
export class FeedbackSystem {
  constructor(scene) {
    this.scene = scene;
  }

  // ── Spawn ────────────────────────────────────────────────────────────────

  _playSound(key, config = {}) {
    try { this.scene.sound.play(key, config); } catch (_) {}
  }

  showSpawnEffect(sprite, type) {
    if (!sprite) return;

    // Shield spawn → shield.ogg; weapon/other → pencil-scribble.ogg
    if (type === 'shield') {
      this._playSound('sfx-shield', { volume: 0.8 });
    } else {
      this._playSound('sfx-scribble', { volume: 0.7 });
    }

    // Capture the correct target scales (set by setDisplaySize before this call)
    const targetScaleX = sprite.scaleX;
    const targetScaleY = sprite.scaleY;

    sprite.setAlpha(0);
    sprite.setScale(targetScaleX * 0.55, targetScaleY * 0.55);

    // Brief pencil-outline flash at the position
    const g = this.scene.add.graphics();
    g.setDepth((sprite.depth || 0) + 5);

    if (type === 'shield') {
      // Outline proportional to the sprite's display size
      const r = (sprite.displayWidth || 100) * 0.4;
      this._sketchCircle(g, sprite.x, sprite.y, r, 0x2a2a2a);
    } else {
      this._sketchRect(g, sprite.x - 48, sprite.y - 48, 96, 96, 0x2a2a2a);
    }

    // Sketch fades out while sprite scales in
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 350,
      onComplete: () => g.destroy(),
    });

    this.scene.tweens.add({
      targets: sprite,
      alpha: 1,
      scaleX: targetScaleX,
      scaleY: targetScaleY,
      duration: 380,
      ease: 'Back.easeOut',
    });
  }

  // ── Destruction ──────────────────────────────────────────────────────────

  /**
   * Draw a procedural scribble over the unit then fade everything to 0 in 0.5 s.
   * sprite may be null (e.g. base hit — we only show scribble at position).
   */
  showDestructionEffect(sprite, cx, cy, size = 60) {
    // Pencil scribble sound immediately, then destroy sound after scribble settles
    this._playSound('sfx-scribble', { volume: 0.8 });
    this.scene.time.delayedCall(320, () => this._playSound('sfx-destroy', { volume: 0.9 }));

    const g = this.scene.add.graphics();
    g.setDepth(50);
    this._scribble(g, cx, cy, size);

    // Sprite fades out quickly
    if (sprite) {
      this.scene.tweens.add({
        targets: sprite,
        alpha: 0,
        duration: 180,
        ease: 'Quad.easeIn',
        onComplete: () => sprite.destroy(),
      });
    }

    // Scribble lingers then fades fast
    this.scene.time.delayedCall(500, () => {
      this.scene.tweens.add({
        targets: g,
        alpha: 0,
        duration: 150,
        onComplete: () => g.destroy(),
      });
    });
  }

  // ── Attack line ──────────────────────────────────────────────────────────

  /**
   * Progressively draws a pencil line from (sx,sy) → (ex,ey).
   * onComplete fires after the line is fully drawn and held briefly.
   */
  animateAttackLine(sx, sy, ex, ey, color, onComplete, sfxKey = 'sfx-attack') {
    if (sfxKey) this._playSound(sfxKey, { volume: 0.85 });

    const g = this.scene.add.graphics();
    g.setDepth(30);

    const dist = Math.hypot(ex - sx, ey - sy);
    const drawDuration = Math.max(150, Math.min(380, dist * 0.75));

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: drawDuration,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => {
        const t = tween.getValue();
        const cx = sx + (ex - sx) * t;
        const cy = sy + (ey - sy) * t;
        g.clear();
        // Origin dot
        g.fillStyle(color, 0.9);
        g.fillCircle(sx, sy, 4);
        // Pencil line to current tip
        this._pencilLine(g, [{ x: sx, y: sy }, { x: cx, y: cy }], color, 2);
      },
      onComplete: () => {
        // Hold, then fade
        this.scene.time.delayedCall(320, () => {
          this.scene.tweens.add({
            targets: g,
            alpha: 0,
            duration: 220,
            onComplete: () => {
              g.destroy();
              if (onComplete) onComplete();
            },
          });
        });
      },
    });
  }

  // ── HP strike ────────────────────────────────────────────────────────────

  /**
   * Animated red pencil X drawn progressively over the cell.
   * Returns the Graphics object so the caller can push it to cellList for cleanup.
   */
  animateHPStrike(cx, cy, cellW, cellH) {
    const g = this.scene.add.graphics();
    g.setDepth(12);

    const x1 = cx - cellW / 2 + 8;
    const y1 = cy - cellH / 2 + 8;
    const x2 = cx + cellW / 2 - 8;
    const y2 = cy + cellH / 2 - 8;

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 280,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => {
        const t = tween.getValue();
        g.clear();
        for (let pass = 0; pass < 3; pass++) {
          const jx = (Math.random() - 0.5) * 1.8;
          const jy = (Math.random() - 0.5) * 1.8;
          const a  = pass === 0 ? 0.25 : pass === 1 ? 0.6 : 0.9;
          const w  = pass === 0 ? 3    : pass === 1 ? 2   : 1.5;
          g.lineStyle(w, 0xaa1111, a);
          g.beginPath();
          g.moveTo(x1 + jx, y1 + jy);
          g.lineTo(x1 + (x2 - x1) * t + jx, y1 + (y2 - y1) * t + jy);
          g.strokePath();
        }
      },
    });

    return g;
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  _sketchCircle(g, cx, cy, r, color) {
    for (let p = 0; p < 3; p++) {
      const jx = (Math.random() - 0.5) * 2;
      const jy = (Math.random() - 0.5) * 2;
      g.lineStyle(p === 0 ? 2.5 : p === 1 ? 1.8 : 1.2, color,
                  p === 0 ? 0.28 : p === 1 ? 0.6 : 0.85);
      g.strokeCircle(cx + jx, cy + jy, r);
    }
  }

  _sketchRect(g, x, y, w, h, color) {
    for (let p = 0; p < 3; p++) {
      const jx = (Math.random() - 0.5) * 2;
      const jy = (Math.random() - 0.5) * 2;
      g.lineStyle(p === 0 ? 2.5 : p === 1 ? 1.8 : 1.2, color,
                  p === 0 ? 0.28 : p === 1 ? 0.6 : 0.85);
      g.strokeRect(x + jx, y + jy, w, h);
    }
  }

  _scribble(g, cx, cy, size) {
    const strokes = 12 + Math.floor(Math.random() * 6);
    for (let i = 0; i < strokes; i++) {
      const angle = Math.random() * Math.PI * 2;
      const len   = size * (0.45 + Math.random() * 0.85);
      const ox    = (Math.random() - 0.5) * size * 0.55;
      const oy    = (Math.random() - 0.5) * size * 0.55;
      const sx    = cx + ox + Math.cos(angle) * len * 0.5;
      const sy    = cy + oy + Math.sin(angle) * len * 0.5;
      const ex    = cx + ox - Math.cos(angle) * len * 0.5;
      const ey    = cy + oy - Math.sin(angle) * len * 0.5;
      const mx    = (sx + ex) / 2 + (Math.random() - 0.5) * 14;
      const my    = (sy + ey) / 2 + (Math.random() - 0.5) * 14;

      g.lineStyle(1 + Math.random() * 2, 0x1a1a1a, 0.5 + Math.random() * 0.5);
      g.beginPath();
      g.moveTo(sx + (Math.random() - 0.5) * 4, sy + (Math.random() - 0.5) * 4);
      g.lineTo(mx, my);
      g.lineTo(ex + (Math.random() - 0.5) * 4, ey + (Math.random() - 0.5) * 4);
      g.strokePath();
    }
  }

  _pencilLine(g, pts, color, baseW) {
    this._jitteredPath(g, pts, color, baseW + 1, 0.6, 0.12);
    this._jitteredPath(g, pts, color, baseW,     0.8, 0.55);
    this._jitteredPath(g, pts, color, Math.max(1, baseW - 1), 0.3, 0.85);
  }

  _jitteredPath(g, pts, color, width, jitter, alpha) {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(pts[0].x + (Math.random() - 0.5) * jitter,
             pts[0].y + (Math.random() - 0.5) * jitter);
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i].x + (Math.random() - 0.5) * jitter,
               pts[i].y + (Math.random() - 0.5) * jitter);
    }
    g.strokePath();
  }

  // ── Placement error ──────────────────────────────────────────────────────

  /**
   * Show a brief pencil-style "blocked" indicator at (x, y).
   * Draws a quick X + optional label, then fades out.
   */
  showPlacementError(x, y, reason) {
    const g = this.scene.add.graphics();
    g.setDepth(60);
    const r = 22;
    const jitter = () => (Math.random() - 0.5) * 2;

    // Sketchy X in red
    for (let pass = 0; pass < 3; pass++) {
      const a = pass === 0 ? 0.3 : pass === 1 ? 0.65 : 0.9;
      const w = pass === 0 ? 7 : pass === 1 ? 5 : 3;
      g.lineStyle(w, 0xcc2222, a);
      g.beginPath();
      g.moveTo(x - r + jitter(), y - r + jitter());
      g.lineTo(x + r + jitter(), y + r + jitter());
      g.strokePath();
      g.beginPath();
      g.moveTo(x + r + jitter(), y - r + jitter());
      g.lineTo(x - r + jitter(), y + r + jitter());
      g.strokePath();
    }

    // Label
    const label = reason === 'overlap'      ? 'NO SPACE'
                : reason === 'limit'        ? 'SHIELD FULL'
                : reason === 'cannon-used'  ? 'CANNON USED'
                :                              'OUT OF ZONE';
    const txt = this.scene.add.text(x, y - r - 14, label, {
      fontFamily: 'sketch_block',
      fontSize: '16px',
      color: '#cc2222',
    });
    txt.setOrigin(0.5, 1);
    txt.setDepth(61);

    // Fade out both after short hold
    this.scene.time.delayedCall(600, () => {
      this.scene.tweens.add({
        targets: [g, txt],
        alpha: 0,
        duration: 250,
        onComplete: () => { g.destroy(); txt.destroy(); },
      });
    });
  }

  clear() {}
}
