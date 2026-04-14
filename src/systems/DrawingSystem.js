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

    // In attack mode, always fire onStrokeComplete (no shape detection needed)
    // In normal mode, only fire if a shape was recognized
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
    // In attack mode, only show attack preview, not the regular stroke
    if (this.scene.attackMode) {
      this.graphics.clear();
      if (this.currentStroke.length >= 2) {
        this.showAttackPreview();
      }
      return;
    }

    // Normal mode: show regular stroke
    this.graphics.clear();
    this.graphics.lineStyle(CONFIG.STROKE_WIDTH, CONFIG.STROKE_COLOR, 1);
    this.graphics.beginPath();

    if (this.currentStroke.length > 0) {
      this.graphics.moveTo(this.currentStroke[0].x, this.currentStroke[0].y);

      for (let i = 1; i < this.currentStroke.length; i++) {
        this.graphics.lineTo(this.currentStroke[i].x, this.currentStroke[i].y);
      }

      this.graphics.strokePath();
    }
  }

  /**
   * Show real-time attack preview in attack mode
   */
  showAttackPreview() {
    if (!this.scene.combatSystem || this.currentStroke.length < 2) return;

    this.previewGraphics.clear();

    const startPoint = this.currentStroke[0];
    const endPoint = this.currentStroke[this.currentStroke.length - 1];

    // Cast ray to check what we'd hit
    const hitResult = this.scene.combatSystem.raycastSystem.castRay(
      startPoint.x,
      startPoint.y,
      endPoint.x,
      endPoint.y,
      this.scene.gameStateManager.currentPlayer
    );

    // Choose color based on hit result
    let color;
    if (hitResult.hitTarget) {
      color = 0xffff00; // Yellow for successful hit
    } else {
      color = 0xff6666; // Red for miss
    }

    // Draw attack preview line
    this.previewGraphics.lineStyle(2, color, 1);
    this.previewGraphics.beginPath();
    this.previewGraphics.moveTo(startPoint.x, startPoint.y);
    this.previewGraphics.lineTo(endPoint.x, endPoint.y);
    this.previewGraphics.strokePath();

    // Draw start point
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
  drawShape(shapeInfo, color = 0xffa500) {
    if (!shapeInfo.center) return;

    const g = this.scene.add.graphics();
    g.lineStyle(2, color, 1);

    switch (shapeInfo.type) {
      case 'line':
        // Draw a horizontal line at the center point
        g.beginPath();
        g.moveTo(0, shapeInfo.center.y);
        g.lineTo(CONFIG.CANVAS_WIDTH, shapeInfo.center.y);
        g.strokePath();
        break;

      case 'triangle':
        // Draw a small triangle marker
        const triSize = 15;
        g.fillStyle(color, 0.5);
        g.beginPath();
        g.moveTo(shapeInfo.center.x, shapeInfo.center.y - triSize);
        g.lineTo(shapeInfo.center.x + triSize, shapeInfo.center.y + triSize);
        g.lineTo(shapeInfo.center.x - triSize, shapeInfo.center.y + triSize);
        g.closePath();
        g.fillPath();
        break;

      case 'circle':
        // Draw a circle marker
        g.strokeCircle(shapeInfo.center.x, shapeInfo.center.y, 12);
        break;
    }

    // Auto-remove after short delay for visual feedback
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
