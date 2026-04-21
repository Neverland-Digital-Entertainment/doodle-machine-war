import { CONFIG, PLAYERS } from '../config.js';

/**
 * RaycastSystem - Handles ray casting and collision detection
 * Collision priority: Shield > Weapon > Base
 */
export class RaycastSystem {
  constructor(unitManager, gameState) {
    this.unitManager = unitManager;
    this.gameState = gameState;
  }

  /**
   * Cast a ray from start to end point and detect collisions
   * Returns collision result with priority:
   * 1. Shield (highest priority)
   * 2. Weapon
   * 3. Base (lowest priority)
   */
  castRay(startX, startY, endX, endY, attackerPlayerNum, options = {}) {
    const { piercing = false } = options;
    const result = {
      hitTarget: null,
      targetType: null, // 'shield', 'weapon', 'cannon', 'base'
      targetObject: null,
      hitPoint: null,
      distance: 0,
    };

    // Determine defender based on attacker
    const defenderPlayerNum = attackerPlayerNum === PLAYERS.PLAYER_1 ? PLAYERS.PLAYER_2 : PLAYERS.PLAYER_1;

    // Piercing shots (cannon) bypass all defences and go straight to the base.
    if (!piercing) {
      // 1. Shields (highest priority)
      const shieldHit = this.checkShieldCollision(startX, startY, endX, endY, defenderPlayerNum);
      if (shieldHit) {
        result.hitTarget = shieldHit.shield;
        result.targetType = 'shield';
        result.targetObject = shieldHit.shield;
        result.hitPoint = shieldHit.hitPoint;
        result.distance = shieldHit.distance;
        return result;
      }

      // 2a. Weapons & cannons — same tier; pick whichever is closest
      const weaponHit = this.checkWeaponCollision(startX, startY, endX, endY, defenderPlayerNum);
      const cannonHit = this.checkCannonCollision(startX, startY, endX, endY, defenderPlayerNum);
      let midHit = null;
      if (weaponHit && cannonHit) {
        midHit = weaponHit.distance <= cannonHit.distance
          ? { kind: 'weapon', ...weaponHit }
          : { kind: 'cannon', ...cannonHit };
      } else if (weaponHit) {
        midHit = { kind: 'weapon', ...weaponHit };
      } else if (cannonHit) {
        midHit = { kind: 'cannon', ...cannonHit };
      }
      if (midHit) {
        const obj = midHit.kind === 'weapon' ? midHit.weapon : midHit.cannon;
        result.hitTarget = obj;
        result.targetType = midHit.kind;
        result.targetObject = obj;
        result.hitPoint = midHit.hitPoint;
        result.distance = midHit.distance;
        return result;
      }
    }

    // Base collision (always checked; only one reached in piercing mode)
    const baseHit = this.checkBaseCollision(startX, startY, endX, endY, defenderPlayerNum);
    if (baseHit) {
      result.hitTarget = defenderPlayerNum;
      result.targetType = 'base';
      result.targetObject = null;
      result.hitPoint = baseHit.hitPoint;
      result.distance = baseHit.distance;
      return result;
    }

    return result; // No collision
  }

  /**
   * Check if ray intersects with any shields
   */
  checkShieldCollision(x1, y1, x2, y2, playerNum) {
    const shields = this.unitManager.getShieldsForPlayer(playerNum);
    let closestHit = null;
    let closestDistance = Infinity;

    for (const shield of shields) {
      const hit = this.rayCircleIntersection(x1, y1, x2, y2, shield.centerX, shield.centerY, shield.radius);
      if (hit && hit.distance < closestDistance) {
        closestHit = { shield, hitPoint: hit.point, distance: hit.distance };
        closestDistance = hit.distance;
      }
    }

    return closestHit;
  }

  /**
   * Check if ray intersects with any weapons (bounding box)
   */
  checkWeaponCollision(x1, y1, x2, y2, playerNum) {
    const weapons = this.unitManager.getWeaponsForPlayer(playerNum);
    let closestHit = null;
    let closestDistance = Infinity;

    for (const weapon of weapons) {
      const bounds = weapon.getBounds();
      const hit = this.rayRectIntersection(x1, y1, x2, y2, bounds);
      if (hit && hit.distance < closestDistance) {
        closestHit = { weapon, hitPoint: hit.point, distance: hit.distance };
        closestDistance = hit.distance;
      }
    }

    return closestHit;
  }

