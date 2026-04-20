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
  BASE_Y_OFFSET: 180,       // Distance from canvas edge to base center (matches bg image layout)
  SHIELD_BASE_Y_OFFSET: 195, // Shield center offset from canvas edge (5px inside from original base pos)
  BASE_SIZE: 64,            // Half of 128px sprite
  BASE_HP_MAX: 4,

  // base_UI strip — displayed at natural size; sits between canvas edge and base mech.
  BASE_UI_Y_EDGE: 63,        // y-center distance from canvas edge — midpoint between edge & mech
  // Letter cell centers expressed as fractions of the strip's display width (± from center).
  // B, A, S, E. Adjust if the image's letter layout differs from these fractions.
  BASE_UI_LETTER_RATIOS: [-0.288, -0.095, 0.097, 0.294],
  // X-mark size expressed as a fraction of the strip's display width / height.
  BASE_UI_CELL_W_RATIO: 0.119,
  BASE_UI_CELL_H_RATIO: 0.551, // 38px / 69px (cell occupies rows 19–57 of the 69px image)
  BASE_UI_CELL_Y_RATIO: 0.051, // cell centre is 3.5px below image centre (+3.5/69)

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
