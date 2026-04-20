import Phaser from 'phaser';
import { CONFIG, PLAYERS, GAME_STATES, UNIT_TYPES } from '../config.js';
import { DrawingSystem } from '../systems/DrawingSystem.js';
import { GameState } from '../systems/GameState.js';
import { UnitManager } from '../systems/UnitManager.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { FeedbackSystem } from '../systems/FeedbackSystem.js';
import { AISystem } from '../systems/AISystem.js';

// Images — imported so vite-plugin-singlefile inlines them as base64 data URLs
import bgUrl from '../images/bg.webp';
import buttonReplayUrl from '../images/button_replay.webp';

// SFX — imported as URLs so vite-plugin-singlefile inlines them as base64
import sfxAttackUrl       from '../sfx/attack.ogg';
import sfxScribbleUrl     from '../sfx/pencil-scribble.ogg';
import sfxShieldUrl       from '../sfx/shield.ogg';
import sfxDestroyUrl      from '../sfx/destroy.ogg';
import basePlayerUrl from '../images/base-player.webp';
import baseEnemyUrl from '../images/base-enemy.webp';
import baseUIUrl from '../images/base_UI.webp';
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
    // Track previous HP values to detect new damage for animation
    this.prevHP = { [1]: null, [2]: null };
  }

  preload() {
    this.load.image('bg', bgUrl);
    this.load.image('button-replay', buttonReplayUrl);

    // SFX
    this.load.audio('sfx-attack',   [sfxAttackUrl]);
    this.load.audio('sfx-scribble', [sfxScribbleUrl]);
    this.load.audio('sfx-shield',   [sfxShieldUrl]);
    this.load.audio('sfx-destroy',  [sfxDestroyUrl]);
    this.load.image('base-player', basePlayerUrl);
    this.load.image('base-enemy', baseEnemyUrl);
    this.load.image('base-ui', baseUIUrl);
    this.load.image('plane-player', planePlayerUrl);
    this.load.image('plane-enemy', planeEnemyUrl);
    this.load.image('shield', shieldUrl);
  }

  create() {
    this.drawLayout();
    this.createUI();

    this.unitManager = new UnitManager(this);
    this.combatSystem = new CombatSystem(this, this.unitManager, this.gameStateManager);
    this.feedbackSystem = new FeedbackSystem(this);
    this.drawingSystem = new DrawingSystem(this);

    if (this.enableAI) {
      // Difficulty escalation: first 2 games Easy, 3rd game onward Hard.
      // No UI, no reminder — just quietly harder.
      const gamesPlayed = parseInt(localStorage.getItem('dmw_games_played') || '0', 10);
      const difficulty = gamesPlayed >= 2 ? 'hard' : 'easy';
      this.aiSystem = new AISystem(
        this.unitManager, this.combatSystem, this.gameStateManager, difficulty
      );
      this.isAITurn = false;
      console.log(`AI difficulty: ${difficulty} (games played: ${gamesPlayed})`);
    }

    // Debug: D key damages current player's base
    this.input.keyboard.on('keydown-D', () => {
      this.gameStateManager.damageBase(this.gameStateManager.currentPlayer);
      this.updateUI();
    });

    // Show YOUR TURN on game start
    this.time.delayedCall(300, () => this.showTurnNotification(true));
  }

  drawLayout() {
    // Background image — stretched to fill the canvas, drawn at depth 0
    const bg = this.add.image(CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2, 'bg');
    bg.setDisplaySize(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    bg.setDepth(0);

    this.drawBases();
  }

  drawBases() {
    const cx = CONFIG.CANVAS_WIDTH / 2;

    // ── Base mech sprites ───────────────────────────────────────────────────
    // Scale to target width (128px) while preserving the texture's natural aspect ratio.
    // This avoids distortion if the source image isn't perfectly square.

    // Player 1 (bottom)
    this.p1BaseSprite = this.add.image(
      cx, CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET, 'base-player'
    );
    this.p1BaseSprite.setScale(128 / this.p1BaseSprite.width);
    this.p1BaseSprite.setDepth(1);

    // Player 2 (top)
    this.p2BaseSprite = this.add.image(
      cx, CONFIG.BASE_Y_OFFSET, 'base-enemy'
    );
    this.p2BaseSprite.setScale(128 / this.p2BaseSprite.width);
    this.p2BaseSprite.setDepth(1);

    // ── BASE UI strips ──────────────────────────────────────────────────────
    // Use the image's natural size (no scale) — sits between canvas edge and base mech.
    const yEdge = CONFIG.BASE_UI_Y_EDGE;

    // Player 1 strip (bottom edge)
    this.p1BaseUI = this.add.image(cx, CONFIG.CANVAS_HEIGHT - yEdge, 'base-ui');
    this.p1BaseUI.setDepth(12);

    // Player 2 strip (top edge) — same image, same orientation
    this.p2BaseUI = this.add.image(cx, yEdge, 'base-ui');
    this.p2BaseUI.setDepth(12);
  }

  /**
   * Draw red X marks on the base_UI strip for depleted HP cells.
   * Letters B/A/S/E are part of base_UI.webp — we only overlay the X lines.
   * HP depletes from B first (index 0), then A (1), S (2), E (3).
   * newlyDeadIndex: if >= 0, that cell's X is animated (just-damaged).
   */
  drawHPCells(playerNum, currentHP, newlyDeadIndex = -1) {
    const cellList = playerNum === PLAYERS.PLAYER_1 ? this.hpCellsP1 : this.hpCellsP2;
    for (const obj of cellList) obj.destroy();
    cellList.length = 0;

    // Derive letter X positions and X-mark cell size from the sprite's actual display size
    const uiSprite = playerNum === PLAYERS.PLAYER_1 ? this.p1BaseUI : this.p2BaseUI;
    if (!uiSprite) return;

    const uiW = uiSprite.displayWidth;
    const uiH = uiSprite.displayHeight;
    const cx  = CONFIG.CANVAS_WIDTH / 2;

    const letterXs = CONFIG.BASE_UI_LETTER_RATIOS.map(r => cx + r * uiW);
    const cellW    = uiW * CONFIG.BASE_UI_CELL_W_RATIO;
    const cellH    = uiH * CONFIG.BASE_UI_CELL_H_RATIO;

    // Y center of the letter cells — image centre + small downward offset
    const cy = uiSprite.y + uiH * CONFIG.BASE_UI_CELL_Y_RATIO;

    // deadCount: how many cells are crossed (B first → index 0)
    const deadCount = CONFIG.BASE_HP_MAX - currentHP;

    for (let i = 0; i < letterXs.length; i++) {
      if (i >= deadCount) continue; // cell still alive — no mark

      const cx = letterXs[i];

      if (i === newlyDeadIndex && this.feedbackSystem) {
        // Animated pencil X drawn progressively
        const sg = this.feedbackSystem.animateHPStrike(cx, cy, cellW, cellH);
        cellList.push(sg);
      } else {
        // Static pencil X for already-dead cells
        const sg = this.add.graphics();
        sg.setDepth(15);
        for (let pass = 0; pass < 3; pass++) {
          const jx = (Math.random() - 0.5) * 2;
          const jy = (Math.random() - 0.5) * 2;
          const a  = pass === 0 ? 0.25 : pass === 1 ? 0.6 : 0.92;
          const w  = pass === 0 ? 3.5  : pass === 1 ? 2.5 : 1.8;
          sg.lineStyle(w, 0xaa1111, a);
          sg.beginPath();
          sg.moveTo(cx - cellW / 2 + 9 + jx, cy - cellH / 2 + 9 + jy);
          sg.lineTo(cx + cellW / 2 - 9 + jx, cy + cellH / 2 - 9 + jy);
          sg.strokePath();
        }
        cellList.push(sg);
      }
    }
  }

  createUI() {
    // Turn counter (top-left, rudiment font)
    this.turnIndicator = this.add.text(
      10, 10,
      `Turn: ${this.gameStateManager.currentTurn}`,
      {
        fontFamily: FONT_TITLE,
        fontSize: '22px',
        color: CONFIG.TEXT_COLOR,
        stroke: '#f5f0e8',   // same as BACKGROUND_COLOR in CSS hex
        strokeThickness: 4,
      }
    );

    // Initial HP cells (no animation on first draw)
    this.hpCellsP1 = [];
    this.hpCellsP2 = [];
    const initHP1 = this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_1);
    const initHP2 = this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_2);
    this.prevHP[PLAYERS.PLAYER_1] = initHP1;
    this.prevHP[PLAYERS.PLAYER_2] = initHP2;
    this.drawHPCells(PLAYERS.PLAYER_1, initHP1);
    this.drawHPCells(PLAYERS.PLAYER_2, initHP2);
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
      {
        fontFamily: FONT_TITLE,
        fontSize: '52px',
        color,
        align: 'center',
        stroke: '#f5f0e8',
        strokeThickness: 6,
      }
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
        // Lock input immediately; call markActionUsed after animation finishes
        this.actionUsedThisTurn = true;
        this.combatSystem.performAttack(
          currentPlayer, startPoint.x, startPoint.y, endPoint.x, endPoint.y
        ).then(() => {
          this.markActionUsed();
        });
      }
      return;
    }

    if (!shapeInfo.type) return;

    const center = shapeInfo.center;
    let placed = false;

    switch (shapeInfo.type) {
      case 'line': {
        const shieldResult = this.unitManager.placeShield(currentPlayer);
        placed = shieldResult === 'ok' || shieldResult === true;
        if (!placed && this.feedbackSystem) {
          this.feedbackSystem.showPlacementError(center.x, center.y, shieldResult);
        }
        break;
      }
      case 'triangle': {
        const weaponResult = this.unitManager.placeWeapon(currentPlayer, center.x, center.y);
        placed = weaponResult === 'ok' || weaponResult === true;
        if (!placed && this.feedbackSystem) {
          this.feedbackSystem.showPlacementError(center.x, center.y, weaponResult);
        }
        break;
      }

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

    const hp1 = this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_1);
    const hp2 = this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_2);

    // Detect newly-crossed cell index (B=0, A=1, S=2, E=3); -1 = no change
    const newDead1 = (this.prevHP[1] !== null && hp1 < this.prevHP[1])
      ? CONFIG.BASE_HP_MAX - hp1 - 1  // index of newly crossed cell
      : -1;
    const newDead2 = (this.prevHP[2] !== null && hp2 < this.prevHP[2])
      ? CONFIG.BASE_HP_MAX - hp2 - 1
      : -1;

    this.prevHP[1] = hp1;
    this.prevHP[2] = hp2;

    this.drawHPCells(PLAYERS.PLAYER_1, hp1, newDead1);
    this.drawHPCells(PLAYERS.PLAYER_2, hp2, newDead2);

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
    const playerWon = winner === PLAYERS.PLAYER_1;
    const resultText = playerWon ? 'YOU WIN' : 'YOU LOSS';
    const resultColor = playerWon ? '#44cc44' : '#cc4444';
    const turns = this.gameStateManager.currentTurn;

    // --- localStorage tracking ---
    // Increment games played
    const gamesPlayed = parseInt(localStorage.getItem('dmw_games_played') || '0', 10) + 1;
    localStorage.setItem('dmw_games_played', String(gamesPlayed));

    // Track best (fewest turns to win). Only updates on wins.
    let isNewBest = false;
    let bestTurns = parseInt(localStorage.getItem('dmw_best_turns') || '0', 10);
    if (playerWon) {
      if (bestTurns === 0 || turns < bestTurns) {
        bestTurns = turns;
        localStorage.setItem('dmw_best_turns', String(turns));
        isNewBest = true;
      }
    }

    const title = this.add.text(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 3,
      resultText,
      { fontFamily: FONT_TITLE, fontSize: '72px', color: resultColor, align: 'center' }
    );
    title.setOrigin(0.5);
    title.setDepth(101);

    // Turn counter line — below the title
    const turnLine = playerWon
      ? `Cleared in ${turns} turn${turns === 1 ? '' : 's'}`
      : `Survived ${turns} turn${turns === 1 ? '' : 's'}`;
    const turnText = this.add.text(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 3 + 58,
      turnLine,
      { fontFamily: FONT_TITLE, fontSize: '26px', color: '#f5f0e8',
        stroke: '#222', strokeThickness: 3, align: 'center' }
    );
    turnText.setOrigin(0.5);
    turnText.setDepth(101);

    // Guidance / best-record line
    let guidance;
    if (playerWon && isNewBest && gamesPlayed > 1) {
      guidance = 'NEW BEST! Can you go lower?';
    } else if (playerWon && bestTurns > 0 && !isNewBest) {
      guidance = `Best: ${bestTurns} turns — beat it!`;
    } else if (playerWon) {
      guidance = 'Try again — can you do it faster?';
    } else {
      guidance = "Don't give up — try again!";
    }
    const guideColor = (playerWon && isNewBest && gamesPlayed > 1) ? '#ffcc33' : '#f5f0e8';
    const guideText = this.add.text(
      CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 3 + 96,
      guidance,
      { fontFamily: FONT_BODY, fontSize: '20px', color: guideColor,
        stroke: '#222', strokeThickness: 2, align: 'center' }
    );
    guideText.setOrigin(0.5);
    guideText.setDepth(101);

    // Restart button — uses button_replay.webp at natural size
    const replayBtn = this.add.image(
      CONFIG.CANVAS_WIDTH / 2, (CONFIG.CANVAS_HEIGHT / 3) * 2,
      'button-replay'
    );
    replayBtn.setDepth(101);
    replayBtn.setInteractive({ useHandCursor: true });

    replayBtn.on('pointerover', () => replayBtn.setAlpha(0.8));
    replayBtn.on('pointerout',  () => replayBtn.setAlpha(1));
    replayBtn.on('pointerdown', () => this.restartGame());

    this.gameOverUI = { overlay, title, turnText, guideText, replayBtn };
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
