import { CONFIG, PLAYERS } from '../config.js';

/**
 * AISystem - Simple AI opponent.
 * executeTurn() returns a Promise that resolves after all animations finish.
 * Attacks only originate from AI weapons (planes) — never from shields or base.
 */
export class AISystem {
  constructor(unitManager, combatSystem, gameState) {
    this.unitManager    = unitManager;
    this.combatSystem   = combatSystem;
    this.gameState      = gameState;
    this.aiPlayer       = PLAYERS.PLAYER_2;
    this.opponentPlayer = PLAYERS.PLAYER_1;
  }

  /**
   * Execute AI turn and return a Promise that resolves when done.
   */
  async executeTurn() {
    const shields = this.unitManager.getShieldsForPlayer(this.aiPlayer);
    const weapons = this.unitManager.getWeaponsForPlayer(this.aiPlayer);

    // Weighted action selection: attack 60%, weapon 25%, shield 15%
    // Build a weighted pool for available actions only
    const actionPool = [];
    if (weapons.length > 0) {
      for (let i = 0; i < 60; i++) actionPool.push('attack');
    }
    // Always allow weapon placement
    for (let i = 0; i < 25; i++) actionPool.push('weapon');
    // Shield only if under cap
    if (shields.length < 3) {
      for (let i = 0; i < 15; i++) actionPool.push('shield');
    }

    // Fallback: if no weapons yet, just place weapon or shield
    const pool = actionPool.length > 0 ? actionPool : ['weapon'];
    const action = pool[Math.floor(Math.random() * pool.length)];

    switch (action) {
      case 'shield':
        this.placeShield();
        break;
      case 'weapon':
        this.placeWeapon();
        break;
      case 'attack':
        await this.executeAttack();
        break;
    }
  }

  placeShield() {
    const placed = this.unitManager.placeShield(this.aiPlayer);
    if (placed) console.log('AI placed a shield');
  }

  placeWeapon() {
    const x = this._randomWeaponX();
    const y = this._randomWeaponY();
    const placed = this.unitManager.placeWeapon(this.aiPlayer, x, y);
    if (placed) console.log('AI placed a weapon');
  }

  /**
   * Attack from a random AI weapon toward a random opponent target.
   * Returns the Promise from performAttack so executeTurn can await it.
   */
  async executeAttack() {
    const aiWeapons = this.unitManager.getWeaponsForPlayer(this.aiPlayer);
    if (aiWeapons.length === 0) return; // safety — should not happen (action filtered above)

    // Attacker: random AI plane
    const attacker = aiWeapons[Math.floor(Math.random() * aiWeapons.length)];
    const startX = attacker.x;
    const startY = attacker.y;

    // Target: opponent base (65%) or opponent weapons (35%)
    // Shields are NOT direct targets — base-aimed attacks hit blocking shields
    // automatically via raycast priority, so no need to target them explicitly.
    const opponentWeapons = this.unitManager.getWeaponsForPlayer(this.opponentPlayer);
    const opponentBaseY   = CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET; // Player 1 is always bottom

    const baseTarget    = { type: 'base', x: CONFIG.CANVAS_WIDTH / 2, y: opponentBaseY };
    const weaponTargets = opponentWeapons.map(w => ({ type: 'weapon', x: w.x, y: w.y }));

    const targetPool = [];
    for (let i = 0; i < 65; i++) targetPool.push(baseTarget);
    if (weaponTargets.length > 0) {
      const slotsEach = Math.round(35 / weaponTargets.length);
      for (const w of weaponTargets)
        for (let i = 0; i < slotsEach; i++) targetPool.push(w);
    }

    const target = targetPool[Math.floor(Math.random() * targetPool.length)];
    console.log(`AI attacking ${target.type} from weapon`);

    await this.combatSystem.performAttack(
      this.aiPlayer, startX, startY, target.x, target.y
    );
  }

  _randomWeaponX() {
    return Math.random() * CONFIG.CANVAS_WIDTH;
  }

  _randomWeaponY() {
    const minY = CONFIG.BASE_Y_OFFSET - 30;
    const maxY = CONFIG.DIVIDER_Y - 20;
    return minY + Math.random() * (maxY - minY);
  }
}
