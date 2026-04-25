import { CONFIG, PLAYERS } from '../config.js';

/**
 * AISystem - Simple AI opponent.
 * executeTurn() returns a Promise that resolves after all animations finish.
 * Attacks only originate from AI weapons (planes) — never from shields or base.
 */
export class AISystem {
  constructor(unitManager, combatSystem, gameState, difficulty = 'easy') {
    this.unitManager    = unitManager;
    this.combatSystem   = combatSystem;
    this.gameState      = gameState;
    this.aiPlayer       = PLAYERS.PLAYER_2;
    this.opponentPlayer = PLAYERS.PLAYER_1;
    this.difficulty     = difficulty; // 'easy' (default) or 'hard'
  }

  /**
   * Get weight config for current difficulty.
   * Easy: 60/25/15 (attack/weapon/shield)
   * Hard: 70/15/15 — more aggressive but keeps defense
   */
  _getActionWeights() {
    if (this.difficulty === 'hard') {
      return { attack: 70, weapon: 15, shield: 15 };
    }
    return { attack: 60, weapon: 25, shield: 15 };
  }

  /**
   * Execute AI turn and return a Promise that resolves when done.
   */
  async executeTurn() {
    const shields = this.unitManager.getShieldsForPlayer(this.aiPlayer);
    const weapons = this.unitManager.getWeaponsForPlayer(this.aiPlayer);

    // Weighted action selection based on difficulty.
    // Weights are in _getActionWeights(). Build a pool for available actions only.
    const w = this._getActionWeights();
    const actionPool = [];
    if (weapons.length > 0) {
      for (let i = 0; i < w.attack; i++) actionPool.push('attack');
    }
    // Always allow unit placement (weapon OR cannon — decided later 60/40)
    for (let i = 0; i < w.weapon; i++) actionPool.push('unit');
    // Shield only if under cap
    if (shields.length < 3) {
      for (let i = 0; i < w.shield; i++) actionPool.push('shield');
    }

    // Fallback: if no weapons yet, just place a unit or shield
    const pool = actionPool.length > 0 ? actionPool : ['unit'];
    const action = pool[Math.floor(Math.random() * pool.length)];

    switch (action) {
      case 'shield':
        this.placeShield();
        break;
      case 'unit':
        this.placeUnit();
        break;
      case 'attack':
        await this.executeAttack();
        break;
    }
  }

  /**
   * Decide between weapon vs cannon placement.
   * Ratio is 60/40 (weapon/cannon), but cannon is capped at 1 per battle —
   * if one already exists (active or spent), always place a weapon.
   */
  placeUnit() {
    const ownedCannons = this.unitManager.getAllCannonsForPlayer(this.aiPlayer);
    const wantCannon = ownedCannons.length === 0 && Math.random() < 0.40;
    if (wantCannon) {
      this.placeCannon();
    } else {
      this.placeWeapon();
    }
  }

  placeShield() {
    const placed = this.unitManager.placeShield(this.aiPlayer);
    if (placed) console.log('AI placed a shield');
  }

