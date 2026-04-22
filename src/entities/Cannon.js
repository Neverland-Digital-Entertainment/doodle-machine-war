import { PLAYERS } from '../config.js';

/**
 * Cannon - Special piercing weapon.
 * - Max 1 per player per battle.
 * - Fires a single piercing shot that ignores all shields and damages the base.
 * - After firing OR being hit, the cannon is "spent":
 *   a scribble X is drawn on top, it remains on the board as a visual obstacle,
 *   but it cannot attack again and is no longer a valid target for raycasts
 *   (so it doesn't block enemy fire either — it's just scenery).
 */
export class Cannon {
  constructor(scene, playerNum, x, y) {
    this.scene = scene;
    this.playerNum = playerNum;
    this.x = x;
    this.y = y;
    this.size = 40; // half-size for hitbox
    this.active = true;  // can attack / can be targeted
    this.spent  = false; // fired once OR was hit
    this.xOverlay = null; // graphics for scribbled-out mark

    const textureKey = playerNum === PLAYERS.PLAYER_1 ? 'cannon-player' : 'cannon-enemy';
    this.sprite = scene.add.image(x, y, textureKey);
    this.sprite.setDisplaySize(82, 96); // natural asset size
    // Depth 1 — on the ground, below shields (depth 2) and fighters (depth 3).
    // Shields and fighters render on top so cannons look "protected" by shields.
    this.sprite.setDepth(1);

    // Player 2 (top/enemy) cannon faces downward — rotate 180°
    if (playerNum === PLAYERS.PLAYER_2) {
      this.sprite.setAngle(180);
    }
  }

  getBounds() {
    return {
      minX: this.x - this.size,
      maxX: this.x + this.size,
      minY: this.y - this.size,
      maxY: this.y + this.size,
      width:  this.size * 2,
      height: this.size * 2,
    };
  }

  contains(px, py) {
    const b = this.getBounds();
    return px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY;
  }

  /**
   * Mark cannon as spent. Draws a persistent random-scribble
   * (same style as destroyed-unit effect) on top of the sprite,
   * plays the destroy sfx, but leaves the cannon sprite on the board.
   */
  /**
   * @param {boolean} silent  If true, skip sfx (caller handles audio timing).
   *                          Used when the cannon fires itself — CombatSystem
   *                          schedules the scribble sound in the stagger loop.
   *                          When hit by an enemy, silent=false so the sound
   *                          plays immediately on impact.
   */
  markSpent(silent = false) {
    if (this.spent) return;
    this.spent  = true;
    this.active = false; // no longer a valid raycast target / attacker

    // Play destroy sound via FeedbackSystem helper (respects mute)
    if (!silent && this.scene.feedbackSystem) {
      this.scene.feedbackSystem._playSound('sfx-scribble', { volume: 0.8 });
      this.scene.time.delayedCall(320, () => {
        this.scene.feedbackSystem._playSound('sfx-destroy', { volume: 0.9 });
      });
    }

    const g = this.scene.add.graphics();
    // Scribble sits just above the cannon sprite (depth 1) but still below
    // shields (2) and fighters (3), keeping the cannon visually "on the ground".
    g.setDepth(1);
    // Reuse FeedbackSystem's scribble renderer for consistency.
    if (this.scene.feedbackSystem) {
      this.scene.feedbackSystem._scribble(g, this.x, this.y, 70);
    } else {
      // Fallback simple scribble
      g.lineStyle(2, 0x222222, 0.8);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const len = 30 + Math.random() * 30;
        g.beginPath();
        g.moveTo(this.x + Math.cos(a) * -len / 2, this.y + Math.sin(a) * -len / 2);
        g.lineTo(this.x + Math.cos(a) * len / 2,  this.y + Math.sin(a) * len / 2);
        g.strokePath();
      }
    }
    this.xOverlay = g;
  }

  destroy() {
    // Cannons persist on board even when spent; only fully destroyed on reset.
    this.active = false;
    if (this.sprite)   { this.sprite.destroy();   this.sprite = null; }
    if (this.xOverlay) { this.xOverlay.destroy(); this.xOverlay = null; }
  }
}
