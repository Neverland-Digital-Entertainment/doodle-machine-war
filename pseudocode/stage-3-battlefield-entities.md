# Stage 3 — Battlefield Layout & Entities

## Goal

Build the portrait battlefield from `README.md` §Layout and instantiate the
three entity types (`Base`, `Shield`, `Weapon`). Reject any placement that
overlaps existing entities or crosses the dividing line into enemy territory.

## Inputs / Outputs

- **Inputs:**
  - Screen dimensions from `config.js`.
  - `Classification` objects coming from Stage 2.
- **Outputs:**
  - Persistent arrays of `Base`, `Shield`, `Weapon` entities held by
    `GameScene`.
  - A visible battlefield (zones + bases + dummy enemy units for testing).

## Data structures

```text
Owner = 'player' | 'enemy'

EntityKind = 'base' | 'shield' | 'turret' | 'fighter'

Entity {
  id:         Number       // monotonically increasing
  kind:       EntityKind
  owner:      Owner
  bbox:       { x, y, width, height }   // axis-aligned, used by raycast & overlap
  center:     { x, y }
  graphics:   Phaser.GameObjects.Graphics
  alive:      Boolean
}

Zones {
  enemyBuild:    Rect    // top of canvas, enemy build area
  enemyBaseRow:  Rect    // top edge, holds enemy base nodes
  divider:       { y }   // single horizontal line; impassable for placement
  playerBuild:   Rect    // middle/lower section, player build area
  playerBaseRow: Rect    // bottom edge, holds player base nodes
}
```

## `config.js` additions

```text
EXPORT const ZONES = {
  baseRowHeightPx:   80,
  buildAreaPaddingPx: 16,
  // Dividing line sits at exactly screen.height / 2 for the MVP.
}

EXPORT const BASE = {
  nodeCount:  4,           // labels: B, A, S, E
  nodeWidthPx:  120,
  nodeHeightPx: 60,
  nodeGapPx:    12,
  labels:    ['B', 'A', 'S', 'E'],
}

EXPORT const SHIELD = {
  maxPerSide:   3,
  thicknessPx:  16,
  color:        0x66ccff,
}

EXPORT const WEAPON = {
  // Pure visuals — gameplay is unlimited per side.
  turret: { radiusPx: 28, color: 0xffaa44 },
  fighter: { sideHintPx: 56, color: 0xff66aa },
}
```

## Pseudocode modules

### `src/entities/Base.js`

```text
CLASS Base
  CONSTRUCTOR(scene, owner, anchorRect):
    // anchorRect is the row strip (full width, BASE.nodeHeightPx tall).
    this.scene  = scene
    this.owner  = owner
    this.nodes  = []   // Array<Entity> — one per HP node

    LET totalWidth = BASE.nodeCount * BASE.nodeWidthPx + (BASE.nodeCount - 1) * BASE.nodeGapPx
    LET startX = anchorRect.x + (anchorRect.width - totalWidth) / 2
    LET y      = anchorRect.y + (anchorRect.height - BASE.nodeHeightPx) / 2

    FOR i FROM 0 TO BASE.nodeCount - 1:
      LET x = startX + i * (BASE.nodeWidthPx + BASE.nodeGapPx)
      LET node = makeBaseNode(scene, owner, x, y, BASE.labels[i])
      push node onto this.nodes

  FUNCTION remainingHp() -> Number:
    RETURN count of node IN this.nodes WHERE node.alive

  FUNCTION takeHit(node):
    node.alive = false
    node.graphics.destroy()

FUNCTION makeBaseNode(scene, owner, x, y, label) -> Entity:
  LET g = scene.add.graphics()
  g.fillStyle(owner === 'player' ? 0x66ff99 : 0xff5566)
  g.fillRect(x, y, BASE.nodeWidthPx, BASE.nodeHeightPx)
  // Optional text label drawn with scene.add.text(...) — purely cosmetic.
  RETURN {
    id:       nextEntityId(),
    kind:     'base',
    owner,
    bbox:     { x, y, width: BASE.nodeWidthPx, height: BASE.nodeHeightPx },
    center:   { x: x + BASE.nodeWidthPx / 2, y: y + BASE.nodeHeightPx / 2 },
    graphics: g,
    alive:    true,
  }
```

### `src/entities/Shield.js`

```text
FUNCTION createShield(scene, owner, classification) -> Entity | null:
  // classification.center is the stroke center; classification.sizeMetric is width.
  LET width  = classification.sizeMetric
  LET height = SHIELD.thicknessPx
  LET x      = classification.center.x - width / 2
  LET y      = classification.center.y - height / 2
  LET bbox   = { x, y, width, height }

  IF NOT canPlace(bbox, owner): RETURN null
  IF countShieldsOf(owner) >= SHIELD.maxPerSide: RETURN null

  LET g = scene.add.graphics()
  g.fillStyle(SHIELD.color)
  g.fillRect(x, y, width, height)
  RETURN {
    id:       nextEntityId(),
    kind:     'shield',
    owner,
    bbox,
    center:   { x: x + width/2, y: y + height/2 },
    graphics: g,
    alive:    true,
  }
```

