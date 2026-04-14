import { PLAYERS } from '../config.js';

/**
 * Player - Represents a player in the game
 * Stores player-specific data like HP, zone, and units
 */
export class Player {
  constructor(playerNum, zone, baseY) {
    this.playerNum = playerNum;
    this.zone = zone; // 'top' or 'bottom'
    this.baseY = baseY;
    this.hp = 4;
    this.shields = [];
    this.weapons = [];
  }

  /**
   * Take damage to the base
   */
  takeDamage() {
    this.hp = Math.max(0, this.hp - 1);
    return this.hp;
  }

  /**
   * Heal the base (if needed)
   */
  heal(amount = 1) {
    this.hp = Math.min(4, this.hp + amount);
    return this.hp;
  }

  /**
   * Check if player is defeated
   */
  isDefeated() {
    return this.hp <= 0;
  }

  /**
   * Add a shield unit
   */
  addShield(shield) {
    this.shields.push(shield);
  }

  /**
   * Remove a shield unit
   */
  removeShield(shield) {
    const idx = this.shields.indexOf(shield);
    if (idx >= 0) {
      this.shields.splice(idx, 1);
    }
  }

  /**
   * Get shield count
   */
  getShieldCount() {
    return this.shields.length;
  }

  /**
   * Add a weapon unit
   */
  addWeapon(weapon) {
    this.weapons.push(weapon);
  }

  /**
   * Remove a weapon unit
   */
  removeWeapon(weapon) {
    const idx = this.weapons.indexOf(weapon);
    if (idx >= 0) {
      this.weapons.splice(idx, 1);
    }
  }

  /**
   * Get weapon count
   */
  getWeaponCount() {
    return this.weapons.length;
  }

  /**
   * Reset player to initial state
   */
  reset() {
    this.hp = 4;
    this.shields = [];
    this.weapons = [];
  }
}
