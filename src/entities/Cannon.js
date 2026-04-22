import { PLAYERS } from '../config.js';

/**
 * Cannon - Special piercing weapon.
 * - Max 1 per player per battle.
 * - Fires a single piercing shot that ignores all shields and damages the base.
 * - After firing OR being hit, the cannon is "spent": sprite is destroyed
 *   (via CombatSystem's showDestructionEffect), same as any other unit.
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

    const textureKey = playerNum === PLAYERS.PLAYER_1 ? 'cannon-player' : 'cannon-enemy';
    this.sprite = scene.add.image(x, y, textureKey);
    this.sprite.setDisplaySize(82, 96); // natural asset size
    // Depth 1 — on the ground, below shields (depth 2) and fighters (depth 3).
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
   * Mark cannon as spent (flags only — sprite destruction is handled by
   * CombatSystem via showDestructionEffect, same as shields and weapons).
   */
  markSpent() {
    if (this.spent) return;
    this.spent  = true;
    this.active = false;
  }

  destroy() {
    this.active = false;
    if (this.sprite) { this.sprite.destroy(); this.sprite = null; }
  }
}
