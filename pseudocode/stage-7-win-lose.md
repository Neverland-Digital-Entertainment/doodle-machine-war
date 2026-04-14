# Stage 7 — Win/Lose & Game State

## Goal

Track HP per side, declare a winner when one side's base reaches 0 HP nodes,
and offer a restart. Optionally detect stalemates.

## Inputs / Outputs

- **Input:** base hits resolved by
  [Stage 5](./stage-5-raycast-attack.md)'s `AttackController.resolveHit`.
- **Output:**
  - Per-base `remainingHp()` shrinks as nodes die.
  - A `GameOverScene` (or in-place overlay) displays the winner.
  - A "Restart" control re-creates `GameScene` from scratch.

## Data structures

```text
GameOverPayload {
  winner: 'player' | 'enemy' | 'stalemate'
  finalTurnNumber: Number
}
```

## Pseudocode modules

### `Base` patch (built on Stage 3)

```text
// In src/entities/Base.js — already has takeHit(node) and remainingHp().
// Stage 7 just uses them.

FUNCTION isDestroyed() -> Boolean:
  RETURN this.remainingHp() === 0
```

### `AttackController.resolveHit` patch (built on Stage 5)

```text
FUNCTION resolveHit(target):
  IF target.kind === 'base':
    LET base = (target.owner === 'player')
                  ? this.scene.entities.bases.player
                  : this.scene.entities.bases.enemy
    base.takeHit(target)
    checkGameOver(this.scene)
  ELSE:
    target.alive = false
    target.graphics.destroy()

  // The Stage 5 contract continues: endTurn() is called by the projectile
  // tween's onComplete, AFTER this function. checkGameOver may have flipped
  // the scene to GameOverScene by then; in that case TurnManager is gone and
  // the endTurn call is a no-op (guarded below).
```

### `src/systems/GameStateChecker.js`

```text
FUNCTION checkGameOver(scene):
  LET playerHp = scene.entities.bases.player.remainingHp()
  LET enemyHp  = scene.entities.bases.enemy.remainingHp()

  IF playerHp === 0 AND enemyHp === 0:
    transitionToGameOver(scene, { winner: 'stalemate', finalTurnNumber: scene.turnManager.state.turnNumber })
    RETURN

  IF playerHp === 0:
    transitionToGameOver(scene, { winner: 'enemy',  finalTurnNumber: scene.turnManager.state.turnNumber })
    RETURN

  IF enemyHp === 0:
    transitionToGameOver(scene, { winner: 'player', finalTurnNumber: scene.turnManager.state.turnNumber })
    RETURN

  // Optional: stalemate detection — no legal move possible.
  IF NOT anyLegalMoveExists(scene, scene.turnManager.state.currentPlayer):
    transitionToGameOver(scene, { winner: 'stalemate', finalTurnNumber: scene.turnManager.state.turnNumber })

FUNCTION transitionToGameOver(scene, payload):
  scene.gameOver = true       // guards TurnManager.endTurn() from doing work
  scene.scene.start('GameOverScene', payload)

FUNCTION anyLegalMoveExists(scene, owner) -> Boolean:
  // Loose heuristic: a side has a legal move if any of these is true.
  //   1. They could draw a shield (cap not reached AND space exists).
  //   2. They could deploy a weapon (space exists in their build area).
  //   3. They own a weapon AND any enemy entity is reachable by some ray.
  // Implementing this fully is optional — for MVP, return true (i.e. never
  // declare a stalemate from move exhaustion).
  RETURN true
```

### `TurnManager.endTurn` guard

```text
FUNCTION endTurn():
  IF this.scene.gameOver: RETURN     // game is over — do not flip turns
  this.state.currentPlayer = (this.state.currentPlayer === 'player') ? 'enemy' : 'player'
  this.state.actionTaken   = false
  this.state.turnNumber   += 1
  this.onTurnChange(this.state.currentPlayer)
```

> Note: `TurnManager` does not own a reference to `scene` in Stage 4. Stage 7
> either (a) passes `scene` into the constructor or (b) lets the `endTurn`
> caller pass an `aborted` flag. Pick one convention and apply it everywhere.

### `src/scenes/GameOverScene.js`

```text
CLASS GameOverScene EXTENDS Phaser.Scene
  CONSTRUCTOR:
    super({ key: 'GameOverScene' })

  FUNCTION init(payload):
    this.payload = payload

  FUNCTION create():
    LET centerX = SCREEN.width / 2
    LET centerY = SCREEN.height / 2

    LET title = pickTitle(this.payload.winner)
    this.add.text(centerX, centerY - 80, title, {
      fontFamily: 'sans-serif', fontSize: '56px', color: '#ffffff',
    }).setOrigin(0.5)

    this.add.text(centerX, centerY, 'Turn ' + this.payload.finalTurnNumber, {
      fontFamily: 'sans-serif', fontSize: '24px', color: '#aaaaaa',
    }).setOrigin(0.5)

    LET button = this.add.text(centerX, centerY + 100, '[ Restart ]', {
      fontFamily: 'sans-serif', fontSize: '32px', color: '#66ff99',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    button.on('pointerup', () => {
      this.scene.start('GameScene')
    })
END CLASS

FUNCTION pickTitle(winner) -> String:
  IF winner === 'player':    RETURN 'PLAYER WINS'
  IF winner === 'enemy':     RETURN 'ENEMY WINS'
  RETURN 'STALEMATE'
```

### `main.js` registration

```text
// Stage 0's main.js registers BootScene + GameScene. Stage 7 adds GameOverScene.
LET config = {
  ...,
  scene: [BootScene, GameScene, GameOverScene],
}
```

## Integration notes

- The HP source of truth is the `Base.nodes` array. Do **not** track HP in a
  separate counter; it'll drift.
- `checkGameOver` is invoked from `resolveHit` so that the moment the killing
  blow lands, the transition is queued. The projectile tween's `onComplete`
  will still call `endTurn`, but the guarded version will short-circuit.
- `GameOverScene` uses `this.scene.start('GameScene')` to fully tear down and
  re-create the game state. Do NOT re-use the existing scene — that risks
  leaking entities, listeners, and graphics objects from the prior match.
- Optional stalemate detection is intentionally stubbed for MVP. If/when it's
  added, run it once per turn at the *start* of the new player's turn, not
  on every hit.

## Acceptance check

- [ ] A successful hit on a base node removes that node's rectangle from the
      battlefield.
- [ ] When the 4th base node falls, the game transitions to `GameOverScene`
      with the correct winner string.
- [ ] The scoreboard correctly identifies the winning side (player vs enemy).
- [ ] The Restart button returns to a fresh `GameScene` with full HP, no
      shields, no weapons, and turn 1 set to `player`.
- [ ] No console errors fire during the transition or the restart.
- [ ] `endTurn` does nothing once the game is over — the turn label stops
      flipping.
