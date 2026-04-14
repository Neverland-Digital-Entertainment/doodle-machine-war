# Stage 0 — Project Scaffolding

## Goal

Get a blank Phaser scene rendering in the browser, with no asset loading and no
console errors.

## Inputs / Outputs

- **Inputs:** none — this stage starts from an empty repository.
- **Outputs:**
  - `index.html` (entry document)
  - `vendor/phaser.min.js` (local copy of Phaser 3, or a CDN `<script>` tag)
  - `src/main.js` (Phaser.Game config + scene registration)
  - `src/config.js` (constant placeholder; populated more in later stages)
  - `src/scenes/BootScene.js`
  - `src/scenes/GameScene.js`

## Data structures

```text
GameConfig {
  type:            Phaser.AUTO
  width:           720          // portrait
  height:          1280
  backgroundColor: '#101018'
  scale: {
    mode:    Phaser.Scale.FIT
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
  parent:  'game'               // matches <div id="game">
  scene:   [BootScene, GameScene]
}
```

## Pseudocode modules

### `index.html`

```text
DOCUMENT
  HEAD
    SET title = "Doodle Machine War"
    SET viewport = "width=device-width, initial-scale=1, user-scalable=no"
    INLINE STYLE:
      body { margin: 0; background: #000; }
      #game { width: 100vw; height: 100vh; }
  BODY
    DIV id="game"
    SCRIPT src="vendor/phaser.min.js"
    SCRIPT type="module" src="src/main.js"
END DOCUMENT
```

### `src/main.js`

```text
IMPORT BootScene FROM './scenes/BootScene.js'
IMPORT GameScene FROM './scenes/GameScene.js'

LET config = build GameConfig as defined in "Data structures"

ON window.load:
  new Phaser.Game(config)
```

### `src/config.js`

```text
// Stage 0 only seeds the constants the rest of the stages will fill in.
EXPORT const SCREEN = { width: 720, height: 1280 }
EXPORT const COLORS = {
  background: 0x101018
  // Stage 6 will add: highlightYellow, highlightRed
}
// Stage 3 will add: ZONES, BASE, SHIELD, WEAPON limits.
```

### `src/scenes/BootScene.js`

```text
CLASS BootScene EXTENDS Phaser.Scene
  CONSTRUCTOR:
    super({ key: 'BootScene' })

  FUNCTION preload():
    // No assets in MVP — everything is drawn with Graphics.

  FUNCTION create():
    this.scene.start('GameScene')
END CLASS
```

### `src/scenes/GameScene.js`

```text
CLASS GameScene EXTENDS Phaser.Scene
  CONSTRUCTOR:
    super({ key: 'GameScene' })

  FUNCTION create():
    // Stage 0 placeholder: nothing to draw yet.
    // Sanity check: log so we know the scene booted.
    LOG "GameScene ready"
    // Stage 1 will attach DrawingInput here.
    // Stage 3 will spawn the battlefield here.
    // Stage 4 will instantiate TurnManager here.

  FUNCTION update(time, delta):
    // No per-frame work yet.
END CLASS
```

## Integration notes

- This stage establishes the **scene graph contract** every later stage relies
  on: `BootScene` boots → `GameScene` is the live scene.
- `src/config.js` is created intentionally bare so Stage 3 can extend it
  without touching scene code.
- No `import` statements should reference Phaser as a module — Phaser is loaded
  globally via the `<script>` tag in `index.html`. Inside `main.js` and the
  scene files, refer to it as the global `Phaser` object.

## Acceptance check

- [ ] Loading `index.html` in a browser shows a portrait canvas with the
      `#101018` background.
- [ ] No errors or warnings in the browser console.
- [ ] `BootScene` immediately hands control to `GameScene` (visible via the
      "GameScene ready" log).
- [ ] The directory layout from `DEVELOPMENT_PLAN.md` §"Suggested directory
      layout" exists, even if some files are empty placeholders.
