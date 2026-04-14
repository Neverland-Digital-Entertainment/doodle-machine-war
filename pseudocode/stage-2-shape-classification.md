# Stage 2 — Shape Classification

## Goal

Turn each finished `Stroke` from Stage 1 into a `Classification` of `shield`,
`turret`, `fighter`, or `invalid`, using pure geometry. **No machine learning,
no external library.**

## Inputs / Outputs

- **Input:** `Stroke` produced by `DrawingInput.onStrokeComplete`.
- **Output:** A `Classification` object, or `null`/`{ kind: 'invalid' }` if the
  stroke does not match any known shape.

## Data structures

```text
Classification {
  kind:        'shield' | 'turret' | 'fighter' | 'invalid'
  bbox:        { x, y, width, height }
  center:      { x, y }
  sizeMetric:  Number   // shield: width;  turret: avg radius;  fighter: longest edge
}
```

```text
ClassifierConfig {
  // Shield
  shieldMinWidthRatio:        Number  // e.g. 0.6  (60% of screen width)
  shieldMaxAspectRatio:       Number  // height / width upper bound, e.g. 0.25

  // Closed-loop test (used by both circle and triangle)
  closedLoopMaxGapRatio:      Number  // gap / max(bbox.w, bbox.h), e.g. 0.2

  // Circle
  circleRadiusStdDevRatio:    Number  // stddev(r) / mean(r) upper bound, e.g. 0.18

  // Triangle (after Ramer–Douglas–Peucker simplification)
  rdpEpsilonRatio:            Number  // epsilon / max(bbox.w, bbox.h), e.g. 0.05
  triangleCornerCount:        Number  // exactly 3
}
```

## Pseudocode modules

### `src/systems/ShapeClassifier.js`

```text
IMPORT { rdpSimplify } FROM './geometry/rdp.js'   // small helper, see below

CLASS ShapeClassifier
  CONSTRUCTOR(config, screenWidth):
    this.config       = config
    this.screenWidth  = screenWidth

  FUNCTION classify(stroke) -> Classification:
    // Order matters: shield is checked first because a long horizontal line
    // could otherwise look like a degenerate triangle.

    LET shieldResult = this.tryShield(stroke)
    IF shieldResult: RETURN shieldResult

    LET circleResult = this.tryCircle(stroke)
    IF circleResult: RETURN circleResult

    LET triangleResult = this.tryTriangle(stroke)
    IF triangleResult: RETURN triangleResult

    RETURN { kind: 'invalid', bbox: stroke.bbox, center: bboxCenter(stroke.bbox), sizeMetric: 0 }

  // ---------- Shield ----------
  FUNCTION tryShield(stroke) -> Classification | null:
    LET bbox = stroke.bbox
    IF bbox.width / this.screenWidth < this.config.shieldMinWidthRatio: RETURN null
    IF bbox.height / max(bbox.width, 1) > this.config.shieldMaxAspectRatio: RETURN null
    RETURN {
      kind:       'shield',
      bbox,
      center:     bboxCenter(bbox),
      sizeMetric: bbox.width,
    }

  // ---------- Circle ----------
  FUNCTION tryCircle(stroke) -> Classification | null:
    IF NOT isClosedLoop(stroke, this.config.closedLoopMaxGapRatio): RETURN null

    LET centroid    = averagePoint(stroke.points)
    LET radii       = stroke.points.map(p => distance(p, centroid))
    LET meanRadius  = mean(radii)
    LET stdDev      = standardDeviation(radii)

    IF meanRadius <= 0: RETURN null
    IF stdDev / meanRadius > this.config.circleRadiusStdDevRatio: RETURN null

    RETURN {
      kind:       'turret',
      bbox:       stroke.bbox,
      center:     centroid,
      sizeMetric: meanRadius,
    }

  // ---------- Triangle ----------
  FUNCTION tryTriangle(stroke) -> Classification | null:
    IF NOT isClosedLoop(stroke, this.config.closedLoopMaxGapRatio): RETURN null

    LET diag    = sqrt(stroke.bbox.width^2 + stroke.bbox.height^2)
    LET epsilon = this.config.rdpEpsilonRatio * max(stroke.bbox.width, stroke.bbox.height)
    LET simplified = rdpSimplify(stroke.points, epsilon)

    // RDP on a closed loop preserves the duplicated start/end. Drop one to count
    // unique corners.
    LET uniqueCorners = simplified.length - 1
    IF uniqueCorners != this.config.triangleCornerCount: RETURN null

    LET edges = [
      distance(simplified[0], simplified[1]),
      distance(simplified[1], simplified[2]),
      distance(simplified[2], simplified[0]),
    ]
    RETURN {
      kind:       'fighter',
      bbox:       stroke.bbox,
      center:     averagePoint(simplified.slice(0, 3)),
      sizeMetric: max(...edges),
    }
END CLASS
```

