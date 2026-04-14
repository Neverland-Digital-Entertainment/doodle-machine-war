// Game configuration constants
export const CONFIG = {
  // Canvas
  CANVAS_WIDTH: 512,
  CANVAS_HEIGHT: 896,

  // Layout
  DIVIDER_Y: 448, // Middle of canvas
  ENEMY_ZONE_HEIGHT: 448,
  PLAYER_ZONE_HEIGHT: 448,

  // Colors
  BACKGROUND_COLOR: 0x2a2a2a,
  DIVIDER_COLOR: 0xffffff,
  TEXT_COLOR: '#ffffff',
  ZONE_LINE_COLOR: 0x444444,

  // Base
  BASE_Y_OFFSET: 40, // Distance from bottom
  BASE_SIZE: 40,
  BASE_HP_MAX: 4,

  // Units
  SHIELD_MAX: 3,
  SHIELD_HEIGHT: 8,
  WEAPON_RADIUS: 12,

  // Drawing
  STROKE_WIDTH: 3,
  STROKE_COLOR: 0xffa500, // Orange
  MIN_STROKE_LENGTH: 20, // Minimum distance to count as valid stroke

  // Physics/Collision
  COLLISION_PADDING: 10,
};

// Game constants
export const GAME_STATES = {
  WAITING: 'waiting',
  DRAWING: 'drawing',
  ANIMATING: 'animating',
  GAME_OVER: 'game_over',
};

export const PLAYERS = {
  PLAYER_1: 1,
  PLAYER_2: 2,
};

export const UNIT_TYPES = {
  SHIELD: 'shield',
  FIGHTER: 'fighter',
  TURRET: 'turret',
};
