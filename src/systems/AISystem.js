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

    // Build available actions
    const actions = [];
    if (shields.length < 3)  actions.push('shield');
    actions.push('weapon');
    if (weapons.length > 0)  actions.push('attack'); // only if AI has a plane to attack from

    const action = actions[Math.floor(Math.random() * actions.length)];

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

    // Target: opponent shields, weapons, or base
    const opponentShields = this.unitManager.getShieldsForPlayer(this.opponentPlayer);
    const opponentWeapons = this.unitManager.getWeaponsForPlayer(this.opponentPlayer);
    const opponentBaseY   = CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET; // Player 1 is always bottom

    const targets = [
      ...opponentShields.map(s => ({ type: 'shield', x: s.centerX, y: s.centerY })),
      ...opponentWeapons.map(w => ({ type: 'weapon', x: w.x,       y: w.y       })),
      { type: 'base', x: CONFIG.CANVAS_WIDTH / 2, y: opponentBaseY },
    ];

    const target = targets[Math.floor(Math.random() * targets.length)];
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
