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

    if (shapeInfo.type) {
      this.scene.onStrokeComplete(shapeInfo, this.currentStroke);
    }

    this.graphics.clear();
    this.currentStroke = [];
  }

  cancelStroke() {
    if (!this.isDrawing) return;

    this.isDrawing = false;
    this.graphics.clear();
    this.currentStroke = [];
  }

  redrawStroke() {
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
   * Clear all visual strokes
   */
  clear() {
    this.graphics.clear();
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
