import { PLAYERS, GAME_STATES } from '../config.js';

/**
 * GameState - Central game state management
 * Tracks turn, players, HP, and game phase
 */
export class GameState {
  constructor() {
    this.currentTurn = 1;
    this.currentPlayer = PLAYERS.PLAYER_1;
    this.gameState = GAME_STATES.WAITING;

    // Player states
    this.players = {
      [PLAYERS.PLAYER_1]: {
        hp: 4,
        shields: [],
        weapons: [],
        zone: 'bottom',
      },
      [PLAYERS.PLAYER_2]: {
        hp: 4,
        shields: [],
        weapons: [],
        zone: 'top',
      },
    };
  }

  /**
   * End current turn and switch to next player
   */
  endTurn() {
    this.currentPlayer = this.currentPlayer === PLAYERS.PLAYER_1
      ? PLAYERS.PLAYER_2
      : PLAYERS.PLAYER_1;

    if (this.currentPlayer === PLAYERS.PLAYER_1) {
      this.currentTurn++;
    }

    this.gameState = GAME_STATES.WAITING;
  }

  /**
   * Check if game is over
   */
  isGameOver() {
    const p1HP = this.players[PLAYERS.PLAYER_1].hp;
    const p2HP = this.players[PLAYERS.PLAYER_2].hp;
    return p1HP <= 0 || p2HP <= 0;
  }

  /**
   * Get the winner (or null if game not over)
   */
  getWinner() {
    if (!this.isGameOver()) return null;

    const p1HP = this.players[PLAYERS.PLAYER_1].hp;
    const p2HP = this.players[PLAYERS.PLAYER_2].hp;

    if (p1HP > 0) return PLAYERS.PLAYER_1;
    if (p2HP > 0) return PLAYERS.PLAYER_2;
    return null;
  }

  /**
   * Reduce player HP by 1 (when base is hit)
   */
  damageBase(playerNum) {
    if (this.players[playerNum]) {
      this.players[playerNum].hp = Math.max(0, this.players[playerNum].hp - 1);
    }
  }

  /**
   * Add shield to player
   */
  addShield(playerNum, shield) {
    if (this.players[playerNum]) {
      this.players[playerNum].shields.push(shield);
    }
  }

  /**
   * Remove shield from player
   */
  removeShield(playerNum, shield) {
    if (this.players[playerNum]) {
      const idx = this.players[playerNum].shields.indexOf(shield);
      if (idx >= 0) {
        this.players[playerNum].shields.splice(idx, 1);
      }
    }
  }

  /**
   * Add weapon to player
   */
  addWeapon(playerNum, weapon) {
    if (this.players[playerNum]) {
      this.players[playerNum].weapons.push(weapon);
    }
  }

  /**
   * Remove weapon from player
   */
  removeWeapon(playerNum, weapon) {
    if (this.players[playerNum]) {
      const idx = this.players[playerNum].weapons.indexOf(weapon);
      if (idx >= 0) {
        this.players[playerNum].weapons.splice(idx, 1);
      }
    }
  }

  /**
   * Get current player data
   */
  getCurrentPlayer() {
    return this.players[this.currentPlayer];
  }

  /**
   * Get opponent player data
   */
  getOpponent() {
    const opponentNum = this.currentPlayer === PLAYERS.PLAYER_1
      ? PLAYERS.PLAYER_2
      : PLAYERS.PLAYER_1;
    return this.players[opponentNum];
  }

  /**
   * Get player HP
   */
  getPlayerHP(playerNum) {
    return this.players[playerNum]?.hp || 0;
  }

  /**
   * Get shield count for player
   */
  getShieldCount(playerNum) {
    return this.players[playerNum]?.shields.length || 0;
  }

  /**
   * Get weapon count for player
   */
  getWeaponCount(playerNum) {
    return this.players[playerNum]?.weapons.length || 0;
  }

  /**
   * Reset game state
   */
  reset() {
    this.currentTurn = 1;
    this.currentPlayer = PLAYERS.PLAYER_1;
    this.gameState = GAME_STATES.WAITING;

    this.players[PLAYERS.PLAYER_1] = {
      hp: 4,
      shields: [],
      weapons: [],
      zone: 'bottom',
    };

    this.players[PLAYERS.PLAYER_2] = {
      hp: 4,
      shields: [],
      weapons: [],
      zone: 'top',
    };
  }
}
