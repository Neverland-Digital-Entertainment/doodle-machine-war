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
    this.sprite.setDisplaySize(110, 110);
    this.sprite.setDepth(3);
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
   * Mark cannon as spent and draw a scribble-X on top of it.
   * Called after it fires, or after it's hit.
   */
  markSpent() {
    if (this.spent) return;
    this.spent  = true;
    this.active = false; // no longer a valid raycast target / attacker

    const g = this.scene.add.graphics();
    g.setDepth(4);
    const cx = this.x, cy = this.y;
    const half = 36;
    // Pencil-style scribbled X (3 jittered passes)
    for (let p = 0; p < 3; p++) {
      const lw = p === 0 ? 4.5 : p === 1 ? 3 : 1.6;
      const a  = p === 0 ? 0.30 : p === 1 ? 0.65 : 0.92;
      const j = () => (Math.random() - 0.5) * (p === 0 ? 3 : 1.4);
      g.lineStyle(lw, 0x222222, a);
      g.beginPath();
      g.moveTo(cx - half + j(), cy - half + j());
      g.lineTo(cx + half + j(), cy + half + j());
      g.strokePath();
      g.beginPath();
      g.moveTo(cx + half + j(), cy - half + j());
      g.lineTo(cx - half + j(), cy + half + j());
      g.strokePath();
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
