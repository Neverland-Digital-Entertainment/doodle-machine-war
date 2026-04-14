import { CONFIG, PLAYERS } from '../config.js';

/**
 * Shield - A defensive unit that blocks attacks
 * Represented as a semi-circle around the player's base
 * Multiple shields create concentric rings
 */
export class Shield {
  constructor(scene, playerNum, shieldLayer = 1) {
    this.scene = scene;
    this.playerNum = playerNum;
    this.shieldLayer = shieldLayer; // 1, 2, or 3
    this.active = true;

    // Calculate center position (base center)
    if (playerNum === PLAYERS.PLAYER_1) {
      // Player 1 base is at bottom center
      this.centerX = CONFIG.CANVAS_WIDTH / 2;
      this.centerY = CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET;
      this.isTopPlayer = false;
    } else {
      // Player 2 base is at top center
      this.centerX = CONFIG.CANVAS_WIDTH / 2;
      this.centerY = CONFIG.BASE_Y_OFFSET;
      this.isTopPlayer = true;
    }

    // Calculate radius based on shield layer
    // Layer 1: 50px, Layer 2: 80px, Layer 3: 110px
    this.radius = 50 + (shieldLayer - 1) * 30;

    // Create visual representation
    this.graphics = scene.add.graphics();
    this.draw();
  }

  draw() {
    this.graphics.clear();
    if (!this.active) return;

    // Draw semi-circle shield around base
    this.graphics.fillStyle(0xffa500, 0.6);
    this.graphics.lineStyle(2, 0xff8000, 1);

    // Draw semi-circle (different direction for top/bottom)
    this.graphics.beginPath();

    if (this.isTopPlayer) {
      // Player 2 (top): semi-circle facing down
      this.graphics.arc(this.centerX, this.centerY, this.radius, 0, Math.PI, false);
    } else {
      // Player 1 (bottom): semi-circle facing up
      this.graphics.arc(this.centerX, this.centerY, this.radius, Math.PI, 2 * Math.PI, false);
    }

    this.graphics.closePath();
    this.graphics.fillPath();
    this.graphics.strokePath();
  }

  /**
   * Get bounding circle for collision detection
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

    // Point must be within radius
    if (distSq > this.radius * this.radius) {
      return false;
    }

    // Point must be on the correct side of the base
    if (this.isTopPlayer) {
      // For top player, point must be above center (y < centerY)
      return py < this.centerY;
    } else {
      // For bottom player, point must be below center (y > centerY)
      return py > this.centerY;
    }
  }

  /**
   * Destroy the shield
   */
  destroy() {
    this.active = false;
    this.graphics.clear();
    this.graphics.destroy();
  }
}
