import Phaser from 'phaser';
import { CONFIG, PLAYERS, GAME_STATES, UNIT_TYPES } from '../config.js';
import { DrawingSystem } from '../systems/DrawingSystem.js';
import { GameState } from '../systems/GameState.js';
import { UnitManager } from '../systems/UnitManager.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { FeedbackSystem } from '../systems/FeedbackSystem.js';
import { AISystem } from '../systems/AISystem.js';

// Import images as data URLs so vite-plugin-singlefile inlines them into HTML
import basePlayerUrl from '../images/base-player.webp';
import baseEnemyUrl from '../images/base-enemy.webp';
import planePlayerUrl from '../images/plane-player.webp';
import planeEnemyUrl from '../images/plane-enemy.webp';
import shieldUrl from '../images/shield.webp';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.gameStateManager = new GameState();
    this.attackMode = false;
    this.gameOverUI = null;
    this.isGameOver = false;
    this.enableAI = true;
    this.aiSystem = null;
    this.isAITurn = false;
    this.actionUsedThisTurn = false;
    // HP cell display objects (graphics + text), rebuilt on each updateUI
    this.hpCellsP1 = [];
    this.hpCellsP2 = [];
  }

  preload() {
    this.load.image('base-player', basePlayerUrl);
    this.load.image('base-enemy', baseEnemyUrl);
    this.load.image('plane-player', planePlayerUrl);
    this.load.image('plane-enemy', planeEnemyUrl);
    this.load.image('shield', shieldUrl);
  }

  create() {
    this.cameras.main.setBackgroundColor(CONFIG.BACKGROUND_COLOR);

    this.drawLayout();
    this.createUI();

    this.unitManager = new UnitManager(this);
    this.combatSystem = new CombatSystem(this, this.unitManager, this.gameStateManager);
    this.feedbackSystem = new FeedbackSystem(this);
    this.drawingSystem = new DrawingSystem(this);

    if (this.enableAI) {
      this.aiSystem = new AISystem(this.unitManager, this.combatSystem, this.gameStateManager);
      this.isAITurn = false;
    }

    // Hint text
    this.add.text(
      CONFIG.CANVAS_WIDTH / 2,
      CONFIG.CANVAS_HEIGHT / 2 + 30,
      '← 直線=護盾  三角=飛機  拖拉飛機=攻擊 →',
      { font: '13px Arial', fill: '#999988', align: 'center' }
    ).setOrigin(0.5);

    // Debug key: D damages current player base
    this.input.keyboard.on('keydown-D', () => {
      this.gameStateManager.damageBase(this.gameStateManager.currentPlayer);
      this.updateUI();
    });
  }

  drawLayout() {
    const graphics = this.add.graphics();

    // Divider
    graphics.lineStyle(2, CONFIG.DIVIDER_COLOR, 0.7);
    graphics.beginPath();
    graphics.moveTo(0, CONFIG.DIVIDER_Y);
    graphics.lineTo(CONFIG.CANVAS_WIDTH, CONFIG.DIVIDER_Y);
    graphics.strokePath();

    // Zone boundaries (subtle)
    graphics.lineStyle(1, CONFIG.ZONE_LINE_COLOR, 0.5);
    graphics.strokeRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.ENEMY_ZONE_HEIGHT);
    graphics.strokeRect(0, CONFIG.DIVIDER_Y, CONFIG.CANVAS_WIDTH, CONFIG.PLAYER_ZONE_HEIGHT);

    this.drawBases();
  }

  drawBases() {
    // Bases at 128×128 — BASE_Y_OFFSET=96 centres sprites within canvas

    // Player 1 (bottom)
    this.p1BaseSprite = this.add.image(
      CONFIG.CANVAS_WIDTH / 2,
      CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET,
      'base-player'
    );
    this.p1BaseSprite.setDisplaySize(128, 128);

    // Player 2 (top)
    this.p2BaseSprite = this.add.image(
      CONFIG.CANVAS_WIDTH / 2,
      CONFIG.BASE_Y_OFFSET,
      'base-enemy'
    );
    this.p2BaseSprite.setDisplaySize(128, 128);
  }

  /**
   * Draw B/A/S/E HP cells with pencil-style borders
   * Active cells are clear; destroyed cells are faded and crossed out
   */
  drawHPCells(playerNum, currentHP) {
    const cellList = playerNum === PLAYERS.PLAYER_1 ? this.hpCellsP1 : this.hpCellsP2;
    // Destroy previous objects
    for (const obj of cellList) obj.destroy();
    cellList.length = 0;

    const letters = ['B', 'A', 'S', 'E'];
    const cellW = 26;
    const cellH = 28;
    const gap = 4;
    const totalW = letters.length * (cellW + gap) - gap;
    const startX = CONFIG.CANVAS_WIDTH / 2 - totalW / 2;

    // HP cells hug the canvas edge:
    //   Player 1 (bottom): below the base sprite → near canvas bottom
    //   Player 2 (top): above the base sprite → near canvas top
    // BASE_Y_OFFSET=160, sprite half=128 → base bottom edge at canvas_h-32 (P1)
    // We place cells at canvas_h - 16 (P1) and 16 (P2)
    const cellCenterY = playerNum === PLAYERS.PLAYER_1
      ? CONFIG.CANVAS_HEIGHT - 16   // near bottom edge
      : 16;                          // near top edge

    for (let i = 0; i < letters.length; i++) {
      const cx = startX + i * (cellW + gap) + cellW / 2;
      const cy = cellCenterY;
      const alive = i < currentHP;

      // Pencil-border graphics
      const g = this.add.graphics();
      g.setDepth(5);
      this._drawPencilRect(
        g,
        cx - cellW / 2,
        cy - cellH / 2,
        cellW,
        cellH,
        alive ? 0x2a2a2a : 0xbbbbbb,
        alive ? 0.85 : 0.4
      );
      cellList.push(g);

      // Letter
      const t = this.add.text(cx, cy, letters[i], {
        font: `bold ${cellW - 6}px "Courier New", monospace`,
        fill: alive ? '#1a1a1a' : '#bbbbbb',
      });
      t.setOrigin(0.5);
      t.setDepth(6);
      cellList.push(t);

      // Strike-through for destroyed cells
      if (!alive) {
        const sg = this.add.graphics();
        sg.lineStyle(2, 0x993333, 0.7);
        sg.beginPath();
        sg.moveTo(cx - cellW / 2 + 2, cy - cellH / 2 + 2);
        sg.lineTo(cx + cellW / 2 - 2, cy + cellH / 2 - 2);
        sg.strokePath();
        sg.setDepth(7);
        cellList.push(sg);
      }
    }
  }

  /**
   * Pencil-style rectangle: 2 slightly offset jittered passes
   */
  _drawPencilRect(g, x, y, w, h, color, alpha) {
    for (let pass = 0; pass < 2; pass++) {
      const jx = (Math.random() - 0.5) * 1.2;
      const jy = (Math.random() - 0.5) * 1.2;
      g.lineStyle(pass === 0 ? 2 : 1.5, color, pass === 0 ? alpha * 0.5 : alpha);
      g.strokeRect(x + jx, y + jy, w, h);
    }
  }

  createUI() {
    // Current player indicator
    this.playerIndicator = this.add.text(
      10, 10,
      `Current Player: ${this.gameStateManager.currentPlayer}`,
      { font: '18px Arial', fill: CONFIG.TEXT_COLOR }
    );

    // Turn counter
    this.turnIndicator = this.add.text(
      10, 34,
      `Turn: ${this.gameStateManager.currentTurn}`,
      { font: '18px Arial', fill: CONFIG.TEXT_COLOR }
    );

    // Unit counts
    this.p1UnitsIndicator = this.add.text(
      CONFIG.CANVAS_WIDTH - 10,
      CONFIG.CANVAS_HEIGHT - 14,
      'P1 Units: 0S 0W',
      { font: '12px Arial', fill: '#446644' }
    ).setOrigin(1, 1);

    this.p2UnitsIndicator = this.add.text(
      CONFIG.CANVAS_WIDTH - 10,
      28,
      'P2 Units: 0S 0W',
      { font: '12px Arial', fill: '#664444' }
    ).setOrigin(1, 0);

    // Centre instruction
    this.add.text(
      CONFIG.CANVAS_WIDTH / 2,
      CONFIG.CANVAS_HEIGHT / 2,
      'Draw on the screen to place units or attack',
      { font: '15px Arial', fill: '#999988', align: 'center' }
    ).setOrigin(0.5);

    // Initial HP cells
    this.hpCellsP1 = [];
    this.hpCellsP2 = [];
    this.drawHPCells(PLAYERS.PLAYER_1, this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_1));
    this.drawHPCells(PLAYERS.PLAYER_2, this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_2));
  }

  /**
   * Called when a stroke is completed
   */
  onStrokeComplete(shapeInfo, stroke) {
    if (this.isGameOver || this.actionUsedThisTurn) return;

    const currentPlayer = this.gameStateManager.currentPlayer;

    if (this.attackMode) {
      if (stroke.length >= 2) {
        const startPoint = stroke[0];
        const endPoint = stroke[stroke.length - 1];
        this.drawingSystem.previewGraphics.clear();
        this.combatSystem.performAttack(currentPlayer, startPoint.x, startPoint.y, endPoint.x, endPoint.y);
        this.markActionUsed();
      }
      return;
    }

    if (!shapeInfo.type) return;

    const center = shapeInfo.center;
    let placed = false;

    switch (shapeInfo.type) {
      case 'line':
        placed = this.unitManager.placeShield(currentPlayer);
        if (placed) console.log(`Shield placed for ${currentPlayer}`);
        break;

      case 'triangle':
        placed = this.unitManager.placeWeapon(currentPlayer, center.x, center.y);
        if (placed) console.log(`Weapon placed for ${currentPlayer}`);
        break;

      case 'circle':
        console.log('Circle: reserved for special abilities');
        break;
    }

    this.drawingSystem.drawShape(shapeInfo);

    if (placed) {
      this.updateUnitDisplay();
      this.markActionUsed();
    }
  }

  markActionUsed() {
    this.actionUsedThisTurn = true;
    this.updateUI();

    this.time.delayedCall(800, () => {
      this.switchPlayer();
    });
  }

  switchPlayer() {
    this.gameStateManager.endTurn();
    this.actionUsedThisTurn = false;
    this.attackMode = false;
    this.updateUI();

    if (this.enableAI && this.gameStateManager.currentPlayer === PLAYERS.PLAYER_2) {
      this.isAITurn = true;
      this.input.enabled = false;
      this.drawingSystem.isDrawing = false;

      this.time.delayedCall(800, () => {
        if (this.aiSystem && !this.isGameOver) {
          this.aiSystem.executeTurn().then(() => {
            this.switchPlayer();
          });
        }
      });
    } else {
      this.isAITurn = false;
      this.input.enabled = true;
    }
  }

  updateUI() {
    const playerText = this.isAITurn ? 'AI (Player 2)' : `Player ${this.gameStateManager.currentPlayer}`;
    this.playerIndicator.setText(`Current Player: ${playerText}`);
    this.turnIndicator.setText(`Turn: ${this.gameStateManager.currentTurn}`);

    // Redraw HP cells to reflect current HP
    this.drawHPCells(PLAYERS.PLAYER_1, this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_1));
    this.drawHPCells(PLAYERS.PLAYER_2, this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_2));

    this.updateUnitDisplay();

    if (this.gameStateManager.isGameOver()) {
      this.showGameOver();
    }
  }

  updateUnitDisplay() {
    const p1Shields = this.unitManager.getShieldsForPlayer(PLAYERS.PLAYER_1).length;
    const p1Weapons = this.unitManager.getWeaponsForPlayer(PLAYERS.PLAYER_1).length;
    const p2Shields = this.unitManager.getShieldsForPlayer(PLAYERS.PLAYER_2).length;
    const p2Weapons = this.unitManager.getWeaponsForPlayer(PLAYERS.PLAYER_2).length;

    this.p1UnitsIndicator.setText(`P1 Units: ${p1Shields}S ${p1Weapons}W`);
    this.p2UnitsIndicator.setText(`P2 Units: ${p2Shields}S ${p2Weapons}W`);
  }

  showGameOver() {
    if (this.isGameOver) return;

    this.isGameOver = true;

    const overlay = this.add.rectangle(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2,
      CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT,
      0x000000, 0.65
    );
    overlay.setDepth(100);

    const winner = this.gameStateManager.getWinner();
    const winnerText = winner === PLAYERS.PLAYER_1 ? 'Player 1' : 'Player 2';
    const winnerColor = winner === PLAYERS.PLAYER_1 ? '#44cc44' : '#cc4444';

    const title = this.add.text(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 60,
      `${winnerText} Wins!`,
      { font: 'bold 48px Arial', fill: winnerColor, align: 'center' }
    );
    title.setOrigin(0.5);
    title.setDepth(101);

    const message = this.add.text(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2,
      'Game Over',
      { font: '32px Arial', fill: '#ffffff', align: 'center' }
    );
    message.setOrigin(0.5);
    message.setDepth(101);

    const buttonBg = this.add.rectangle(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 80,
      200, 50, 0x4444ff
    );
    buttonBg.setDepth(101);
    buttonBg.setInteractive({ useHandCursor: true });

    const buttonText = this.add.text(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 80,
      'Restart Game',
      { font: '20px Arial', fill: '#ffffff', align: 'center' }
    );
    buttonText.setOrigin(0.5);
    buttonText.setDepth(102);

    buttonBg.on('pointerover', () => buttonBg.setFillStyle(0x6666ff));
    buttonBg.on('pointerout', () => buttonBg.setFillStyle(0x4444ff));
    buttonBg.on('pointerdown', () => this.restartGame());

    this.gameOverUI = { overlay, title, message, buttonBg, buttonText };
  }

  restartGame() {
    this.gameStateManager.reset();
    this.unitManager.clear();
    this.isGameOver = false;
    this.attackMode = false;
    this.isAITurn = false;
    this.input.enabled = true;
    this.scene.restart();
  }

  update() {
    // Game loop
  }
}
