# Stage 5 — Raycast & Attack System

## Goal

Implement attack resolution: drag from a friendly weapon, fire a raycast every
frame, and on release damage the **nearest** entity along the ray. Self-blocked
or empty-space releases must NOT consume a turn.

> **Key rule (do not get this wrong):** the README's "Shield → Weapon → Base"
> ordering is *visual* framing only. The actual collision rule is **closest
> intersection wins, regardless of entity type**.

## Inputs / Outputs

- **Inputs:**
  - Pointer events on friendly weapon entities.
  - The flat list of alive entities from Stage 3.
  - The `TurnManager` from Stage 4.
- **Outputs:**
  - A reusable `Raycaster.cast()` function.
  - A drag-to-attack flow that destroys hit entities and ends the turn.
  - A simple tween-driven projectile animation.

## Data structures

```text
Ray {
  origin: { x, y }
  target: { x, y }
}

RayHit {
  entity: Entity                     // the closest hit, or null
  point:  { x, y }                   // intersection point on entity.bbox
  distance: Number                   // |point - origin|
}
```

## Pseudocode modules

### `src/systems/Raycaster.js`

```text
CLASS Raycaster
  CONSTRUCTOR(scene):
    this.scene = scene

  // Ignore the firing entity itself; otherwise the ray would hit it instantly.
  FUNCTION cast(origin, target, entities, ignoreId) -> RayHit | null:
    LET line   = new Phaser.Geom.Line(origin.x, origin.y, target.x, target.y)
    LET best   = null
    FOR EACH e IN entities WHERE e.alive AND e.id !== ignoreId:
      LET rect = phaserRectFromBbox(e.bbox)
      LET out  = []   // Phaser writes intersection points into this array
      IF Phaser.Geom.Intersects.GetLineToRectangle(line, rect, out):
        FOR EACH p IN out:
          LET d = distance(origin, p)
          IF best IS null OR d < best.distance:
            best = { entity: e, point: p, distance: d }
    RETURN best
END CLASS
```

> Phaser API note: `Phaser.Geom.Intersects.LineToRectangle` returns a boolean
> only. To get the intersection point we need `GetLineToRectangle` (the
> non-`Intersects.LineToRectangle` variant) which fills an output array with
> all intersection points along the line. Either function works — pick the one
> that returns the points so we can compute "nearest".

### `src/systems/AttackController.js`

