import { CONFIG, PLAYERS } from '../config.js';
import { RaycastSystem } from './RaycastSystem.js';

/**
 * CombatSystem - Manages attacks and combat resolution
 */
export class CombatSystem {
  constructor(scene, unitManager, gameState) {
    this.scene = scene;
    this.unitManager = unitManager;
    this.gameState = gameState;
    this.raycastSystem = new RaycastSystem(unitManager, gameState);
    this.attackGraphics = null;
  }

  /**
   * Perform an attack from attacker to target point
   * This will be called when player draws an attack path
   */
  performAttack(attackerPlayerNum, startX, startY, endX, endY) {
    // Cast ray and detect collision
    const hitResult = this.raycastSystem.castRay(startX, startY, endX, endY, attackerPlayerNum);

    // Visualize the attack
    this.visualizeAttack(startX, startY, endX, endY, hitResult.targetType);

    // Resolve the hit
    if (hitResult.hitTarget) {
      this.raycastSystem.resolveHit(hitResult, attackerPlayerNum, this.scene);
      return true;
    }

    return false;
  }

  /**
   * Visualize attack path with color based on result
   */
  visualizeAttack(startX, startY, endX, endY, targetType) {
    if (!this.attackGraphics) {
      this.attackGraphics = this.scene.add.graphics();
    } else {
      this.attackGraphics.clear();
    }

    // Choose color based on hit result
    let color;
    switch (targetType) {
      case 'shield':
      case 'weapon':
      case 'base':
        color = 0xffff00; // Yellow for successful hit
        break;
      default:
        color = 0xff6666; // Red for miss
    }

    // Draw attack line
    this.attackGraphics.lineStyle(2, color, 1);
    this.attackGraphics.beginPath();
    this.attackGraphics.moveTo(startX, startY);
    this.attackGraphics.lineTo(endX, endY);
    this.attackGraphics.strokePath();

    // Draw start point
    this.attackGraphics.fillStyle(color, 0.8);
    this.attackGraphics.fillCircle(startX, startY, 4);

    // Auto-remove after delay
    this.scene.time.delayedCall(500, () => {
      if (this.attackGraphics) {
        this.attackGraphics.clear();
      }
    });
  }

  /**
   * Get all valid attack targets for a player
   */
  getValidTargets(playerNum) {
    const targets = [];
    const opponentNum = playerNum === PLAYERS.PLAYER_1 ? PLAYERS.PLAYER_2 : PLAYERS.PLAYER_1;

    // Add shields
    const shields = this.unitManager.getShieldsForPlayer(opponentNum);
    targets.push(...shields.map(s => ({ type: 'shield', object: s, x: s.centerX, y: s.centerY })));

    // Add weapons
    const weapons = this.unitManager.getWeaponsForPlayer(opponentNum);
    targets.push(...weapons.map(w => ({ type: 'weapon', object: w, x: w.x, y: w.y })));

    // Add base
    const baseY = opponentNum === PLAYERS.PLAYER_1
      ? CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET
      : CONFIG.BASE_Y_OFFSET;
    const baseX = CONFIG.CANVAS_WIDTH / 2;
    targets.push({ type: 'base', object: null, x: baseX, y: baseY });

    return targets;
  }

  /**
   * Clear attack visualization
   */
  clearVisualization() {
    if (this.attackGraphics) {
      this.attackGraphics.clear();
    }
  }
}
