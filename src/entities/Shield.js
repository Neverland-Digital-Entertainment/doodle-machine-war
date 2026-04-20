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

    // Shield center — sits slightly above/below the base sprite center
    if (playerNum === PLAYERS.PLAYER_1) {
      this.centerX = CONFIG.CANVAS_WIDTH / 2;
      this.centerY = CONFIG.CANVAS_HEIGHT - CONFIG.SHIELD_BASE_Y_OFFSET;
      this.isTopPlayer = false;
    } else {
      this.centerX = CONFIG.CANVAS_WIDTH / 2;
      this.centerY = CONFIG.SHIELD_BASE_Y_OFFSET - 22;
      this.isTopPlayer = true;
    }

    // Collision radius per layer:
    // Layer 1: 100  (200px wide — tight around base)
    // Layer 2: 132  (264px wide — mid-field)
    // Layer 3: 165  (330px wide — broader coverage)
    const radii = [100, 132, 165];
    this.radius = radii[shieldLayer - 1] || 100;

    // Display diameter = radius × 2 so the visual fills its collision circle exactly.
    const displaySize = this.radius * 2;

    this.sprite = scene.add.image(this.centerX, this.centerY, 'shield');
    this.sprite.setDisplaySize(displaySize, displaySize); // keep 1:1 ratio
    this.sprite.setAlpha(0.85);
    // Draw shields below HP cells: explicit low depth (HP cells are at depth 10+)
    this.sprite.setDepth(2);

    // No flip needed — shield image works for both orientations
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