  placeWeapon() {
    // Retry a few times — a single random spot can collide with an existing
    // unit and silently fail, which would waste the AI's turn.
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = this._randomWeaponX();
      const y = this._randomWeaponY();
      const result = this.unitManager.placeWeapon(this.aiPlayer, x, y);
      if (result === 'ok' || result === true) {
        console.log('AI placed a weapon');
        return true;
      }
    }
    console.log('AI failed to place weapon after retries — falling back to shield');
    // Last-resort fallback so the turn isn't wasted (respects cap internally)
    this.placeShield();
    return false;
  }

  /**
   * Place cannon hugging the AI base (top of the field) so it's harder to
   * destroy behind the shield layer.  Retries a few times if collision fails.
   */
  placeCannon() {
    for (let attempt = 0; attempt < 6; attempt++) {
      const x = 120 + Math.random() * (CONFIG.CANVAS_WIDTH - 240);
      // AI is PLAYER_2 (top). Base is at BASE_Y_OFFSET; park cannon 40-90px below it
      const y = CONFIG.BASE_Y_OFFSET + 40 + Math.random() * 50;
      const result = this.unitManager.placeCannon(this.aiPlayer, x, y);
      if (result === 'ok') {
        console.log('AI placed a cannon near base');
        return;
      }
      if (result === 'limit') return; // already has one
    }
    // If cannon placement keeps failing, fall back to a weapon so the turn isn't wasted
    this.placeWeapon();
  }

  /**
   * Attack from a random AI weapon toward a random opponent target.
   * Returns the Promise from performAttack so executeTurn can await it.
   */
  async executeAttack() {
    const aiWeapons = this.unitManager.getWeaponsForPlayer(this.aiPlayer);
    const aiCannons = this.unitManager.getCannonsForPlayer(this.aiPlayer);

    // Cannon probability based on opponent's shield count + AI HP bonus.
    // shields=1 → 15%, shields=2 → 35%, shields=3 → 60%
    // HP3 +10%, HP2 +15%, HP1 +20%
    // If cannon is triggered but not yet built, place it first (uses this turn).
    // If cannon was already spent this battle, fall through to weapon attack.
    {
      const opponentShields = this.unitManager.getShieldsForPlayer(this.opponentPlayer).length;
      const selfHP = this.gameState.getPlayerHP(this.aiPlayer);
      const baseByShields = { 0: 0, 1: 0.15, 2: 0.35, 3: 0.60 };
      const bonusByHP     = { 4: 0,  3: 0.10, 2: 0.15, 1: 0.20 };
      const p = (baseByShields[opponentShields] ?? 0.60) + (bonusByHP[selfHP] ?? 0);

      if (Math.random() < Math.min(p, 0.95)) {
        if (aiCannons.length > 0) {
          // Have an active cannon — fire it
          await this._executeCannonAttack(aiCannons[0]);
          return;
        }
        const allCannons = this.unitManager.getAllCannonsForPlayer(this.aiPlayer);
        if (allCannons.length === 0) {
          // No cannon ever placed — build one now (turn used for placement)
          console.log('AI: cannon triggered — placing cannon instead of attacking');
          this.placeCannon();
          return;
        }
        // Cannon already spent this battle — fall through to weapon attack
      }
    }

    if (aiWeapons.length === 0) return; // safety — should not happen (action filtered above)

    // Attacker: random AI plane
    const attacker = aiWeapons[Math.floor(Math.random() * aiWeapons.length)];
    const startX = attacker.x;
    const startY = attacker.y;

    // Target: opponent base (80%) or opponent weapons (20%)
    // Shields are NOT direct targets — base-aimed attacks hit blocking shields
    // automatically via raycast priority, so no need to target them explicitly.
    const opponentWeapons = this.unitManager.getWeaponsForPlayer(this.opponentPlayer);
    const opponentBaseY   = CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET; // Player 1 is always bottom

    const baseTarget    = { type: 'base', x: CONFIG.CANVAS_WIDTH / 2, y: opponentBaseY };
    const weaponTargets = opponentWeapons.map(w => ({ type: 'weapon', x: w.x, y: w.y }));

    const targetPool = [];
    for (let i = 0; i < 80; i++) targetPool.push(baseTarget);
    if (weaponTargets.length > 0) {
      const slotsEach = Math.round(20 / weaponTargets.length);
      for (const w of weaponTargets)
        for (let i = 0; i < slotsEach; i++) targetPool.push(w);
    }

    const target = targetPool[Math.floor(Math.random() * targetPool.length)];
    console.log(`AI attacking ${target.type} from weapon`);

    await this.combatSystem.performAttack(
      this.aiPlayer, startX, startY, target.x, target.y
    );
  }

  /**
   * Piercing cannon shot — straight down the middle toward opponent base.
   */
  async _executeCannonAttack(cannon) {
    const targetX = CONFIG.CANVAS_WIDTH / 2;
    const targetY = CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET; // opponent is PLAYER_1 (bottom)
    console.log('AI firing cannon (piercing) at base');
    await this.combatSystem.performAttack(
      this.aiPlayer, cannon.x, cannon.y, targetX, targetY,
      { piercing: true, sourceCannon: cannon }
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
