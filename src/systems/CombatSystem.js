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
   */
  performAttack(attackerPlayerNum, startX, startY, endX, endY) {
    const hitResult = this.raycastSystem.castRay(startX, startY, endX, endY, attackerPlayerNum);

    this.visualizeAttack(startX, startY, endX, endY, hitResult.targetType);

    if (hitResult.hitTarget) {
      this.raycastSystem.resolveHit(hitResult, attackerPlayerNum, this.scene);
      return true;
    }

    return false;
  }

  /**
   * Visualize attack path with pencil-style line
   */
  visualizeAttack(startX, startY, endX, endY, targetType) {
    if (!this.attackGraphics) {
      this.attackGraphics = this.scene.add.graphics();
    } else {
      this.attackGraphics.clear();
    }

    const color = (targetType === 'shield' || targetType === 'weapon' || targetType === 'base')
      ? 0x228822  // Dark green for hit
      : 0xaa2222; // Dark red for miss

    // Pencil-style: 3 layered jittered strokes
    const points = [{ x: startX, y: startY }, { x: endX, y: endY }];
    this._drawPencilLine(this.attackGraphics, points, color, 2);

    // Start dot
    this.attackGraphics.fillStyle(color, 0.8);
    this.attackGraphics.fillCircle(startX, startY, 4);

    this.scene.time.delayedCall(600, () => {
      if (this.attackGraphics) {
        this.attackGraphics.clear();
      }
    });
  }

  /**
   * Draw pencil-style line (shared with DrawingSystem logic)
   */
  _drawPencilLine(g, points, color, baseWidth) {
    this._drawJitteredPath(g, points, color, baseWidth + 1, 0.6, 0.12);
    this._drawJitteredPath(g, points, color, baseWidth, 0.8, 0.55);
    this._drawJitteredPath(g, points, color, Math.max(1, baseWidth - 1), 0.3, 0.85);
  }

  _drawJitteredPath(g, points, color, width, jitter, alpha) {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(
      points[0].x + (Math.random() - 0.5) * jitter,
      points[0].y + (Math.random() - 0.5) * jitter
    );
    for (let i = 1; i < points.length; i++) {
      g.lineTo(
        points[i].x + (Math.random() - 0.5) * jitter,
        points[i].y + (Math.random() - 0.5) * jitter
      );
    }
    g.strokePath();
  }

  /**
   * Get all valid attack targets for a player
   */
  getValidTargets(playerNum) {
    const targets = [];
    const opponentNum = playerNum === PLAYERS.PLAYER_1 ? PLAYERS.PLAYER_2 : PLAYERS.PLAYER_1;

    const shields = this.unitManager.getShieldsForPlayer(opponentNum);
    targets.push(...shields.map(s => ({ type: 'shield', object: s, x: s.centerX, y: s.centerY })));

    const weapons = this.unitManager.getWeaponsForPlayer(opponentNum);
    targets.push(...weapons.map(w => ({ type: 'weapon', object: w, x: w.x, y: w.y })));

    const baseY = opponentNum === PLAYERS.PLAYER_1
      ? CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET
      : CONFIG.BASE_Y_OFFSET;
    targets.push({ type: 'base', object: null, x: CONFIG.CANVAS_WIDTH / 2, y: baseY });

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
