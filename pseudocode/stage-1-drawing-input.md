# Stage 1 — Drawing Input

## Goal

Capture pointer strokes and render them live so the player sees an "ink trail"
while drawing. Drop accidental taps before they reach the classifier.

## Inputs / Outputs

- **Inputs:** Phaser pointer events (`pointerdown`, `pointermove`, `pointerup`,
  `pointerupoutside`, `pointerout`) coming from `GameScene.input`.
- **Outputs:**
  - A live `Phaser.GameObjects.Graphics` ink trail.
  - On stroke finish, a `Stroke` object handed to a callback (Stage 2 plugs the
    classifier in here).

## Data structures

```text
Stroke {
  points:   Array<{ x: Number, y: Number }>
  bbox:     { x, y, width, height }    // axis-aligned
  length:   Number                     // total polyline length, in pixels
  start:    { x, y }                   // first sampled point
  end:      { x, y }                   // last sampled point
  duration: Number                     // ms between pointerdown and pointerup
}
```

```text
DrawingInputOptions {
  minStrokeLength:  Number  // pixels, e.g. 24 — accidental-tap filter
  inkColor:         Number  // 0xffffff
  inkWidth:         Number  // px, e.g. 4
  fadeMs:           Number  // optional, e.g. 120 — set to 0 for instant clear
}
```

## Pseudocode modules

### `src/systems/DrawingInput.js`

```text
CLASS DrawingInput
  CONSTRUCTOR(scene, options, onStrokeComplete):
    this.scene             = scene
    this.options           = options
    this.onStrokeComplete  = onStrokeComplete   // FUNCTION(Stroke)
    this.activeStroke      = null
    this.graphics          = scene.add.graphics()
    this.graphics.lineStyle(options.inkWidth, options.inkColor, 1)

    scene.input.on('pointerdown',      this.handleDown,    this)
    scene.input.on('pointermove',      this.handleMove,    this)
    scene.input.on('pointerup',        this.handleUp,      this)
    scene.input.on('pointerupoutside', this.handleUp,      this)
    scene.input.on('pointerout',       this.handleCancel,  this)

  FUNCTION handleDown(pointer):
    // Stage 5 will gate aim-drags here; for Stage 1, every pointerdown starts
    // a stroke.
    this.activeStroke = {
      points:   [{ x: pointer.x, y: pointer.y }],
      startMs:  scene.time.now,
    }
    this.graphics.beginPath()
    this.graphics.moveTo(pointer.x, pointer.y)

  FUNCTION handleMove(pointer):
    IF this.activeStroke IS null: RETURN
    LET last = last element of this.activeStroke.points
    // Skip duplicates so the polyline length isn't inflated by jitter.
    IF distance(last, pointer) < 1: RETURN
    push { x: pointer.x, y: pointer.y } onto this.activeStroke.points
    this.graphics.lineTo(pointer.x, pointer.y)
    this.graphics.strokePath()

  FUNCTION handleUp(pointer):
    IF this.activeStroke IS null: RETURN
    LET stroke = finalizeStroke(this.activeStroke, scene.time.now)
    this.activeStroke = null
    clearInk(this.graphics, this.options.fadeMs)
    IF stroke.length < this.options.minStrokeLength:
      // Accidental tap — silently drop.
      RETURN
    this.onStrokeComplete(stroke)

  FUNCTION handleCancel(pointer):
    // Pointer left the canvas mid-stroke — treat as up to avoid stuck state.
    this.handleUp(pointer)

  FUNCTION destroy():
    scene.input.off('pointerdown',      this.handleDown,    this)
    scene.input.off('pointermove',      this.handleMove,    this)
    scene.input.off('pointerup',        this.handleUp,      this)
    scene.input.off('pointerupoutside', this.handleUp,      this)
    scene.input.off('pointerout',       this.handleCancel,  this)
    this.graphics.destroy()
END CLASS
```

### Helpers (same file or `src/systems/strokeMath.js`)

```text
FUNCTION finalizeStroke(raw, nowMs) -> Stroke:
  LET points  = raw.points
  LET length  = 0
  LET minX, minY =  Infinity
  LET maxX, maxY = -Infinity
  FOR i FROM 0 TO points.length - 1:
    LET p = points[i]
    minX = min(minX, p.x); minY = min(minY, p.y)
    maxX = max(maxX, p.x); maxY = max(maxY, p.y)
    IF i > 0:
      length += distance(points[i - 1], p)
  RETURN {
    points,
    bbox:     { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    length,
    start:    points[0],
    end:      points[points.length - 1],
    duration: nowMs - raw.startMs,
  }

FUNCTION distance(a, b) -> Number:
  RETURN sqrt((a.x - b.x)^2 + (a.y - b.y)^2)

FUNCTION clearInk(graphics, fadeMs):
  IF fadeMs <= 0:
    graphics.clear()
    RETURN
  // Optional: tween graphics.alpha 1 -> 0 over fadeMs, then clear and reset.
  scene.tweens.add({
    targets:  graphics,
    alpha:    0,
    duration: fadeMs,
    onComplete: () => { graphics.clear(); graphics.alpha = 1 }
  })
```

## Integration notes

- `GameScene.create()` is the only place that constructs `DrawingInput`. The
  `onStrokeComplete` callback is a no-op in Stage 1 (just `console.log` the
  stroke); Stage 2 will replace it with a call into `ShapeClassifier`.
- `minStrokeLength` should be configurable via `config.js` so later stages
  (and tests) can tweak it. Suggested default: ~24 px for a 720 px-wide canvas.
- The ink trail uses **a single shared `Graphics` object** that is cleared per
  stroke. Do not allocate a new `Graphics` per stroke — that leaks GPU state.
- All pointer-up codepaths route through `handleUp` so the activeStroke
  cleanup is centralized.

## Acceptance check

- [ ] Dragging on the canvas shows a live ink trail under the pointer.
- [ ] Releasing the pointer fires exactly one `onStrokeComplete` call with a
      well-formed `Stroke` (non-zero length, bbox spans the drag).
- [ ] Releasing the pointer outside the canvas still fires `onStrokeComplete`
      (no stuck strokes).
- [ ] Single-tap clicks (length < `minStrokeLength`) are silently dropped.
- [ ] No `Graphics` objects accumulate in the scene over many strokes.
