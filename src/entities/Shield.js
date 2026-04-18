import { CONFIG, PLAYERS } from '../config.js';
import shieldUrl from '../images/shield.webp';

/**
 * Shield - A defensive unit that blocks attacks
 * Displayed as shield.webp, scaled by layer (inner→outer = smaller→larger)
 * Collision uses the same semi-circle geometry as before.
 */
export class Shield {
  constructor(scene, playerNum, shieldLayer = 1) {
    this.scene = scene;
    this.playerNum = playerNum;
    this.shieldLayer = shieldLayer; // 1, 2, or 3
    this.active = true;

    // Calculate center position (base center)
    if (playerNum === PLAYERS.PLAYER_1) {
      this.centerX = CONFIG.CANVAS_WIDTH / 2;
      this.centerY = CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET;
      this.isTopPlayer = false;
    } else {
      this.centerX = CONFIG.CANVAS_WIDTH / 2;
      this.centerY = CONFIG.BASE_Y_OFFSET;
      this.isTopPlayer = true;
    }

    // Radius per layer: 50, 80, 110 — same as before for collision
    this.radius = 50 + (shieldLayer - 1) * 30;

    // Display size grows with layer: layer 1 = small, layer 3 = large
    const displaySize = 60 + (shieldLayer - 1) * 30; // 60, 90, 120

    // Y offset so the shield sits just in front of the base
    const yOffset = this.isTopPlayer ? this.radius * 0.5 : -this.radius * 0.5;

    this.sprite = scene.add.image(this.centerX, this.centerY + yOffset, 'shield');
    this.sprite.setDisplaySize(displaySize, displaySize * 0.45);
    this.sprite.setAlpha(0.9);

    // Flip vertically for Player 2 (top player)
    if (this.isTopPlayer) {
      this.sprite.setFlipY(true);
    }
  }

  /**
   * Get bounding circle for collision detection — same contract as before
   */
  getBounds() {
    return {
      centerX: this.centerX,
      centerY: this.centerY,
      radius: this.radius,
      minX: this.centerX - this.radius,
      maxX: this.centerX + this.radius,
      minY: this.centerY - this.radius,
      maxY: this.centerY + this.radius,
    };
  }

  /**
   * Check if a point is inside this semi-circular shield
   */
  contains(px, py) {
    const dx = px - this.centerX;
    const dy = py - this.centerY;
    const distSq = dx * dx + dy * dy;

    if (distSq > this.radius * this.radius) return false;

    if (this.isTopPlayer) {
      return py < this.centerY;
    } else {
      return py > this.centerY;
    }
  }

  /**
   * Destroy the shield
   */
  destroy() {
    this.active = false;
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
