# Doodle Machine War — Development Plan

> A turn-based, line-drawing strategy game built with **Phaser 3**.
> **Hard constraint:** This project must be implemented using **HTML + vanilla JavaScript only**. **Phaser.js is the only third-party library allowed.** No TypeScript, no Vite/Webpack/Parcel, no other npm dependencies.

---

## Tech Stack (Locked)

- **Language:** JavaScript (ES Modules, browser-native — no transpiler)
- **Markup:** A single `index.html` that loads Phaser and the game entry script
- **Library:** Phaser 3 (loaded via local file `vendor/phaser.min.js` or a CDN `<script>` tag)
- **No build step:** Source files are served as-is. Open `index.html` in a static server (e.g. `python3 -m http.server`) for development.
- **No test framework dependency:** If tests are needed, write small `test.html` pages that import modules and assert in the browser console.

### Suggested directory layout

```
/
├── index.html              # loads Phaser + ./src/main.js (type="module")
├── vendor/
│   └── phaser.min.js       # local copy of Phaser 3
├── src/
│   ├── main.js             # Phaser.Game config + scene registration
│   ├── config.js           # constants: HP, limits, zone sizes, colors
│   ├── scenes/
│   │   ├── BootScene.js
│   │   └── GameScene.js    # MVP main scene
│   ├── systems/
│   │   ├── DrawingInput.js     # stroke capture from pointer events
│   │   ├── ShapeClassifier.js  # line / triangle / circle detection
│   │   ├── Raycaster.js        # nearest-hit raycast against rect bboxes
│   │   └── TurnManager.js      # 1-action-per-turn state machine
│   ├── entities/
│   │   ├── Base.js
│   │   ├── Shield.js
│   │   └── Weapon.js           # Fighter (triangle) / Turret (circle)
│   └── ui/
│       └── HighlightFeedback.js # yellow / red raycast preview
└── DEVELOPMENT_PLAN.md     # this file
```

After scaffolding, update `CLAUDE.md` with: how to start the static server, the entry point (`src/main.js`), and the scene graph.

---

## Stage 0 — Project Scaffolding

**Goal:** Get a blank Phaser scene rendering in the browser.

- Create `index.html` with a `<div id="game">` and two `<script>` tags:
  1. `vendor/phaser.min.js`
  2. `src/main.js` with `type="module"`
- Create `src/main.js` with a minimal `Phaser.Game` config:
  - `type: Phaser.AUTO`
  - portrait dimensions (e.g. `width: 720, height: 1280`)
  - `scale.mode: Phaser.Scale.FIT`
  - `backgroundColor: '#101018'`
  - register `BootScene` and `GameScene`
- `BootScene` immediately starts `GameScene` (no asset loading needed for MVP — everything is drawn with `Graphics`).
- Verify the empty scene renders with no console errors.

**Acceptance:** Loading `index.html` in a browser shows a portrait canvas with the background color.

---

## Stage 1 — Drawing Input

**Goal:** Capture pointer strokes and render them live.

- `DrawingInput` listens to `pointerdown`, `pointermove`, `pointerup`, `pointerupoutside`, `pointerout` on the scene input.
- On `pointerdown`: begin a new stroke, store points in an array.
- On `pointermove`: append point, draw incrementally with `Phaser.GameObjects.Graphics`.
- On any pointer-up event: finalize the stroke and pass it to `ShapeClassifier`.
- Compute and store: bounding box, total polyline length, start point, end point.
- **Minimum stroke length filter** to drop accidental taps (GDD §14).
- Clear the stroke graphics after classification (or after a brief fade).

**Acceptance:** The user can drag on screen and see a live ink trail; very short taps are ignored.

---

## Stage 2 — Shape Classification (Pure Geometry, No ML)

**Goal:** Classify each finished stroke as `line`, `triangle`, `circle`, or `invalid`.

Evaluate in this order:

