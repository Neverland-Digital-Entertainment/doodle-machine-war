# Stage 4 — Turn Manager

## Goal

Enforce the rule "exactly one action per turn" and alternate sides. All build
and attack code paths must funnel through this gate so we never accidentally
let a side take two actions in a row.

## Inputs / Outputs

- **Inputs:** action attempts from `GameScene` (build shield, deploy weapon,
  fire attack).
- **Outputs:**
  - A `TurnManager` instance held by `GameScene`.
  - A small "Turn: PLAYER / ENEMY" UI label.
  - An `endTurn()` event that earlier-stage code calls on success.

## Data structures

```text
TurnState {
  currentPlayer: 'player' | 'enemy'
  actionTaken:   Boolean        // becomes true after a successful action
  turnNumber:    Number         // increments per side switch
}
```

```text
TurnManagerOptions {
  startingPlayer:  'player' | 'enemy'
  onTurnChange:    Function(currentPlayer)   // UI hook
}
```

## Pseudocode modules

### `src/systems/TurnManager.js`

```text
CLASS TurnManager
  CONSTRUCTOR(options):
    this.state = {
      currentPlayer: options.startingPlayer ?? 'player',
      actionTaken:   false,
      turnNumber:    1,
    }
    this.onTurnChange = options.onTurnChange
    this.onTurnChange(this.state.currentPlayer)

  // -------- Gate used by every action codepath --------
  FUNCTION canAct(owner) -> Boolean:
    RETURN owner === this.state.currentPlayer AND NOT this.state.actionTaken

  // Convenience wrapper used by build/attack flows. Returns true if the action
  // is allowed AND marks it as in-flight; the caller MUST follow up with
  // either endTurn() (on success) or release() (on cancel).
  FUNCTION beginAction(owner) -> Boolean:
    IF NOT this.canAct(owner): RETURN false
    this.state.actionTaken = true
    RETURN true

  FUNCTION release():
    // Called when a started action is aborted (e.g. red aim drag in Stage 6).
    // The turn is NOT consumed.
    this.state.actionTaken = false

  FUNCTION endTurn():
    // Called after a successful action. Hands control to the other side.
    this.state.currentPlayer = (this.state.currentPlayer === 'player') ? 'enemy' : 'player'
    this.state.actionTaken   = false
    this.state.turnNumber   += 1
    this.onTurnChange(this.state.currentPlayer)
END CLASS
```

### `src/ui/TurnLabel.js`

```text
CLASS TurnLabel
  CONSTRUCTOR(scene, anchor):
    this.text = scene.add.text(anchor.x, anchor.y, '', {
      fontFamily: 'sans-serif',
      fontSize:   '24px',
      color:      '#ffffff',
    })

  FUNCTION update(currentPlayer):
    this.text.setText('Turn: ' + currentPlayer.toUpperCase())
END CLASS
```

### `GameScene.create()` patch (built on Stage 3)

```text
FUNCTION create():
  // ... Stage 3 setup as before ...

  this.turnLabel   = new TurnLabel(this, { x: 16, y: 16 })
  this.turnManager = new TurnManager({
    startingPlayer: 'player',
    onTurnChange:   (who) => this.turnLabel.update(who),
  })
```

### `handleStroke` patch — gate build actions on the manager

```text
FUNCTION handleStroke(stroke):
  LET classification = this.classifier.classify(stroke)
  IF classification.kind === 'invalid': RETURN

  // Stage 4: only the current player may build, and only once per turn.
  IF NOT this.turnManager.beginAction('player'): RETURN

  LET entity = null
  IF classification.kind === 'shield':
    entity = createShield(this, 'player', classification)
  ELSE IF classification.kind === 'turret' OR classification.kind === 'fighter':
    entity = createWeapon(this, 'player', classification)

  IF entity IS null:
    // Placement was rejected — refund the action so the player can try again.
    this.turnManager.release()
    RETURN

  registerEntity(this, entity)
  this.turnManager.endTurn()
```

### Stage 5/6 contract (referenced, not implemented here)

```text
// When Stage 5 wires up drag-to-attack, it MUST follow this protocol:
//
//   IF NOT turnManager.beginAction(weapon.owner): RETURN
//   ... run the aim drag ...
//   IF release was on yellow target:
//       resolve hit; turnManager.endTurn()
//   ELSE  // red, empty space, or cancelled
//       turnManager.release()
```

## Integration notes

- `beginAction` / `endTurn` / `release` is the **only** state-transition API
  exposed by the manager. Stages 5, 6, and 8 must use it.
- For the MVP both sides are hot-seat on the same mouse — the enemy "turn" is
  driven by the same player. The label still flips so it's clear whose turn it
  is. Stage 8 will replace the enemy turn with an AI tick.
- The "refund on rejection" branch in `handleStroke` is important: a stroke
  that's geometrically valid but spatially invalid (overlap, wrong zone, cap
  reached) should not waste the player's turn.
- `turnNumber` is exposed so future debugging tools or replay logs can refer
  back to a specific turn.

## Acceptance check

- [ ] At game start the label reads `Turn: PLAYER`.
- [ ] After a successful build, the label reads `Turn: ENEMY` and any further
      pointer input on the player half is ignored.
- [ ] After the enemy hot-seats their action, the label flips back to
      `Turn: PLAYER`.
- [ ] A rejected placement (overlap / cap / wrong zone) leaves the label
      unchanged and lets the player try again.
- [ ] No code path can mutate `currentPlayer` or `actionTaken` without going
      through `TurnManager`.
