import { CONFIG, PLAYERS } from '../config.js';
import shieldUrl from '../images/shield.webp';

/**
 * Shield - A defensive unit that blocks attacks
 * Displayed as shield.webp at 1:1 (square) aspect ratio, scaled by layer.
 * Positioned to cover the base sprite (256×256).
 * Collision uses a circle centered at the base.
 */
export class Shield {
  constructor(scene, playerNum, shieldLayer = 1) {
    this.scene = scene;
    this.playerNum = playerNum;
    this.shieldLayer = shieldLayer; // 1, 2, or 3
    this.active = true;

    // Base center — must match GameScene base sprite positions
    if (playerNum === PLAYERS.PLAYER_1) {
      this.centerX = CONFIG.CANVAS_WIDTH / 2;
      this.centerY = CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET;
      this.isTopPlayer = false;
    } else {
      this.centerX = CONFIG.CANVAS_WIDTH / 2;
      this.centerY = CONFIG.BASE_Y_OFFSET;
      this.isTopPlayer = true;
    }

    // Collision radius covers the 128px base, grows per layer
    // Layer 1: 75, Layer 2: 100, Layer 3: 130
    this.radius = 75 + (shieldLayer - 1) * 27;

    // Display size: 1:1 square ratio, matches collision diameter
    // Layer 1: 150, Layer 2: 200, Layer 3: 260
    const displaySize = 150 + (shieldLayer - 1) * 55;

    // Position the shield centred on the base — it overlaps the base sprite
    // (same placement logic as before: no extra Y offset needed since the
    //  collision circle is already centred at the base and the image covers it)
    this.sprite = scene.add.image(this.centerX, this.centerY, 'shield');
    this.sprite.setDisplaySize(displaySize, displaySize); // keep 1:1 ratio
    this.sprite.setAlpha(0.85);

    // Player 2 (top) shield opens downward — flip vertically
    if (this.isTopPlayer) {
      this.sprite.setFlipY(true);
    }
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