1. **Horizontal line → Shield**
   - Bounding-box width ≥ X% of screen width (the GDD's "left-to-right threshold")
   - Aspect ratio is wide and flat (height << width)
2. **Circle → Turret**
   - Endpoints are close (closed loop)
   - Standard deviation of `distance(point, centroid)` is small (≈ uniform radius)
3. **Triangle → Fighter**
   - Endpoints are close (closed loop)
   - After Ramer–Douglas–Peucker simplification, exactly 3 dominant corners remain
4. Otherwise → invalid (do not consume turn)

Each successful classification returns:
```js
{ kind: 'shield' | 'turret' | 'fighter', bbox, center, sizeMetric }
```

**Acceptance:** Drawing each shape type triggers a `console.log` of the correct class.

---

## Stage 3 — Battlefield Layout & Entities

**Goal:** Build the portrait layout from GDD §3 and instantiate game objects.

In `GameScene.create()`:

- Compute zone constants from `config.js`:
  - Enemy zone (top), divider line, player build area, player base row
- Spawn the player's 4 base HP nodes (labels B, A, S, E) as rectangles in the bottom row
- Spawn a mirrored set of enemy base nodes at the top
- For early testing, place a couple of dummy enemy weapons/shields so attacks have something to hit

Entity classes:

- **`Shield`** — wide thin rectangle, 1 hit to destroy, max 3 per side
- **`Weapon`** — circle (Turret) or triangle (Fighter) graphic, persistent, destructible, no cooldown
- **`Base`** — 4 individually targetable rectangle nodes per side

**Overlap prevention:** When placing anything, reject if its bbox intersects any existing entity's bbox or crosses the dividing line into enemy territory (GDD §14).

**Acceptance:** Drawing valid shapes places the matching entity at the stroke's center; invalid placements (overlap, wrong zone, over the cap) are silently rejected.

---

## Stage 4 — Turn Manager

**Goal:** Enforce "exactly one action per turn" and alternate sides.

- `TurnManager` holds `currentPlayer` and an `actionTaken` flag.
- All action paths (build shield, deploy weapon, fire attack) must:
  1. Check `currentPlayer === 'player'` and `!actionTaken`
  2. On success, call `endTurn()`
- For MVP, both sides are controlled hot-seat by the same mouse. AI is deferred to Stage 8.
- A small text label in a corner displays whose turn it is.

**Acceptance:** After any successful action, the turn label flips; further input is ignored until the other side acts.

---

## Stage 5 — Raycast & Attack System (Core Gameplay)

**Goal:** Implement attack resolution per GDD §6.3 and §7.

`Raycaster.cast(origin, target)`:
- Build a `Phaser.Geom.Line` from `origin` to `target`
- Test against every entity's rect via `Phaser.Geom.Intersects.LineToRectangle`
- Return the entity whose intersection point is **closest to the origin** along the ray
- Important: the GDD's "priority list" (Shield → Weapon → Base) is a *visual* description; the actual rule is **nearest hit along the ray**, regardless of type.

Drag-to-attack flow:
- `pointerdown` on a friendly weapon → enter aiming mode
- `pointermove` → run a live raycast every frame and update the highlight overlay
- `pointerup` on a valid (yellow) target:
  - If target is Shield or Weapon → destroy it
  - If target is a Base node → remove that HP node
  - Play a simple Tween projectile animation
  - Call `endTurn()`
- `pointerup` on red (self-blocked) or empty space → cancel; turn is **not** consumed

**Acceptance:** Player can drag from a friendly weapon, see a live preview, and successfully damage enemy targets while self-blocked attacks are rejected.

---

## Stage 6 — Highlight Feedback (Tutorial Replacement)

**Goal:** Yellow/red feedback per GDD §8.

- During an aim drag, every frame:
  - Hit something owned by the enemy → draw the ray in **yellow** and outline the target
  - Hit something owned by self → draw the ray in **red** and outline the blocker
  - Hit nothing → no highlight
- Use a dedicated `Graphics` layer that is cleared each frame.
- Avoid punishing exploration: red releases must be free (no turn consumed).

**Acceptance:** A new player can deduce the attack rules purely from the colors, without instructions.

---

## Stage 7 — Win/Lose & Game State

- Subtract HP nodes when a base is hit; remove the node sprite.
- When either side reaches 0 HP nodes, transition to a `GameOverScene` (or in-place overlay).
- Show winner text and a "Restart" button that re-creates `GameScene`.
- Optional: detect stalemates (no legal move possible).

**Acceptance:** A complete match can be played from start to a declared winner, then restarted.

---

## Stage 8 (Secondary) — AI, Animations, SFX

- **AI opponent (heuristic, no ML):**
  - If any enemy weapon has a clear line of sight from one of mine → attack it
  - Else if I own fewer than N weapons → deploy a weapon in a safe spot
  - Else build a shield to protect my highest-value weapon
- **Animation polish:** projectile trails, explosion particles via `Phaser.GameObjects.Particles`, ink fade-out on stroke release
- **Sound effects:** drawing tick, weapon fire, hit, destroy (Web Audio API or `Phaser.Sound`)

---

## Testing Strategy

Because we have no test framework, validate manually plus with throwaway harness pages:

- **Geometry harnesses:** small `tests/classifier.html` pages that synthesize stroke arrays and `console.log` the classifier output. Easy to eyeball.
- **Manual checklist:**
  - Each shape type is recognized across small/large/rotated examples
  - Self-blocking shows red and does not consume a turn
  - 4th shield placement is rejected
  - Overlapping placement is rejected
  - Cross-zone placement is rejected
  - Attacks land on the **nearest** entity along the ray, not a farther one of higher "priority"
  - Win condition triggers exactly when the 4th base node falls

---

## Milestones

| Milestone        | Stages | Playable State                              |
|------------------|--------|---------------------------------------------|
| **M1 – Drawable**    | 0–2    | Strokes are captured and classified         |
| **M2 – Buildable**   | 3–4    | Shields and weapons can be placed; turns alternate |
| **M3 – Playable MVP**| 5–7    | Full hot-seat match with win condition      |
| **M4 – Polished**    | 8      | AI opponent, animations, SFX                |

---

## Open Decisions Before Coding

1. **Phaser delivery:** local `vendor/phaser.min.js` (offline-friendly) or CDN script tag?
2. **Canvas resolution:** fixed 720×1280 portrait, or responsive `Phaser.Scale.FIT`?
3. **AI in MVP:** deliver hot-seat first (recommended) or block M3 on AI?
4. **Persistence:** any need for `localStorage` (settings, win count)? MVP probably no.
5. **Asset style:** stay 100% `Graphics`-drawn, or add a few sprite assets for polish?

---

## Working Agreements

- Branch: `claude/drawing-strategy-game-BNiGg`
- Commit per stage milestone with a clear message (e.g. `stage 2: shape classifier`)
- Update `CLAUDE.md` once the dev server command and entry point exist
- No new npm packages, no TypeScript, no bundlers — **HTML + JS + Phaser only**