```text
CLASS AttackController
  CONSTRUCTOR(scene, raycaster, turnManager, getAllEntities, highlight):
    this.scene           = scene
    this.raycaster       = raycaster
    this.turnManager     = turnManager
    this.getAllEntities  = getAllEntities    // () -> Array<Entity>
    this.highlight       = highlight         // Stage 6 hook; null in Stage 5
    this.aiming          = null              // { weapon, pointerId }

  FUNCTION attachToWeapon(weapon):
    // Make the weapon graphic interactive over its bbox.
    weapon.graphics.setInteractive(
      new Phaser.Geom.Rectangle(weapon.bbox.x, weapon.bbox.y, weapon.bbox.width, weapon.bbox.height),
      Phaser.Geom.Rectangle.Contains
    )
    weapon.graphics.on('pointerdown', (pointer) => this.beginAim(weapon, pointer))

  FUNCTION beginAim(weapon, pointer):
    // Only the active player may aim, and only with their own weapons.
    IF NOT this.turnManager.beginAction(weapon.owner): RETURN
    IF weapon.owner !== this.turnManager.state.currentPlayer:
      this.turnManager.release(); RETURN

    this.aiming = { weapon, pointerId: pointer.id }
    this.scene.input.on('pointermove', this.onAimMove, this)
    this.scene.input.on('pointerup',        this.onAimUp, this)
    this.scene.input.on('pointerupoutside', this.onAimUp, this)

  FUNCTION onAimMove(pointer):
    IF this.aiming IS null: RETURN
    LET hit = this.raycaster.cast(
      this.aiming.weapon.center,
      { x: pointer.x, y: pointer.y },
      this.getAllEntities(),
      this.aiming.weapon.id,
    )
    // Highlight is owned by Stage 6. Stage 5 just calls into it if present.
    IF this.highlight:
      this.highlight.update(this.aiming.weapon.center, { x: pointer.x, y: pointer.y }, hit, this.aiming.weapon.owner)

  FUNCTION onAimUp(pointer):
    IF this.aiming IS null: RETURN
    LET weapon = this.aiming.weapon
    LET hit = this.raycaster.cast(
      weapon.center,
      { x: pointer.x, y: pointer.y },
      this.getAllEntities(),
      weapon.id,
    )

    this.cleanupAim()

    // Stage 5/6 contract: only enemy hits count.
    IF hit IS null OR hit.entity.owner === weapon.owner:
      // Red or empty release — refund the turn.
      this.turnManager.release()
      RETURN

    // Yellow release — animate, resolve, end turn.
    this.fireProjectile(weapon.center, hit.point, () => {
      this.resolveHit(hit.entity)
      this.turnManager.endTurn()
    })

  FUNCTION cleanupAim():
    this.scene.input.off('pointermove', this.onAimMove, this)
    this.scene.input.off('pointerup',        this.onAimUp, this)
    this.scene.input.off('pointerupoutside', this.onAimUp, this)
    IF this.highlight: this.highlight.clear()
    this.aiming = null

  FUNCTION resolveHit(target):
    IF target.kind === 'base':
      // Stage 7 will subtract HP and check for game-over here.
      target.alive = false
      target.graphics.destroy()
    ELSE:
      // Shield, turret, fighter — destroyed in one hit.
      target.alive = false
      target.graphics.destroy()

  FUNCTION fireProjectile(from, to, onComplete):
    LET dot = this.scene.add.graphics()
    dot.fillStyle(0xffffff)
    dot.fillCircle(from.x, from.y, 4)
    this.scene.tweens.add({
      targets:  dot,
      x:        to.x - from.x,
      y:        to.y - from.y,
      duration: 180,
      onComplete: () => { dot.destroy(); onComplete() },
    })
END CLASS
```

### `GameScene.create()` patch

```text
FUNCTION create():
  // ... Stage 4 setup ...
  this.raycaster = new Raycaster(this)
  this.attack    = new AttackController(
    this,
    this.raycaster,
    this.turnManager,
    () => allEntitiesView(this),
    /* highlight */ null,    // Stage 6 will inject the real one
  )

FUNCTION registerEntity(scene, entity):
  // ... Stage 3 logic ...
  IF entity.kind === 'turret' OR entity.kind === 'fighter':
    scene.attack.attachToWeapon(entity)

FUNCTION allEntitiesView(scene) -> Array<Entity>:
  RETURN concat(
    scene.entities.bases.player.nodes,
    scene.entities.bases.enemy.nodes,
    scene.entities.shields,
    scene.entities.weapons,
  )
```

## Integration notes

- **Self-skip is via `ignoreId`**, not via `owner`. The firing weapon is the
  only thing the ray must skip; *other* friendly entities (shields, allied
  weapons) are intentionally legal blockers — that's the whole self-blocking
  mechanic.
- The "yellow vs red" decision is made on `owner`: if the nearest hit is an
  enemy entity it's a legal attack; if it's a friendly entity (or nothing), the
  release is refunded.
- `pointermove` on `GameScene.input` is used during aim instead of
  `weapon.graphics.on('pointermove')` because the player will drag *away* from
  the weapon, so we need the global stream.
- `attachToWeapon` is called from `registerEntity` so newly built weapons are
  immediately attackable on the next turn.
- Phaser's `setInteractive` requires the `Graphics` to have a hit area shape;
  we pass the bbox rectangle explicitly because `Graphics` has no implicit
  bounds.

## Acceptance check

- [ ] Tapping a friendly weapon then dragging shows a live preview hit
      (visible in console even before Stage 6).
- [ ] Releasing the drag on an enemy entity destroys it and ends the turn.
- [ ] Releasing the drag on empty space leaves all entities alive and the
      turn label unchanged.
- [ ] Releasing the drag on a friendly entity leaves all entities alive and
      the turn label unchanged.
- [ ] When two enemy entities lie along the ray, the **closer** one is hit,
      regardless of whether it's a Shield, Weapon, or Base node.
- [ ] A weapon cannot be made to hit itself (the firing weapon is excluded).
