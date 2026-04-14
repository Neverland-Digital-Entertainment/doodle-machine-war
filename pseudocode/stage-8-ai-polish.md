# Stage 8 — AI, Animations & SFX (Secondary)

## Goal

Replace the hot-seat enemy with a heuristic AI, add visual polish (projectile
trails, explosions, ink fade), and add basic sound effects. **All AI actions
must still flow through `TurnManager.beginAction` / `endTurn`.** No machine
learning.

## Inputs / Outputs

- **Inputs:** the live battlefield state (`scene.entities.*`), the
  `TurnManager` from Stage 4, and the `Raycaster` from Stage 5.
- **Outputs:**
  - An `EnemyAI` that takes one action per enemy turn.
  - Particle effects on hit/destroy.
  - Stroke ink fades smoothly out (Stage 1 hook is already in place).
  - A `SoundManager` wrapping a small set of effect sounds.

## Data structures

```text
PlannedAction =
  | { kind: 'attack',  weapon: Entity, targetPoint: { x, y } }
  | { kind: 'deploy',  weaponKind: 'turret' | 'fighter', center: { x, y }, sizeMetric: Number }
  | { kind: 'shield',  center: { x, y }, width: Number }
  | { kind: 'pass'    }                  // no legal moves — should be rare
```

## Pseudocode modules

### `src/systems/EnemyAI.js`

```text
CLASS EnemyAI
  CONSTRUCTOR(scene, raycaster, turnManager, getAllEntities):
    this.scene          = scene
    this.raycaster      = raycaster
    this.turnManager    = turnManager
    this.getAllEntities = getAllEntities

  // Called by GameScene whenever the turn flips to 'enemy'.
  FUNCTION takeTurn():
    IF NOT this.turnManager.beginAction('enemy'): RETURN
    LET plan = this.planAction()
    this.execute(plan)

  FUNCTION planAction() -> PlannedAction:
    // Priority 1: shoot anything I can reach with a clear line.
    LET enemyWeapons = this.getAllEntities().filter(e => e.alive AND e.owner === 'enemy' AND (e.kind === 'turret' OR e.kind === 'fighter'))
    FOR EACH w IN enemyWeapons:
      LET shot = this.findClearShot(w)
      IF shot:
        RETURN { kind: 'attack', weapon: w, targetPoint: shot.point }

    // Priority 2: I have fewer than N weapons → deploy one in a safe spot.
    IF count(enemyWeapons) < 3:
      LET spot = findSafeDeploySpot(this.scene, 'enemy')
      IF spot:
        RETURN { kind: 'deploy', weaponKind: 'turret', center: spot, sizeMetric: WEAPON.turret.radiusPx }

    // Priority 3: protect my highest-value weapon with a shield.
    LET key = pickKeyWeapon(enemyWeapons)
    IF key:
      LET shieldRect = shieldRectInFrontOf(key, 'enemy')
      IF shieldRect AND canPlace(shieldRect, 'enemy') AND countShieldsOf('enemy') < SHIELD.maxPerSide:
        RETURN { kind: 'shield', center: rectCenter(shieldRect), width: shieldRect.width }

    RETURN { kind: 'pass' }

  FUNCTION findClearShot(weapon) -> RayHit | null:
    // Try the centroid of every alive player-owned entity. First clean hit wins.
    LET targets = this.getAllEntities().filter(e => e.alive AND e.owner === 'player')
    FOR EACH t IN targets:
      LET hit = this.raycaster.cast(weapon.center, t.center, this.getAllEntities(), weapon.id)
      IF hit AND hit.entity.id === t.id:    // line was actually clear to t
        RETURN hit
    RETURN null

  FUNCTION execute(plan):
    SWITCH plan.kind:
      CASE 'attack':
        // Synthesize a "yellow release" via the same code path the player uses.
        runAttackSequence(this.scene, plan.weapon, plan.targetPoint)
        // runAttackSequence is responsible for calling turnManager.endTurn().
        RETURN
      CASE 'deploy':
        LET classification = { kind: plan.weaponKind, bbox: bboxAround(plan.center, plan.sizeMetric), center: plan.center, sizeMetric: plan.sizeMetric }
        LET entity = createWeapon(this.scene, 'enemy', classification)
        IF entity:
          registerEntity(this.scene, entity)
          this.turnManager.endTurn()
        ELSE:
          this.turnManager.release()
        RETURN
      CASE 'shield':
        LET classification = { kind: 'shield', bbox: shieldBboxAround(plan.center, plan.width), center: plan.center, sizeMetric: plan.width }
        LET entity = createShield(this.scene, 'enemy', classification)
        IF entity:
          registerEntity(this.scene, entity)
          this.turnManager.endTurn()
        ELSE:
          this.turnManager.release()
        RETURN
      CASE 'pass':
        // Truly nothing to do — release so the player can play again. The
        // game is probably about to detect a stalemate (Stage 7 optional).
        this.turnManager.release()
        // Force a turn flip anyway to avoid a dead-locked game.
        this.turnManager.endTurn()
        RETURN
END CLASS
```