  /**
   * Check if ray intersects any active (unspent) cannons.
   * Spent cannons are NOT included — they're just scenery.
   */
  checkCannonCollision(x1, y1, x2, y2, playerNum) {
    if (!this.unitManager.getCannonsForPlayer) return null;
    const cannons = this.unitManager.getCannonsForPlayer(playerNum);
    let closestHit = null;
    let closestDistance = Infinity;

    for (const cannon of cannons) {
      const bounds = cannon.getBounds();
      const hit = this.rayRectIntersection(x1, y1, x2, y2, bounds);
      if (hit && hit.distance < closestDistance) {
        closestHit = { cannon, hitPoint: hit.point, distance: hit.distance };
        closestDistance = hit.distance;
      }
    }
    return closestHit;
  }

  /**
   * Check if ray intersects with player base
   */
  checkBaseCollision(x1, y1, x2, y2, playerNum) {
    const baseY = playerNum === PLAYERS.PLAYER_1
      ? CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET
      : CONFIG.BASE_Y_OFFSET;

    const baseX = CONFIG.CANVAS_WIDTH / 2;
    const baseSize = 64; // half of 128px sprite — hitbox matches image size exactly

    const bounds = {
      minX: baseX - baseSize,
      maxX: baseX + baseSize,
      minY: baseY - baseSize,
      maxY: baseY + baseSize,
    };

    const hit = this.rayRectIntersection(x1, y1, x2, y2, bounds);
    if (hit) {
      return { hitPoint: hit.point, distance: hit.distance };
    }

    return null;
  }

  /**
   * Calculate intersection of ray (x1,y1)→(x2,y2) with circle
   * Returns {point, distance} or null if no intersection
   */
  rayCircleIntersection(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);

    // Find first intersection in ray direction (0 < t <= 1)
    let t = null;
    if (t1 >= 0 && t1 <= 1) t = t1;
    else if (t2 >= 0 && t2 <= 1) t = t2;

    if (t === null) return null;

    const hitX = x1 + t * dx;
    const hitY = y1 + t * dy;
    const distance = Math.sqrt((hitX - x1) ** 2 + (hitY - y1) ** 2);

    return { point: { x: hitX, y: hitY }, distance };
  }

  /**
   * Calculate intersection of ray (x1,y1)→(x2,y2) with axis-aligned rectangle
   * Returns {point, distance} or null if no intersection
   */
  rayRectIntersection(x1, y1, x2, y2, bounds) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    let tMin = 0;
    let tMax = 1;

    // Check X axis
    if (dx !== 0) {
      const t1 = (bounds.minX - x1) / dx;
      const t2 = (bounds.maxX - x1) / dx;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
    } else if (x1 < bounds.minX || x1 > bounds.maxX) {
      return null;
    }

    // Check Y axis
    if (dy !== 0) {
      const t1 = (bounds.minY - y1) / dy;
      const t2 = (bounds.maxY - y1) / dy;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
    } else if (y1 < bounds.minY || y1 > bounds.maxY) {
      return null;
    }

    if (tMin > tMax) return null;

    const t = tMin;
    const hitX = x1 + t * dx;
    const hitY = y1 + t * dy;
    const distance = Math.sqrt((hitX - x1) ** 2 + (hitY - y1) ** 2);

    return { point: { x: hitX, y: hitY }, distance };
  }

  /**
   * Resolve hit: destroy target or damage base
   */
  /**
   * resolveHit is now only used for base damage from within CombatSystem.
   * Unit removal (shield/weapon) is handled directly in CombatSystem.performAttack
   * so sprites can be animated before destruction.
   */
  resolveHit(hitResult, attackerPlayerNum, scene = null) {
    if (!hitResult.hitTarget) return false;

    if (hitResult.targetType === 'base') {
      const defenderPlayerNum = hitResult.hitTarget;
      this.gameState.damageBase(defenderPlayerNum);
      console.log(`Base damaged! HP: ${this.gameState.getPlayerHP(defenderPlayerNum)}`);
      return true;
    }

    return false;
  }
}
