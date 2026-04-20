import { CONFIG, PLAYERS } from '../config.js';
import { Shield } from '../entities/Shield.js';
import { Weapon } from '../entities/Weapon.js';

/**
 * UnitManager - Manages placement, collision detection, and limits for units
 */
export class UnitManager {
  constructor(scene) {
    this.scene = scene;
    this.shields = [];
    this.weapons = [];
    this.maxShieldsPerPlayer = 3;
  }

  /**
   * Try to place a shield (concentric around base)
   * Returns true if placement succeeds, false if it fails
   */
  placeShield(playerNum) {
    // Check max shields limit
    const playerShields = this.shields.filter(s => s.playerNum === playerNum);
    if (playerShields.length >= this.maxShieldsPerPlayer) {
      console.log(`Cannot place shield: player already has ${this.maxShieldsPerPlayer} shields`);
      return 'limit';
    }

    // Determine shield layer (1, 2, or 3 based on count)
    const shieldLayer = playerShields.length + 1;

    // Create and add shield
    const shield = new Shield(this.scene, playerNum, shieldLayer);
    this.shields.push(shield);

    // Spawn-in effect
    if (this.scene.feedbackSystem) {
      this.scene.feedbackSystem.showSpawnEffect(shield.sprite, 'shield');
    }

    return 'ok';
  }

  /**
   * Try to place a weapon at the given position
   * Returns true if placement succeeds, false if it fails
   */
  placeWeapon(playerNum, x, y) {
    // Clamp X so the 128px plane stays fully on screen
    const margin = 64;
    x = Math.max(margin, Math.min(CONFIG.CANVAS_WIDTH - margin, x));

    // Check zone boundaries (Y only — X is already clamped)
    if (!this.isValidWeaponZone(playerNum, y)) {
      console.log('Cannot place weapon: outside valid zone');
      return 'zone';
    }

    // Check collision with existing units
    if (this.hasCollision(x, y, 30, 30)) {
      console.log('Cannot place weapon: collision detected');
      return 'overlap';
    }

    // Create and add weapon
    const weapon = new Weapon(this.scene, playerNum, x, y);
    this.weapons.push(weapon);

    // Spawn-in effect
    if (this.scene.feedbackSystem) {
      this.scene.feedbackSystem.showSpawnEffect(weapon.sprite, 'weapon');
    }

    return 'ok';
  }

  /**
   * Check if a position collides with any existing units
   */
  hasCollision(x, y, width, height) {
    const testBounds = {
      minX: x - width / 2,
      maxX: x + width / 2,
      minY: y - height / 2,
      maxY: y + height / 2,
      centerX: x,
      centerY: y,
    };

    // Check weapons collision with other weapons
    for (const weapon of this.weapons) {
      if (this.boundsOverlap(testBounds, weapon.getBounds())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if two bounding boxes overlap
   */
  boundsOverlap(bounds1, bounds2) {
    return !(
      bounds1.maxX < bounds2.minX ||
      bounds1.minX > bounds2.maxX ||
      bounds1.maxY < bounds2.minY ||
      bounds1.minY > bounds2.maxY
    );
  }

  /**
   * Check if a weapon position is valid for the player's zone
   */
  isValidWeaponZone(playerNum, y) {
    if (playerNum === PLAYERS.PLAYER_1) {
      return y > CONFIG.DIVIDER_Y && y < CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET + 50;
    }
    if (playerNum === PLAYERS.PLAYER_2) {
      return y < CONFIG.DIVIDER_Y && y > CONFIG.BASE_Y_OFFSET - 50;
    }
    return false;
  }

  isValidWeaponPosition(playerNum, x, y) {
    const margin = 64;
    if (x < margin || x > CONFIG.CANVAS_WIDTH - margin) return false;
    return this.isValidWeaponZone(playerNum, y);
  }

  /**
   * Get all shields for a player
   */
  getShieldsForPlayer(playerNum) {
    return this.shields.filter(s => s.playerNum === playerNum && s.active);
  }

  /**
   * Get all weapons for a player
   */
  getWeaponsForPlayer(playerNum) {
    return this.weapons.filter(w => w.playerNum === playerNum && w.active);
  }

  /**
   * Get all active shields
   */
  getAllShields() {
    return this.shields.filter(s => s.active);
  }

  /**
   * Get all active weapons
   */
  getAllWeapons() {
    return this.weapons.filter(w => w.active);
  }

  /**
   * Remove a shield
   */
  removeShield(shield) {
    const idx = this.shields.indexOf(shield);
    if (idx >= 0) {
      this.shields[idx].destroy();
      this.shields.splice(idx, 1);
    }
  }

  /**
   * Remove a weapon
   */
  removeWeapon(weapon) {
    const idx = this.weapons.indexOf(weapon);
    if (idx >= 0) {
      this.weapons[idx].destroy();
      this.weapons.splice(idx, 1);
    }
  }

  /**
   * Clear all units (for reset)
   */
  clear() {
    for (const shield of this.shields) {
      shield.destroy();
    }
    for (const weapon of this.weapons) {
      weapon.destroy();
    }
    this.shields = [];
    this.weapons = [];
  }
}
