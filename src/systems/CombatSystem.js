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

    // Piercing cannon shots follow a completely different resolution path:
    // they hit EVERY shield/weapon/cannon in their line AND the base.
    if (piercing) {
      return this._performPiercingAttack(
        attackerPlayerNum, startX, startY, endX, endY, sourceCannon
      );
    }

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
        // sfx-scribble + sfx-destroy are played by showDestructionEffect after line animation
        console.log(`Base damaged! HP: ${this.gameState.getPlayerHP(defender)}`);
      }
    }

    // Line draws all the way to target center
    const drawEndX = hit ? targetCX : endX;
    const drawEndY = hit ? targetCY : endY;

    // Mark the source cannon as spent after it fires (single-use).
    // silent=true: the scribble visual+sound is handled by showDestructionEffect
    // in the animation callback, so markSpent must not double-play audio.
    if (sourceCannon && !sourceCannon.spent) {
      sourceCannon.markSpent(true);
    }

    // Animate the line, then show destruction effect and resolve
    return new Promise((resolve) => {
      if (this.scene?.feedbackSystem) {
        this.scene.feedbackSystem.animateAttackLine(
          startX, startY, drawEndX, drawEndY, color,
          () => {
            if (hit && !skipDestructionEffect) {
              // Base hits: sprite is null (base sprite stays); scribble still plays over the hit point
              this.scene.feedbackSystem.showDestructionEffect(
                hitResult.targetType === 'base' ? null : targetSprite,
                targetCX, targetCY, targetSize
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
   * Piercing cannon attack: hits everything in its straight line.
   * - Destroys every shield/weapon in the path
   * - Marks every cannon in the path as spent
   * - Damages base if the line reaches it
   * - The source cannon is marked spent at the end
   */
  _performPiercingAttack(attackerPlayerNum, startX, startY, endX, endY, sourceCannon) {
    const r = this.raycastSystem.castPiercingRay(
      startX, startY, endX, endY, attackerPlayerNum
    );

    // Orange piercing line
    const color = 0xdd6622;

    // Gather all destruction events with their positions, so we can animate
    // each one with a small stagger after the line lands.
    const destructions = [];

    // Shields
    for (const h of r.shieldHits) {
      const obj = h.shield;
      const sprite = obj.sprite;
      const cx = obj.centerX, cy = obj.centerY;
      obj.sprite = null;
      this.unitManager.removeShield(obj);
      destructions.push({ sprite, cx, cy, size: 80, distance: h.distance });
    }
    // Weapons
    for (const h of r.weaponHits) {
      const obj = h.weapon;
      const sprite = obj.sprite;
      const cx = obj.x, cy = obj.y;
      obj.sprite = null;
      this.unitManager.removeWeapon(obj);
      destructions.push({ sprite, cx, cy, size: 50, distance: h.distance });
    }
    // Cannons hit in the piercing path — mark spent (silent: sound handled by stagger)
    for (const h of r.cannonHits) {
      h.cannon.markSpent(true);
      // Add to stagger queue so scribble+destroy plays after the line lands
      destructions.push({ sprite: null, cx: h.cannon.x, cy: h.cannon.y, size: 70, distance: h.distance });
    }

    // Base damage (if line reaches it) — logic applied immediately,
    // but sound + scribble are deferred into the destructions stagger so
    // they play AFTER the cannon line lands, not before.
    let baseHit = false;
    let baseCX = endX, baseCY = endY;
    if (r.baseHit) {
      baseHit = true;
      const defender = r.defender;
      this.gameState.damageBase(defender);
      baseCY = defender === PLAYERS.PLAYER_1
        ? CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET
        : CONFIG.BASE_Y_OFFSET;
      baseCX = CONFIG.CANVAS_WIDTH / 2;
      // Add base to the stagger queue (sprite=null — base sprite stays on board)
      destructions.push({ sprite: null, cx: baseCX, cy: baseCY, size: 70, distance: r.baseHit.distance });
      console.log(`Base damaged (piercing)! HP: ${this.gameState.getPlayerHP(defender)}`);
    }

    // Mark the source cannon spent now that it has fired (silent — stagger handles audio)
    if (sourceCannon && !sourceCannon.spent) sourceCannon.markSpent(true);

    // Line extends all the way to base center if base was hit, else to user's endpoint
    const drawEndX = baseHit ? baseCX : endX;
    const drawEndY = baseHit ? baseCY : endY;

    return new Promise((resolve) => {
      if (!this.scene?.feedbackSystem) {
        for (const d of destructions) d.sprite?.destroy();
        resolve();
        return;
      }
      this.scene.feedbackSystem.animateAttackLine(
        startX, startY, drawEndX, drawEndY, color,
        ({ fadeOut }) => {
          destructions.sort((a, b) => a.distance - b.distance);
          if (destructions.length === 0) {
            // Nothing to destroy — fade beam immediately
            this.scene.time.delayedCall(400, fadeOut);
          } else {
            destructions.forEach((d, i) => {
              this.scene.time.delayedCall(i * 80, () => {
                this.scene.feedbackSystem.showDestructionEffect(
                  d.sprite, d.cx, d.cy, d.size
                );
                // Fade beam after the last target's destruction effect starts
                if (i === destructions.length - 1) {
                  this.scene.time.delayedCall(400, fadeOut);
                }
              });
            });
          }
          resolve();
        },
        'sfx-cannon',
        { lineWidth: 20, persist: true }  // thick beam, stays until all targets destroyed
      );
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
