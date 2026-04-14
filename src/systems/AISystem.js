import { CONFIG, PLAYERS } from '../config.js';

/**
 * AISystem - Manages AI opponent behavior
 * Simple AI that places shields/weapons and performs attacks
 */
export class AISystem {
  constructor(unitManager, combatSystem, gameState) {
    this.unitManager = unitManager;
    this.combatSystem = combatSystem;
    this.gameState = gameState;
    this.aiPlayer = PLAYERS.PLAYER_2;
    this.opponentPlayer = PLAYERS.PLAYER_1;
  }

  /**
   * Execute AI turn - perform only one action
   */
  executeTurn() {
    // Randomly choose one action: place shield, place weapon, or attack
    const shields = this.unitManager.getShieldsForPlayer(this.aiPlayer);
    const weapons = this.unitManager.getWeaponsForPlayer(this.aiPlayer);

    const actions = [];

    // Can place shield if less than 3
    if (shields.length < 3) {
      actions.push('shield');
    }

    // Can place weapon
    actions.push('weapon');

    // Can attack
    actions.push('attack');

    // Pick a random action
    if (actions.length === 0) actions.push('attack');
    const action = actions[Math.floor(Math.random() * actions.length)];

    // Execute the chosen action
    switch (action) {
      case 'shield':
        this.placeShield();
        break;
      case 'weapon':
        this.placeWeapon();
        break;
      case 'attack':
        this.executeAttack();
        break;
    }

    return Promise.resolve();
  }

  /**
   * Place one shield
   */
  placeShield() {
    const placed = this.unitManager.placeShield(this.aiPlayer);
    if (placed) {
      console.log('AI placed a shield');
    }
  }

  /**
   * Place one weapon
   */
  placeWeapon() {
    const x = this.getRandomWeaponX();
    const y = this.getRandomWeaponY();
    const placed = this.unitManager.placeWeapon(this.aiPlayer, x, y);
    if (placed) {
      console.log('AI placed a weapon');
    }
  }

  /**
   * Get random X position for AI weapon (within valid zone)
   */
  getRandomWeaponX() {
    return Math.random() * CONFIG.CANVAS_WIDTH;
  }

  /**
   * Get random Y position for AI weapon (top zone for Player 2)
   */
  getRandomWeaponY() {
    const minY = CONFIG.BASE_Y_OFFSET - 30;
    const maxY = CONFIG.DIVIDER_Y - 20;
    return minY + Math.random() * (maxY - minY);
  }

  /**
   * Execute attack towards opponent's units or base
   */
  executeAttack() {
    // Get all valid targets
    const targets = [];

    // Add opponent's shields
    const opponentShields = this.unitManager.getShieldsForPlayer(this.opponentPlayer);
    for (const shield of opponentShields) {
      targets.push({
        type: 'shield',
        x: shield.centerX,
        y: shield.centerY,
      });
    }

    // Add opponent's weapons
    const opponentWeapons = this.unitManager.getWeaponsForPlayer(this.opponentPlayer);
    for (const weapon of opponentWeapons) {
      targets.push({
        type: 'weapon',
        x: weapon.x,
        y: weapon.y,
      });
    }

    // Add opponent's base
    const opponentBaseY = this.opponentPlayer === PLAYERS.PLAYER_1
      ? CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET
      : CONFIG.BASE_Y_OFFSET;
    const opponentBaseX = CONFIG.CANVAS_WIDTH / 2;
    targets.push({
      type: 'base',
      x: opponentBaseX,
      y: opponentBaseY,
    });

    // If no targets, don't attack (shouldn't happen)
    if (targets.length === 0) return;

    // Pick a random target
    const target = targets[Math.floor(Math.random() * targets.length)];

    // Get AI attack position (from shields, weapons, or own base)
    const aiShields = this.unitManager.getShieldsForPlayer(this.aiPlayer);
    const aiWeapons = this.unitManager.getWeaponsForPlayer(this.aiPlayer);

    let startX, startY;

    if (aiWeapons.length > 0 || aiShields.length > 0) {
      // Attack from a unit position
      const allUnits = [...aiShields, ...aiWeapons];
      const unit = allUnits[Math.floor(Math.random() * allUnits.length)];

      if (unit.centerX !== undefined) {
        // Shield
        startX = unit.centerX;
        startY = unit.centerY;
      } else {
        // Weapon
        startX = unit.x;
        startY = unit.y;
      }
    } else {
      // Attack from own base if no units
      const aiBaseY = this.aiPlayer === PLAYERS.PLAYER_1
        ? CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET
        : CONFIG.BASE_Y_OFFSET;
      startX = CONFIG.CANVAS_WIDTH / 2;
      startY = aiBaseY;
    }

    // Attack the chosen target
    this.combatSystem.performAttack(this.aiPlayer, startX, startY, target.x, target.y);
    console.log(`AI attacking ${target.type}`);
  }
}
