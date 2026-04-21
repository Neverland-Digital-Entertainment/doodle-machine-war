import { CONFIG, PLAYERS } from '../config.js';
import { RaycastSystem } from './RaycastSystem.js';

/**
 * CombatSystem - Attack logic with animated visuals.
 *
 * performAttack() returns a Promise that resolves after the line animation
 * and hit resolution are complete.  Callers should await / .then() it.
 */
export class CombatSystem {
  constructor(scene, unitManager, gameState) {
    this.scene       = scene;
    this.unitManager = unitManager;
    this.gameState   = gameState;
    this.raycastSystem = new RaycastSystem(unitManager, gameState);
  }

  /**
   * Perform an attack.  Returns a Promise that resolves when the full
   * animation + hit resolution sequence is done.
   */
  performAttack(attackerPlayerNum, startX, startY, endX, endY, options = {}) {
    const { piercing = false, sourceCannon = null } = options;
    const hitResult = this.raycastSystem.castRay(
      startX, startY, endX, endY, attackerPlayerNum, { piercing }
    );

    const hit   = !!hitResult.hitTarget;
    // Piercing shots use a distinct orange/red hue so the player sees the difference
    const color = piercing ? 0xdd6622 : (hit ? 0x228822 : 0xaa2222);

    // Capture visual info before any logical destruction
    let targetSprite = null;
    let targetCX = endX;
    let targetCY = endY;
    let targetSize = 60;
    let skipDestructionEffect = false;

    if (hit) {
      if (hitResult.targetType === 'shield') {
        const obj = hitResult.targetObject;
        targetSprite = obj.sprite;
        targetCX     = obj.centerX;
        targetCY     = obj.centerY;
        targetSize   = 80;
        // Detach sprite so Shield.destroy() won't kill it prematurely
        obj.sprite = null;
        this.unitManager.removeShield(obj);
      } else if (hitResult.targetType === 'weapon') {
        const obj = hitResult.targetObject;
        targetSprite = obj.sprite;
        targetCX     = obj.x;
        targetCY     = obj.y;
        targetSize   = 50;
        obj.sprite = null;
        this.unitManager.removeWeapon(obj);
      } else if (hitResult.targetType === 'cannon') {
        // Cannon was hit: it stays on the board but is "spent" (scribbled out).
        const obj = hitResult.targetObject;
        targetCX = obj.x;
        targetCY = obj.y;
        obj.markSpent();
        skipDestructionEffect = true;
        if (this.scene?.feedbackSystem) {
          this.scene.feedbackSystem._playSound('sfx-scribble', { volume: 0.85 });
        }
      } else if (hitResult.targetType === 'base') {
        // Damage applied immediately so game state is consistent
        const defender = hitResult.hitTarget;
        this.gameState.damageBase(defender);
        // Draw line to base center
        const baseY = defender === PLAYERS.PLAYER_1
          ? CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET
          : CONFIG.BASE_Y_OFFSET;
        targetCX = CONFIG.CANVAS_WIDTH / 2;
        targetCY = baseY;
        // Play destroy sound on base hit
        if (this.scene?.feedbackSystem) {
          this.scene.feedbackSystem._playSound('sfx-destroy', { volume: 0.9 });
        }
        console.log(`Base damaged! HP: ${this.gameState.getPlayerHP(defender)}`);
      }
    }

    // Line draws all the way to target center
    const drawEndX = hit ? targetCX : endX;
    const drawEndY = hit ? targetCY : endY;

    // Mark the source cannon as spent after it fires (single-use).
    if (sourceCannon && !sourceCannon.spent) {
      sourceCannon.markSpent();
    }

    // Animate the line, then show destruction effect and resolve
    return new Promise((resolve) => {
      if (this.scene?.feedbackSystem) {
        this.scene.feedbackSystem.animateAttackLine(
          startX, startY, drawEndX, drawEndY, color,
          () => {
            if (hit && hitResult.targetType !== 'base' && !skipDestructionEffect) {
              this.scene.feedbackSystem.showDestructionEffect(
                targetSprite, targetCX, targetCY, targetSize
              );
            }
            resolve();
          }
        );
      } else {
        // No feedback system — immediate cleanup
        targetSprite?.destroy();
        resolve();
      }
    });
  }

  /**
   * Get all valid attack targets for a player (used by AI)
   */
  getValidTargets(playerNum) {
    const opponentNum = playerNum === PLAYERS.PLAYER_1 ? PLAYERS.PLAYER_2 : PLAYERS.PLAYER_1;

    const shields = this.unitManager.getShieldsForPlayer(opponentNum);
    const weapons = this.unitManager.getWeaponsForPlayer(opponentNum);

    const targets = [
      ...shields.map(s => ({ type: 'shield', x: s.centerX, y: s.centerY })),
      ...weapons.map(w => ({ type: 'weapon', x: w.x,       y: w.y       })),
    ];

    const baseY = opponentNum === PLAYERS.PLAYER_1
      ? CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET
      : CONFIG.BASE_Y_OFFSET;
    targets.push({ type: 'base', x: CONFIG.CANVAS_WIDTH / 2, y: baseY });

    return targets;
  }
}
