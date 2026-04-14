import Phaser from 'phaser';
import { CONFIG, PLAYERS, GAME_STATES, UNIT_TYPES } from '../config.js';
import { DrawingSystem } from '../systems/DrawingSystem.js';
import { GameState } from '../systems/GameState.js';
import { UnitManager } from '../systems/UnitManager.js';
import { CombatSystem } from '../systems/CombatSystem.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.gameStateManager = new GameState();
    this.attackMode = false;
  }

  create() {
    // Set background color
    this.cameras.main.setBackgroundColor(CONFIG.BACKGROUND_COLOR);

    // Draw game layout
    this.drawLayout();

    // Create UI
    this.createUI();

    // Initialize unit manager
    this.unitManager = new UnitManager(this);

    // Initialize combat system
    this.combatSystem = new CombatSystem(this, this.unitManager, this.gameStateManager);

    // Initialize drawing system
    this.drawingSystem = new DrawingSystem(this);

    // Test instructions
    this.add.text(
      CONFIG.CANVAS_WIDTH / 2,
      CONFIG.CANVAS_HEIGHT / 2 + 30,
      '← Try drawing: lines, triangles, circles →',
      {
        font: '14px Arial',
        fill: '#cccccc',
        align: 'center',
      }
    ).setOrigin(0.5);

    // Test keyboard: spacebar to switch turns
    this.input.keyboard.on('keydown-SPACE', () => {
      this.switchPlayer();
    });

    // Test keyboard: D to damage current player's base
    this.input.keyboard.on('keydown-D', () => {
      this.gameStateManager.damageBase(this.gameStateManager.currentPlayer);
      this.updateUI();
    });

    // Test keyboard: A to toggle attack mode
    this.input.keyboard.on('keydown-A', () => {
      this.attackMode = !this.attackMode;
      console.log(`Attack Mode: ${this.attackMode ? 'ON' : 'OFF'}`);
    });
  }

  drawLayout() {
    const graphics = this.add.graphics();

    // Draw dividing line
    graphics.lineStyle(2, CONFIG.DIVIDER_COLOR);
    graphics.beginPath();
    graphics.moveTo(0, CONFIG.DIVIDER_Y);
    graphics.lineTo(CONFIG.CANVAS_WIDTH, CONFIG.DIVIDER_Y);
    graphics.strokePath();

    // Draw zone boundaries (optional visual guides)
    graphics.lineStyle(1, CONFIG.ZONE_LINE_COLOR);

    // Enemy zone outline
    graphics.strokeRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.ENEMY_ZONE_HEIGHT);

    // Player zone outline
    graphics.strokeRect(0, CONFIG.DIVIDER_Y, CONFIG.CANVAS_WIDTH, CONFIG.PLAYER_ZONE_HEIGHT);

    // Draw base HP nodes for both players
    this.drawBases(graphics);
  }

  drawBases(graphics) {
    const nodeSize = 20;
    const nodeSpacing = 10;
    const totalWidth = (nodeSize + nodeSpacing) * CONFIG.BASE_HP_MAX - nodeSpacing;

    // Player 1 base (bottom)
    const p1BaseX = (CONFIG.CANVAS_WIDTH - totalWidth) / 2;
    const p1BaseY = CONFIG.CANVAS_HEIGHT - CONFIG.BASE_Y_OFFSET;

    graphics.fillStyle(0x00ff00); // Green for player base
    for (let i = 0; i < this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_1); i++) {
      const x = p1BaseX + i * (nodeSize + nodeSpacing);
      graphics.fillRect(x, p1BaseY - nodeSize / 2, nodeSize, nodeSize);
    }

    // Player 2 base (top)
    const p2BaseX = (CONFIG.CANVAS_WIDTH - totalWidth) / 2;
    const p2BaseY = CONFIG.BASE_Y_OFFSET;

    graphics.fillStyle(0xff0000); // Red for enemy base
    for (let i = 0; i < this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_2); i++) {
      const x = p2BaseX + i * (nodeSize + nodeSpacing);
      graphics.fillRect(x, p2BaseY - nodeSize / 2, nodeSize, nodeSize);
    }
  }

  createUI() {
    // Current player indicator
    this.playerIndicator = this.add.text(
      10,
      10,
      `Current Player: ${this.gameStateManager.currentPlayer}`,
      {
        font: '20px Arial',
        fill: CONFIG.TEXT_COLOR,
      }
    );

    // Turn counter
    this.turnIndicator = this.add.text(
      10,
      40,
      `Turn: ${this.gameStateManager.currentTurn}`,
      {
        font: '20px Arial',
        fill: CONFIG.TEXT_COLOR,
      }
    );

    // Player 1 HP
    this.hp1Indicator = this.add.text(
      CONFIG.CANVAS_WIDTH - 150,
      CONFIG.CANVAS_HEIGHT - 50,
      `Player 1 HP: ${this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_1)}`,
      {
        font: '16px Arial',
        fill: '#00ff00',
      }
    );

    // Player 2 HP
    this.hp2Indicator = this.add.text(
      CONFIG.CANVAS_WIDTH - 150,
      10,
      `Player 2 HP: ${this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_2)}`,
      {
        font: '16px Arial',
        fill: '#ff0000',
      }
    );

    // Player 1 Units (shields + weapons)
    this.p1UnitsIndicator = this.add.text(
      CONFIG.CANVAS_WIDTH - 150,
      CONFIG.CANVAS_HEIGHT - 20,
      `P1 Units: 0S 0W`,
      {
        font: '12px Arial',
        fill: '#00ff00',
      }
    );

    // Player 2 Units (shields + weapons)
    this.p2UnitsIndicator = this.add.text(
      CONFIG.CANVAS_WIDTH - 150,
      40,
      `P2 Units: 0S 0W`,
      {
        font: '12px Arial',
        fill: '#ff0000',
      }
    );

    // Instructions
    this.add.text(
      CONFIG.CANVAS_WIDTH / 2,
      CONFIG.CANVAS_HEIGHT / 2,
      'Draw on the screen to place units or attack',
      {
        font: '16px Arial',
        fill: CONFIG.TEXT_COLOR,
        align: 'center',
      }
    ).setOrigin(0.5);
  }

  /**
   * Called when a stroke is completed and shape is recognized
   */
  onStrokeComplete(shapeInfo, stroke) {
    const currentPlayer = this.gameStateManager.currentPlayer;

    // In attack mode: perform attack from stroke start to end (no shape detection needed)
    if (this.attackMode) {
      if (stroke.length >= 2) {
        const startPoint = stroke[0];
        const endPoint = stroke[stroke.length - 1];
        // Clear drawing system preview before attack visualization
        this.drawingSystem.previewGraphics.clear();
        this.combatSystem.performAttack(currentPlayer, startPoint.x, startPoint.y, endPoint.x, endPoint.y);
        this.updateUI();
      }
      return;
    }

    // Normal mode requires shape detection
    if (!shapeInfo.type) return;

    const center = shapeInfo.center;

    // Normal mode: place units
    let placed = false;

    // Place unit based on shape type
    switch (shapeInfo.type) {
      case 'line':
        // Line → Shield (concentric around base)
        placed = this.unitManager.placeShield(currentPlayer);
        if (placed) {
          console.log(`Shield placed for ${currentPlayer}`);
        }
        break;

      case 'triangle':
        // Triangle → Weapon
        placed = this.unitManager.placeWeapon(currentPlayer, center.x, center.y);
        if (placed) {
          console.log(`Weapon placed for ${currentPlayer}`);
        }
        break;

      case 'circle':
        // Circle → Reserved for future abilities
        console.log('Circle: reserved for special abilities');
        break;
    }

    // Visual feedback - show a marker at the detection point
    this.drawingSystem.drawShape(shapeInfo);

    // Update UI to show unit counts
    if (placed) {
      this.updateUnitDisplay();
    }
  }

  switchPlayer() {
    this.gameStateManager.endTurn();
    this.updateUI();
  }

  updateUI() {
    this.playerIndicator.setText(`Current Player: ${this.gameStateManager.currentPlayer}`);
    this.turnIndicator.setText(`Turn: ${this.gameStateManager.currentTurn}`);
    this.hp1Indicator.setText(`Player 1 HP: ${this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_1)}`);
    this.hp2Indicator.setText(`Player 2 HP: ${this.gameStateManager.getPlayerHP(PLAYERS.PLAYER_2)}`);
    this.updateUnitDisplay();
  }

  updateUnitDisplay() {
    const p1Shields = this.unitManager.getShieldsForPlayer(PLAYERS.PLAYER_1).length;
    const p1Weapons = this.unitManager.getWeaponsForPlayer(PLAYERS.PLAYER_1).length;
    const p2Shields = this.unitManager.getShieldsForPlayer(PLAYERS.PLAYER_2).length;
    const p2Weapons = this.unitManager.getWeaponsForPlayer(PLAYERS.PLAYER_2).length;

    this.p1UnitsIndicator.setText(`P1 Units: ${p1Shields}S ${p1Weapons}W`);
    this.p2UnitsIndicator.setText(`P2 Units: ${p2Shields}S ${p2Weapons}W`);
  }

  update() {
    // Game loop - will be populated in later phases
  }
}
