# Stage 6 — Highlight Feedback

## Goal

Replace the tutorial with color: while the player is dragging an aim,
draw the ray in **yellow** when it would land on an enemy and **red** when
it's blocked by their own unit. A new player should be able to deduce the
attack rules from the colors alone.

## Inputs / Outputs

- **Input:** every frame of an aim drag from
  [Stage 5](./stage-5-raycast-attack.md): the firing origin, the current
  pointer position, the most recent `RayHit`, and the firing owner.
- **Output:** a dedicated `Graphics` overlay drawn on top of the battlefield
  showing the ray and an outline around the hovered target.

## Data structures

```text
HighlightState {
  ray:        Phaser.GameObjects.Graphics
  outline:    Phaser.GameObjects.Graphics
}
```

```text
HighlightConfig {
  yellow:        0xffe066
  red:           0xff4d4d
  rayWidthPx:    3
  outlineWidthPx: 4
}
```

## Pseudocode modules

### `src/ui/HighlightFeedback.js`

```text
CLASS HighlightFeedback
  CONSTRUCTOR(scene, config):
    this.scene   = scene
    this.config  = config
    this.ray     = scene.add.graphics()
    this.outline = scene.add.graphics()
    // Render above gameplay graphics — set high depth so nothing hides them.
    this.ray.setDepth(1000)
    this.outline.setDepth(1000)

  // Called from AttackController.onAimMove every frame of the drag.
  FUNCTION update(origin, pointer, hit, firingOwner):
    this.clear()

    IF hit IS null:
      // Empty-space drag — no highlight, no outline. Stage 6 spec: "Hit
      // nothing → no highlight."
      RETURN

    LET color = (hit.entity.owner === firingOwner) ? this.config.red : this.config.yellow

    // Draw the ray from origin to the *intersection point*, not the cursor —
    // that visually communicates where the shot would actually land.
    this.ray.lineStyle(this.config.rayWidthPx, color, 1)
    this.ray.beginPath()
    this.ray.moveTo(origin.x, origin.y)
    this.ray.lineTo(hit.point.x, hit.point.y)
    this.ray.strokePath()

    // Outline the entity that the ray would resolve on.
    LET b = hit.entity.bbox
    this.outline.lineStyle(this.config.outlineWidthPx, color, 1)
    this.outline.strokeRect(b.x, b.y, b.width, b.height)

  FUNCTION clear():
    this.ray.clear()
    this.outline.clear()

  FUNCTION destroy():
    this.ray.destroy()
    this.outline.destroy()
END CLASS
```

### `GameScene.create()` patch

```text
FUNCTION create():
  // ... Stage 5 setup ...
  this.highlight = new HighlightFeedback(this, HIGHLIGHT)
  // Inject the real highlight into AttackController. The Stage 5 placeholder
  // (null) is replaced here so older code keeps working during refactor.
  this.attack.highlight = this.highlight
```

### `AttackController` integration (no behavior change, just naming)

```text
// Already wired in Stage 5:
//   onAimMove → highlight.update(origin, pointer, hit, weapon.owner)
//   cleanupAim → highlight.clear()
//
// Stage 6 only adds the real implementation behind those calls.
```

## Integration notes

- The highlight overlay clears itself **every frame** before drawing again. It
  must never accumulate state between frames or it'll smear.
- Color choice mirrors GDD §8: yellow = legal attack, red = self-blocked.
  Keep them as named constants in `config.js` so future palette tweaks don't
  have to hunt through code.
- `setDepth(1000)` — or whichever value sits above all entities — guarantees
  the highlight is visible even when it crosses a target.
- **Free exploration is sacred.** Stage 5 already refunds the turn on red and
  empty releases; Stage 6 must not re-introduce any code path that ends the
  turn from a highlight branch. The highlight is purely visual.
- The hover outline is drawn on the **bbox** rather than the entity's true
  shape (circle/triangle) because the raycast itself uses bboxes — this keeps
  the visual feedback honest about what the geometry actually computes.

## Acceptance check

- [ ] Aiming a friendly weapon at an enemy entity draws the ray in yellow and
      outlines the target in yellow.
- [ ] Aiming a friendly weapon at one of your own units draws the ray in red
      and outlines the blocker in red.
- [ ] Aiming at empty space draws nothing.
- [ ] Releasing on a yellow target consumes the turn and destroys the target.
- [ ] Releasing on red or empty does NOT consume the turn — the turn label is
      unchanged.
- [ ] A new player who has never read the rules can figure out attacks just by
      watching the colors during a few drags.
