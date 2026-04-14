import { CONFIG } from '../config.js';

/**
 * Weapon - An offensive unit that attacks enemies
 * Represented as a triangle (fighter)
 */
export class Weapon {
  constructor(scene, playerNum, x, y) {
    this.scene = scene;
    this.playerNum = playerNum;
    this.x = x;
    this.y = y;
    this.size = 15;
    this.active = true;

    // Create visual representation
    this.graphics = scene.add.graphics();
    this.draw();
  }

  draw() {
    this.graphics.clear();
    if (!this.active) return;

    // Draw weapon as red triangle (fighter)
    this.graphics.fillStyle(0xff0000, 0.8);
    this.graphics.beginPath();
    this.graphics.moveTo(this.x, this.y - this.size);
    this.graphics.lineTo(this.x + this.size, this.y + this.size);
    this.graphics.lineTo(this.x - this.size, this.y + this.size);
    this.graphics.closePath();
    this.graphics.fillPath();

    // Draw border
    this.graphics.lineStyle(2, 0xcc0000, 1);
    this.graphics.strokePath();
  }

  /**
   * Get bounding box for collision detection
   */
  getBounds() {
    return {
      minX: this.x - this.size,
      maxX: this.x + this.size,
      minY: this.y - this.size,
      maxY: this.y + this.size,
      width: this.size * 2,
      height: this.size * 2,
    };
  }

  /**
   * Check if a point is inside this weapon's bounding box
   */
  contains(px, py) {
    const bounds = this.getBounds();
    return px >= bounds.minX && px <= bounds.maxX && py >= bounds.minY && py <= bounds.maxY;
  }

  /**
   * Destroy the weapon
   */
  destroy() {
    this.active = false;
    this.graphics.clear();
    this.graphics.destroy();
  }
}
