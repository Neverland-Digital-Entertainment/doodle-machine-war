import { ShapeDetector } from '../utils/ShapeDetector.js';
import { CONFIG } from '../config.js';

/**
 * DrawingSystem - Manages stroke input and shape detection
 */
export class DrawingSystem {
  constructor(scene) {
    this.scene = scene;
    this.isDrawing = false;
    this.currentStroke = []; // Array of {x, y} points
    this.graphics = scene.add.graphics();
    this.graphics.clear();
    this.previewGraphics = scene.add.graphics(); // For attack mode preview

    this.initializeInput();
  }

  initializeInput() {
    this.scene.input.on('pointerdown', (pointer) => {
      this.startStroke(pointer);
    });

    this.scene.input.on('pointermove', (pointer) => {
      this.continueStroke(pointer);
    });

    this.scene.input.on('pointerup', (pointer) => {
      this.endStroke(pointer);
    });

    this.scene.input.on('pointerupoutside', (pointer) => {
      this.endStroke(pointer);
    });

    this.scene.input.on('pointerout', (pointer) => {
      this.cancelStroke();
    });
  }

  startStroke(pointer) {
    this.isDrawing = true;
    this.currentStroke = [{ x: pointer.x, y: pointer.y }];
    this.graphics.clear();
    this.previewGraphics.clear();

    // Check if mousedown is on a weapon - auto enable attack mode
    if (this.scene.unitManager) {
      const currentPlayer = this.scene.gameStateManager.currentPlayer;
      const playerWeapons = this.scene.unitManager.getWeaponsForPlayer(currentPlayer);

      for (const weapon of playerWeapons) {
        const bounds = weapon.getBounds();
        if (
          pointer.x >= bounds.minX &&
          pointer.x <= bounds.maxX &&
          pointer.y >= bounds.minY &&
          pointer.y <= bounds.maxY
        ) {
          this.scene.attackMode = true;
          break;
        }
      }
    }
  }

  continueStroke(pointer) {
    if (!this.isDrawing) return;

    this.currentStroke.push({ x: pointer.x, y: pointer.y });
    this.redrawStroke();
  }

  endStroke(pointer) {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    const shapeInfo = ShapeDetector.analyzeStroke(this.currentStroke);

    console.log(`Detected: ${shapeInfo.type || 'NONE'}`);

    if (this.scene.attackMode || shapeInfo.type) {
      this.scene.onStrokeComplete(shapeInfo, this.currentStroke);
    }

    this.graphics.clear();
    this.previewGraphics.clear();
    this.currentStroke = [];
  }

  cancelStroke() {
    if (!this.isDrawing) return;

    this.isDrawing = false;
    this.graphics.clear();
    this.previewGraphics.clear();
    this.currentStroke = [];
  }

  redrawStroke() {
    if (this.scene.attackMode) {
      this.graphics.clear();
      if (this.currentStroke.length >= 2) {
        this.showAttackPreview();
      }
      return;
    }

    this.graphics.clear();
    if (this.currentStroke.length > 1) {
      this.drawPencilLine(this.graphics, this.currentStroke, CONFIG.STROKE_COLOR, CONFIG.STROKE_WIDTH);
    }
  }

  /**
   * Draw a pencil-style line with slight jitter and layered strokes
   * for a hand-drawn, noisy paper look
   */
  drawPencilLine(g, points, color, baseWidth) {
    if (points.length < 2) return;

    // Layer 1: wide, very transparent base (smudge)
    this._drawJitteredPath(g, points, color, baseWidth + 1, 0.6, 0.12);
    // Layer 2: mid opacity with jitter
    this._drawJitteredPath(g, points, color, baseWidth, 0.8, 0.55);
    // Layer 3: fine crisp top stroke, minimal jitter
    this._drawJitteredPath(g, points, color, Math.max(1, baseWidth - 1), 0.3, 0.85);
  }

  /**
   * Internal: draw a jittered version of the point path
   * @param {number} jitter  max pixel offset per point
   * @param {number} alpha   line alpha
   */
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
   * Show real-time attack preview in attack mode (pencil style)
   */
  showAttackPreview() {
    if (!this.scene.combatSystem || this.currentStroke.length < 2) return;

    this.previewGraphics.clear();

    const startPoint = this.currentStroke[0];
    const endPoint = this.currentStroke[this.currentStroke.length - 1];

    const hitResult = this.scene.combatSystem.raycastSystem.castRay(
      startPoint.x,
      startPoint.y,
      endPoint.x,
      endPoint.y,
      this.scene.gameStateManager.currentPlayer
    );

    const color = hitResult.hitTarget ? 0x228822 : 0xaa2222;
    const linePoints = [startPoint, endPoint];

    // Pencil-style preview line
    this.drawPencilLine(this.previewGraphics, linePoints, color, 2);

    // Start dot
    this.previewGraphics.fillStyle(color, 0.8);
    this.previewGraphics.fillCircle(startPoint.x, startPoint.y, 4);
  }

  /**
   * Clear all visual strokes
   */
  clear() {
    this.graphics.clear();
    this.previewGraphics.clear();
  }

  /**
   * Draw a visual representation of a completed shape
   */
  drawShape(shapeInfo, color = 0x445533) {
    if (!shapeInfo.center) return;

    const g = this.scene.add.graphics();
    g.lineStyle(2, color, 1);

    switch (shapeInfo.type) {
      case 'line':
        g.beginPath();
        g.moveTo(0, shapeInfo.center.y);
        g.lineTo(CONFIG.CANVAS_WIDTH, shapeInfo.center.y);
        g.strokePath();
        break;

      case 'triangle': {
        const triSize = 15;
        g.fillStyle(color, 0.4);
        g.beginPath();
        g.moveTo(shapeInfo.center.x, shapeInfo.center.y - triSize);
        g.lineTo(shapeInfo.center.x + triSize, shapeInfo.center.y + triSize);
        g.lineTo(shapeInfo.center.x - triSize, shapeInfo.center.y + triSize);
        g.closePath();
        g.fillPath();
        break;
      }

      case 'circle':
        g.strokeCircle(shapeInfo.center.x, shapeInfo.center.y, 12);
        break;
    }

    this.scene.time.delayedCall(300, () => g.destroy());
  }

  /**
   * Get the current stroke length
   */
  getCurrentStrokeLength() {
    if (this.currentStroke.length < 2) return 0;

    let length = 0;
    for (let i = 1; i < this.currentStroke.length; i++) {
      const dx = this.currentStroke[i].x - this.currentStroke[i - 1].x;
      const dy = this.currentStroke[i].y - this.currentStroke[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  /**
   * Check if current stroke is valid (long enough)
   */
  isCurrentStrokeValid() {
    return this.getCurrentStrokeLength() >= CONFIG.MIN_STROKE_LENGTH;
  }
}
