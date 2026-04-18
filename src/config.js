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
  BACKGROUND_COLOR: 0xf5f0e8,  // Paper color
  DIVIDER_COLOR: 0x888888,
  TEXT_COLOR: '#2a2a2a',        // Dark ink
  ZONE_LINE_COLOR: 0xccbbaa,

  // Base
  BASE_Y_OFFSET: 96, // Distance from canvas edge to base center (64 for half of 128px sprite + 32 margin)
  BASE_SIZE: 64,     // Half of 128px sprite
  BASE_HP_MAX: 4,

  // Units
  SHIELD_MAX: 3,
  SHIELD_HEIGHT: 8,
  WEAPON_RADIUS: 12,

  // Drawing
  STROKE_WIDTH: 3,
  STROKE_COLOR: 0x2a2a2a,  // Dark pencil color
  MIN_STROKE_LENGTH: 20,   // Minimum distance to count as valid stroke

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