### Geometry helpers (same file or `src/systems/geometry/*.js`)

```text
FUNCTION isClosedLoop(stroke, maxGapRatio) -> Boolean:
  LET gap   = distance(stroke.start, stroke.end)
  LET span  = max(stroke.bbox.width, stroke.bbox.height, 1)
  RETURN (gap / span) <= maxGapRatio

FUNCTION averagePoint(points) -> { x, y }:
  LET sumX = 0; LET sumY = 0
  FOR EACH p IN points:
    sumX += p.x; sumY += p.y
  RETURN { x: sumX / points.length, y: sumY / points.length }

FUNCTION mean(values)              -> Number
FUNCTION standardDeviation(values) -> Number  // population stddev is fine
FUNCTION bboxCenter(bbox)          -> { x: bbox.x + bbox.width/2, y: bbox.y + bbox.height/2 }

// Ramer–Douglas–Peucker — recursive polyline simplification.
FUNCTION rdpSimplify(points, epsilon) -> Array<Point>:
  IF points.length < 3: RETURN points.copy()
  LET firstIdx = 0
  LET lastIdx  = points.length - 1
  LET maxDist  = 0
  LET maxIdx   = 0
  FOR i FROM firstIdx + 1 TO lastIdx - 1:
    LET d = perpendicularDistance(points[i], points[firstIdx], points[lastIdx])
    IF d > maxDist:
      maxDist = d; maxIdx = i
  IF maxDist > epsilon:
    LET left  = rdpSimplify(points.slice(firstIdx, maxIdx + 1), epsilon)
    LET right = rdpSimplify(points.slice(maxIdx, lastIdx + 1), epsilon)
    RETURN concat(left.slice(0, -1), right)
  RETURN [points[firstIdx], points[lastIdx]]

FUNCTION perpendicularDistance(p, a, b) -> Number:
  // Distance from p to the infinite line through a-b. Use the cross-product form.
```

## Integration notes

- `GameScene.create()` instantiates one `ShapeClassifier` and rewires
  `DrawingInput`'s `onStrokeComplete` callback to:
  1. Call `classifier.classify(stroke)`.
  2. `console.log` the kind (Stage 2 acceptance).
  3. Stage 3 will swap that log for an entity-spawn call.
- Thresholds live in `ClassifierConfig` exported from `src/config.js` so they
  can be tweaked without touching code paths.
- Run order is **shield → circle → triangle**. A long, slightly-curved
  horizontal line could otherwise look like a degenerate triangle; checking
  shield first avoids that pitfall.
- The classifier never mutates the input `Stroke`.

## Acceptance check

- [ ] Drawing a long horizontal line logs `shield` and never logs `fighter`.
- [ ] Drawing a roughly round closed loop logs `turret`.
- [ ] Drawing a closed three-corner shape logs `fighter`, regardless of
      rotation.
- [ ] Random scribbles log `invalid`.
- [ ] All four classifications can be recognized at small, large, and rotated
      sizes (manual harness page or in-scene console testing).
