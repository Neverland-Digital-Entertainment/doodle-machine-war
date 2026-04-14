import { CONFIG } from '../config.js';

/**
 * FeedbackSystem - Manages visual feedback effects
 * Includes destruction animations, hit effects, and target highlights
 */
export class FeedbackSystem {
  constructor(scene) {
    this.scene = scene;
    this.effectGraphics = scene.add.graphics();
  }

  /**
   * Show destruction effect when a unit is destroyed
   */
  showDestructionEffect(x, y, color = 0xffff00) {
    // Flash effect
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(color, 0.6);
    graphics.fillCircle(x, y, 20);

    // Fade out animation
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 300,
      onComplete: () => graphics.destroy(),
    });

    // Particle burst effect (multiple flashes)
    for (let i = 0; i < 3; i++) {
      const particle = this.scene.add.graphics();
      particle.fillStyle(color, 0.8);
      const radius = 5 + i * 3;
      particle.fillCircle(x, y, radius);

      this.scene.tweens.add({
        targets: particle,
        alpha: 0,
        scale: 2,
        duration: 400 + i * 100,
        onComplete: () => particle.destroy(),
      });
    }
  }

  /**
   * Show hit feedback at impact point
   */
  showHitFeedback(hitPoint, isShield = false) {
    if (!hitPoint) return;

    const color = isShield ? 0xffa500 : 0xff0000;
    const graphics = this.scene.add.graphics();

    // Draw impact circle
    graphics.lineStyle(3, color, 1);
    graphics.strokeCircle(hitPoint.x, hitPoint.y, 15);

    // Animate away
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 200,
      onComplete: () => graphics.destroy(),
    });
  }

  /**
   * Highlight a unit (for targeting or selection)
   */
  highlightUnit(unit, color = 0xffff00, duration = 200) {
    if (!unit) return;

    const graphics = this.scene.add.graphics();

    // Draw highlight based on unit type
    if (unit.radius !== undefined) {
      // Shield (circular)
      graphics.lineStyle(3, color, 0.8);
      graphics.strokeCircle(unit.centerX, unit.centerY, unit.radius + 5);
    } else if (unit.getBounds) {
      // Weapon (rectangular)
      const bounds = unit.getBounds();
      graphics.lineStyle(3, color, 0.8);
      graphics.strokeRect(
        bounds.minX - 3,
        bounds.minY - 3,
        bounds.width + 6,
        bounds.height + 6
      );
    }

    // Fade animation
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: duration,
      onComplete: () => graphics.destroy(),
    });
  }

  /**
   * Show damage feedback (for base damage)
   */
  showDamageNumber(x, y, damage = 1) {
    const text = this.scene.add.text(x, y, `-${damage}`, {
      font: '20px Arial',
      fill: '#ff0000',
      fontStyle: 'bold',
    });

    text.setOrigin(0.5);

    // Float up and fade out
    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  /**
   * Clear all feedback graphics
   */
  clear() {
    this.effectGraphics.clear();
  }
}
