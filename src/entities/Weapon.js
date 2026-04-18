import { CONFIG, PLAYERS } from '../config.js';
import planePlayerUrl from '../images/plane-player.webp';
import planeEnemyUrl from '../images/plane-enemy.webp';

/**
 * Weapon - An offensive unit that attacks enemies
 * Represented as a plane image (fighter)
 */
export class Weapon {
  constructor(scene, playerNum, x, y) {
    this.scene = scene;
    this.playerNum = playerNum;
    this.x = x;
    this.y = y;
    this.size = 22; // half-size for bounding box
    this.active = true;

    // Create sprite using the pre-loaded texture
    const textureKey = playerNum === PLAYERS.PLAYER_1 ? 'plane-player' : 'plane-enemy';
    this.sprite = scene.add.image(x, y, textureKey);
    this.sprite.setDisplaySize(this.size * 2, this.size * 2);

    // Player 2 (top/enemy) plane faces downward — rotate 180°
    if (playerNum === PLAYERS.PLAYER_2) {
      this.sprite.setAngle(180);
    }
  }

  /**
   * Get bounding box for collision detection
   * Must match contract expected by RaycastSystem and DrawingSystem
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
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