### `src/entities/Weapon.js`

```text
FUNCTION createWeapon(scene, owner, classification) -> Entity | null:
  IF classification.kind === 'turret':
    LET r      = max(WEAPON.turret.radiusPx, classification.sizeMetric)
    LET bbox   = { x: classification.center.x - r, y: classification.center.y - r, width: 2*r, height: 2*r }
    IF NOT canPlace(bbox, owner): RETURN null
    LET g = scene.add.graphics()
    g.lineStyle(3, WEAPON.turret.color)
    g.strokeCircle(classification.center.x, classification.center.y, r)
    RETURN entityRecord('turret', owner, bbox, classification.center, g)

  IF classification.kind === 'fighter':
    LET halfSide = classification.sizeMetric / 2
    LET bbox     = squareBboxAround(classification.center, halfSide)
    IF NOT canPlace(bbox, owner): RETURN null
    LET g = scene.add.graphics()
    g.lineStyle(3, WEAPON.fighter.color)
    drawTriangle(g, bbox)   // simple equilateral triangle inside bbox
    RETURN entityRecord('fighter', owner, bbox, classification.center, g)

  RETURN null

FUNCTION entityRecord(kind, owner, bbox, center, graphics) -> Entity:
  RETURN { id: nextEntityId(), kind, owner, bbox, center, graphics, alive: true }
```

### Placement guard (lives in `GameScene` or `src/systems/Placement.js`)

```text
FUNCTION canPlace(bbox, owner) -> Boolean:
  // 1. Must be entirely inside the owner's half of the canvas.
  IF owner === 'player' AND bbox.y < ZONES.divider.y: RETURN false
  IF owner === 'enemy'  AND bbox.y + bbox.height > ZONES.divider.y: RETURN false

  // 2. Must be inside the screen.
  IF bbox.x < 0 OR bbox.y < 0: RETURN false
  IF bbox.x + bbox.width  > SCREEN.width:  RETURN false
  IF bbox.y + bbox.height > SCREEN.height: RETURN false

  // 3. Must not overlap any existing alive entity (any owner).
  FOR EACH e IN allEntities WHERE e.alive:
    IF rectsOverlap(bbox, e.bbox): RETURN false

  RETURN true

FUNCTION rectsOverlap(a, b) -> Boolean:
  RETURN NOT (a.x + a.width  <= b.x OR
              b.x + b.width  <= a.x OR
              a.y + a.height <= b.y OR
              b.y + b.height <= a.y)
```

### `GameScene.create()` additions

```text
FUNCTION create():
  drawBattlefieldBackground(this)        // background, divider line, zone tints
  this.zones = computeZones(SCREEN, ZONES)

  this.entities = {
    bases:   { player: null, enemy: null },
    shields: [],
    weapons: [],
  }

  this.entities.bases.player = new Base(this, 'player', this.zones.playerBaseRow)
  this.entities.bases.enemy  = new Base(this, 'enemy',  this.zones.enemyBaseRow)

  // Stage-3 testing aid: drop a couple of dummy enemy weapons/shields so the
  // upcoming raycast stage has targets.
  spawnDummyEnemyUnits(this)

  this.classifier = new ShapeClassifier(CLASSIFIER, SCREEN.width)
  this.drawing    = new DrawingInput(this, DRAW_OPTIONS, stroke => this.handleStroke(stroke))

FUNCTION handleStroke(stroke):
  LET classification = this.classifier.classify(stroke)
  IF classification.kind === 'invalid': RETURN

  LET owner = 'player'                   // Stage 4 will gate this on TurnManager
  LET entity = null
  IF classification.kind === 'shield':
    entity = createShield(this, owner, classification)
  ELSE IF classification.kind === 'turret' OR classification.kind === 'fighter':
    entity = createWeapon(this, owner, classification)

  IF entity IS null: RETURN              // overlap/zone/cap rejected — silent
  registerEntity(this, entity)
```

## Integration notes

- Every entity type exposes the same `Entity` shape so Stages 5/6 only need
  one collision-test code path.
- `allEntities` is a flat list view over all alive bases/shields/weapons. It
  can be a getter on `GameScene` that concatenates the three buckets.
- `nextEntityId()` is a tiny module-scoped counter; useful when the AI in
  Stage 8 needs to refer to a specific entity.
- This stage still spawns the player entity unconditionally — Stage 4 will
  insert the `TurnManager` check at the top of `handleStroke`.
- The dummy enemy units exist only so Stage 5 has something to shoot. They
  should be removed (or gated behind a config flag) once the AI from Stage 8
  is in place.

## Acceptance check

- [ ] Drawing a horizontal line places a shield centered on the stroke.
- [ ] Drawing a circle places a turret at the stroke centroid.
- [ ] Drawing a triangle places a fighter at the stroke center.
- [ ] Placing a 4th shield is silently rejected.
- [ ] Placing any shape that overlaps another entity is silently rejected.
- [ ] Placing any shape that crosses the divider into enemy territory is
      silently rejected.
- [ ] Player base and enemy base each render 4 HP node rectangles in the
      correct row.