### `GameScene` patch — drive the AI on enemy turns

```text
FUNCTION create():
  // ... Stage 7 setup ...
  this.ai = new EnemyAI(this, this.raycaster, this.turnManager, () => allEntitiesView(this))
  this.turnManager.onTurnChange = (who) => {
    this.turnLabel.update(who)
    IF who === 'enemy':
      // Defer one tick so the previous tween/animation finishes cleanly.
      this.time.delayedCall(400, () => this.ai.takeTurn())
  }
```

### `src/ui/Effects.js` — particle polish

```text
CLASS Effects
  CONSTRUCTOR(scene):
    this.scene = scene
    this.explosionEmitter = scene.add.particles(0, 0, 'pixel', {
      speed:    { min: 60, max: 180 },
      lifespan: 350,
      quantity: 18,
      scale:    { start: 1.4, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    })

  FUNCTION explosionAt(point):
    this.explosionEmitter.emitParticleAt(point.x, point.y)

  FUNCTION projectileTrail(from, to, color):
    // A short tween of a Graphics dot already exists in Stage 5; here we add
    // a fading line behind it.
    LET trail = this.scene.add.graphics()
    trail.lineStyle(2, color, 1)
    trail.beginPath(); trail.moveTo(from.x, from.y); trail.lineTo(to.x, to.y); trail.strokePath()
    this.scene.tweens.add({
      targets:  trail,
      alpha:    0,
      duration: 220,
      onComplete: () => trail.destroy(),
    })
END CLASS
```

> The `'pixel'` texture is a 1x1 white pixel generated in `BootScene.preload`
> via `this.textures.generate('pixel', { data: ['1'], pixelWidth: 4 })` —
> still no asset files needed.

### `src/systems/SoundManager.js`

```text
CLASS SoundManager
  CONSTRUCTOR():
    // Either Phaser.Sound (needs files) or Web Audio API for synth bleeps.
    // For zero-asset MVP, prefer synth via OscillatorNodes.
    this.audioCtx = new AudioContext()

  FUNCTION beep(freq, durationMs, type = 'square', gain = 0.05):
    LET osc  = this.audioCtx.createOscillator()
    LET amp  = this.audioCtx.createGain()
    osc.type = type
    osc.frequency.value = freq
    amp.gain.value      = gain
    osc.connect(amp).connect(this.audioCtx.destination)
    osc.start()
    osc.stop(this.audioCtx.currentTime + durationMs / 1000)

  FUNCTION drawTick(): this.beep(880, 30, 'triangle', 0.02)
  FUNCTION fire():     this.beep(220, 80, 'square',   0.05)
  FUNCTION hit():      this.beep(120, 120, 'sawtooth', 0.08)
  FUNCTION destroy():  this.beep(80,  220, 'sawtooth', 0.10)
END CLASS
```

### Wiring into existing stages

```text
// DrawingInput.handleMove: call sound.drawTick() once per N pixels of movement
//                          (debounced) so the ink trail has audible feedback.
//
// AttackController.fireProjectile:
//   sound.fire()
//   onComplete (after the dot tween) → effects.explosionAt(to); sound.hit()
//
// AttackController.resolveHit (entity is destroyed):
//   sound.destroy()
//
// DrawingInput.handleUp: existing `clearInk(graphics, fadeMs)` already supports
// a tween fade. Stage 8 simply enables a non-zero `fadeMs` (e.g. 180).
```

## Integration notes

- The AI never bypasses `TurnManager`. Every branch of `execute` either calls
  `endTurn()` on success or `release()` on failure. `'pass'` is the safety
  valve — it forces a flip so the game can't deadlock.
- The AI uses **the same** `Raycaster`, `createWeapon`, `createShield`, and
  `registerEntity` functions as the player. There is no second world-state
  for the AI side.
- All polish modules (`Effects`, `SoundManager`) are pure-additive — Stages
  0–7 run unchanged if they're stripped out. Keep them that way.
- Keep `gain` low on the `SoundManager` — synth squares get loud fast and we
  don't want to annoy testers.
- If the AI's `findClearShot` is too greedy (e.g. always hitting the same
  shield), add a small randomization or a short-term memory of recent targets.
  Defer that tuning until you actually see the issue in playtesting.

## Acceptance check

- [ ] After the player ends their turn, the AI takes exactly one action and
      the turn flips back to the player.
- [ ] AI prefers shooting when a clean line of sight exists.
- [ ] AI deploys a weapon when it has none and no clean shot exists.
- [ ] AI builds shields to protect its weapons when both prior priorities fail.
- [ ] Successful hits play an explosion particle burst.
- [ ] Successful hits and destroys make distinct sounds.
- [ ] Drawing produces a soft tick sound and the ink fades out smoothly.
- [ ] Removing `Effects` and `SoundManager` does not break gameplay.
