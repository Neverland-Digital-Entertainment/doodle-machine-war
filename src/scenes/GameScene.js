import Phaser from 'phaser';
import { CONFIG, PLAYERS, GAME_STATES, UNIT_TYPES } from '../config.js';
import { DrawingSystem } from '../systems/DrawingSystem.js';
import { GameState } from '../systems/GameState.js';
import { UnitManager } from '../systems/UnitManager.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { FeedbackSystem } from '../systems/FeedbackSystem.js';
import { AISystem } from '../systems/AISystem.js';

// Images — imported so vite-plugin-singlefile inlines them as base64 data URLs
import basePlayerUrl from '../images/base-player.webp';
import baseEnemyUrl from '../images/base-enemy.webp';
import planePlayerUrl from '../images/plane-player.webp';
import planeEnemyUrl from '../images/plane-enemy.webp';
import shieldUrl from '../images/shield.webp';

// Font family names (loaded in main.js via FontFace API)
const FONT_BODY  = 'rudiment_medium';
const FONT_TITLE = 'sketch_block';

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
      'Line = Shield   Triangle = Plane   Drag plane = Attack',
      { fontFamily: FONT_BODY, fontSize: '13px', color: '#999988', align: 'center' }
    ).setOrigin(0.5);

    // Debug: D key damages current player's base
    this.input.keyboard.on('keydown-D', () => {
      this.gameStateManager.damageBase(this.gameStateManager.currentPlayer);
      this.updateUI();
    });

    // Show YOUR TURN on game start
    this.time.delayedCall(300, () => this.showTurnNotification(true));
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
   * Draw B/A/S/E HP cells with pencil-style borders.
   * HP depletes from B first: when HP=3, B is crossed; HP=2, B+A; etc.
   */
  drawHPCells(playerNum, currentHP) {
    const cellList = playerNum === PLAYERS.PLAYER_1 ? this.hpCellsP1 : this.hpCellsP2;
    for (const obj of cellList) obj.destroy();
    cellList.length = 0;

    const letters = ['B', 'A', 'S', 'E'];
    const cellW = 28;
    const cellH = 30;
    const gap = 5;
    const totalW = letters.length * (cellW + gap) - gap;
    const startX = CONFIG.CANVAS_WIDTH / 2 - totalW / 2;

    // Hug canvas edge — cells at very top/bottom
    const cy = playerNum === PLAYERS.PLAYER_1
      ? CONFIG.CANVAS_HEIGHT - 16
      : 16;

    // deadCount: how many cells are crossed (B first, then A, S, E)
    const deadCount = CONFIG.BASE_HP_MAX - currentHP;

    for (let i = 0; i < letters.length; i++) {
      const cx = startX + i * (cellW + gap) + cellW / 2;
      const alive = i >= deadCount; // cells 0..deadCount-1 are crossed, rest alive

      // Pencil border — depth 10+ ensures it sits above shields (depth 2) and bases (depth 0)
      const g = this.add.graphics();
      g.setDepth(10);
      this._drawPencilRect(
        g, cx - cellW / 2, cy - cellH / 2, cellW, cellH,
        alive ? 0x2a2a2a : 0x888888,
        alive ? 0.85 : 0.4
      );
      cellList.push(g);

      // Letter
      const t = this.add.text(cx, cy, letters[i], {
        fontFamily: FONT_BODY,
        fontSize: `${cellW - 6}px`,
        color: alive ? '#1a1a1a' : '#bbbbbb',
      });
      t.setOrigin(0.5);
      t.setDepth(11);
      cellList.push(t);

      // Pencil-style red X for destroyed cells
      if (!alive) {
        const sg = this.add.graphics();
        sg.setDepth(12);
        // 3-pass jitter for pencil feel
        for (let pass = 0; pass < 3; pass++) {
          const jx = (Math.random() - 0.5) * 1.8;
          const jy = (Math.random() - 0.5) * 1.8;
          const a = pass === 0 ? 0.25 : pass === 1 ? 0.6 : 0.9;
          const w = pass === 0 ? 3 : pass === 1 ? 2 : 1.5;
          sg.lineStyle(w, 0xaa1111, a);
          sg.beginPath();
          sg.moveTo(cx - cellW / 2 + 3 + jx, cy - cellH / 2 + 3 + jy);
          sg.lineTo(cx + cellW / 2 - 3 + jx, cy + cellH / 2 - 3 + jy);
          sg.strokePath();
        }
        cellList.push(sg);
      }
    }
  }

  /**
   * Pencil-style rectangle: 2 offset passes for a sketchy look
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
    // Turn counter (top-left, rudiment font)
    this.turnIndicator = this.add.text(
      10, 10,
      `Turn: ${this.gameStateManager.currentTurn}`,
      { fontFamily: FONT_BODY, fontSize: '18px', color: CONFIG.TEXT_COLOR }
    );

    // Centre instruction
    this.add.text(
      CONFIG.CANVAS_WIDTH / 2,
      CONFIG.CANVAS_HEIGHT / 2,
      'Draw on the screen to place units or attack',
      { fontFamily: FONT_BODY, fontSize: '14px', color: '#999988', align: 'center' }
    ).setOrigin(0.5);

    // Initial HP cells
    this.hpCellsP1 = [];
    this.hpCellsP2 = [];
    this.drawHPCells(PLAYERS.PLAYER_1, this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_1));
    this.drawHPCells(PLAYERS.PLAYER_2, this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_2));
  }

  /**
   * Flash a turn notification (YOUR TURN / ENEMY TURN) centred on screen.
   * Uses sketch_block font. Fades in then out automatically.
   */
  showTurnNotification(isYourTurn) {
    const label = isYourTurn ? 'YOUR TURN' : 'ENEMY TURN';
    const color = isYourTurn ? '#224499' : '#992222';

    const notif = this.add.text(
      CONFIG.CANVAS_WIDTH / 2,
      CONFIG.CANVAS_HEIGHT / 2,
      label,
      { fontFamily: FONT_TITLE, fontSize: '52px', color, align: 'center' }
    );
    notif.setOrigin(0.5);
    notif.setDepth(80);
    notif.setAlpha(0);

    // Fade in → hold → fade out
    this.tweens.add({
      targets: notif,
      alpha: { from: 0, to: 1 },
      duration: 250,
      yoyo: true,
      hold: 700,
      ease: 'Quad.easeInOut',
      onComplete: () => notif.destroy(),
    });
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

    // If showGameOver() was triggered inside updateUI(), stop here.
    // Any further turn logic (disabling input for AI) would break the restart button.
    if (this.isGameOver) return;

    if (this.enableAI && this.gameStateManager.currentPlayer === PLAYERS.PLAYER_2) {
      this.isAITurn = true;
      this.input.enabled = false;
      this.drawingSystem.isDrawing = false;

      // Show ENEMY TURN notification
      this.showTurnNotification(false);

      this.time.delayedCall(1200, () => {
        if (this.aiSystem && !this.isGameOver) {
          this.aiSystem.executeTurn().then(() => {
            this.switchPlayer();
          });
        }
      });
    } else {
      this.isAITurn = false;
      this.input.enabled = true;

      // Show YOUR TURN notification
      this.showTurnNotification(true);
    }
  }

  updateUI() {
    this.turnIndicator.setText(`Turn: ${this.gameStateManager.currentTurn}`);

    this.drawHPCells(PLAYERS.PLAYER_1, this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_1));
    this.drawHPCells(PLAYERS.PLAYER_2, this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_2));

    if (this.gameStateManager.isGameOver()) {
      this.showGameOver();
    }
  }

  showGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;

    // Re-enable input so the restart button is always clickable,
    // even if the game ended during the AI's turn (when input was disabled).
    this.input.enabled = true;

    const overlay = this.add.rectangle(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2,
      CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT,
      0x000000, 0.65
    );
    overlay.setDepth(100);

    // Player 1 (human) wins → YOU WIN; Player 2 (AI) wins → YOU LOSS
    const winner = this.gameStateManager.getWinner();
    const resultText = winner === PLAYERS.PLAYER_1 ? 'YOU WIN' : 'YOU LOSS';
    const resultColor = winner === PLAYERS.PLAYER_1 ? '#44cc44' : '#cc4444';

    const title = this.add.text(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 60,
      resultText,
      { fontFamily: FONT_TITLE, fontSize: '72px', color: resultColor, align: 'center' }
    );
    title.setOrigin(0.5);
    title.setDepth(101);

    // Restart button
    const buttonBg = this.add.rectangle(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 60,
      220, 54, 0x334488
    );
    buttonBg.setDepth(101);
    buttonBg.setInteractive({ useHandCursor: true });

    const buttonText = this.add.text(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 60,
      'RESTART',
      { fontFamily: FONT_TITLE, fontSize: '32px', color: '#ffffff', align: 'center' }
    );
    buttonText.setOrigin(0.5);
    buttonText.setDepth(102);

    buttonBg.on('pointerover', () => buttonBg.setFillStyle(0x5566bb));
    buttonBg.on('pointerout', () => buttonBg.setFillStyle(0x334488));
    buttonBg.on('pointerdown', () => this.restartGame());

    this.gameOverUI = { overlay, title, buttonBg, buttonText };
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
