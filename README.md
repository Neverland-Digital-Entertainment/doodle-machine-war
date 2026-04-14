# Doodle Machine War

> A turn-based line-drawing strategy game built with Phaser 3.

Players command mechanical battlefield units — weapons and shields — by drawing simple lines and shapes on screen. Hand-drawn commands are translated into machine actions, creating a contrast between human input and mechanical execution.

---

## Gameplay Overview

**Genre:** Turn-based line-drawing strategy
**Platform:** Web (Phaser 3)
**Theme:** Machines

Each turn, a player performs exactly **one action** — placing a shield, deploying a weapon, or launching an attack. Victory goes to whoever destroys all 4 of the opponent's base HP nodes.

---

## Core Design Principles

- Minimal rules, maximum emergent strategy
- No complex recognition — geometry and regions only
- Learn by playing, not by reading tutorials
- Physical intuition over digital UI systems
- Preserves the feel of pen and paper

---

## Layout

The battlefield is in portrait orientation, split into two zones:

```
┌────────────────────┐
│   Enemy Zone (top) │
├────────────────────┤
│     Dividing Line  │
├────────────────────┤
│  Player Zone (bot) │
└────────────────────┘
```

The **Player Zone** contains:
- A **base** at the bottom with 4 HP nodes (B, A, S, E)
- A **build area** above the base for placing shields and weapons

---

## Player State

| Resource | Limit       |
|----------|-------------|
| Base HP  | 4 nodes     |
| Shields  | Max 3       |
| Weapons  | Unlimited (space permitting) |

---

## Turn System

- Players alternate turns
- Each turn = **exactly 1 action**

---

## Player Actions

### Build a Shield

Draw a **horizontal line** across the screen.

- Detected when the bounding box width spans the left-to-right threshold
- Spawns a shield at the drawn Y coordinate
- Max 3 shields active at once
- Blocks incoming attacks

### Deploy a Weapon

Draw a shape in empty space:

| Shape    | Unit     |
|----------|----------|
| Triangle | Fighter  |
| Circle   | Turret   |

- Must not overlap existing objects
- Start and end points must be within a valid area
- Weapon spawns at the shape's center point
- Persistent — not consumed on use, but can be destroyed

### Attack

Drag from a weapon to a valid enemy target.

- System performs an instant raycast from the weapon's position
- First collision detected determines the hit target

---

## Raycast & Collision Rules

**Collision priority (first hit wins):**

1. Shield
2. Weapon
3. Base

**Blocking rules:**

All objects — both yours and the enemy's — block all raycasts. Positioning is the core strategic lever.

---

## UX Feedback System

No tutorial needed — the highlight system teaches through play:

| Highlight | Meaning                          |
|-----------|----------------------------------|
| Yellow    | Valid attack path (enemy target) |
| Red       | Blocked by own object            |

---

## Attack Resolution

When the pointer is released on a valid target:

1. A projectile animation fires
2. The target is destroyed (weapon/shield) or base HP is reduced
3. Turn ends

---

## Shield System

- Physical barrier — blocks any attack passing through it
- Destroyed in one hit
- Max 3 per player

**Strategic uses:** protect weapons, control space, slow down the opponent.

---

## Weapon System

- Persistent attack origin point
- Not consumed after firing
- Can be targeted and destroyed by the enemy

**Strategic considerations:** front-line vs. back-line placement, avoiding self-blocking lines of fire.

---

## Emergent Game Flow

Players naturally discover strategy through feedback, not instructions:

1. Deploy weapon → attack
2. Opponent builds a shield → attack blocked
3. Player destroys the shield → their weapon gets destroyed in retaliation
4. Player learns to protect their weapons behind shields

---

## Technical Implementation (Phaser 3)

| System       | API Used                                        |
|--------------|-------------------------------------------------|
| Drawing      | `Phaser.GameObjects.Graphics`                  |
| Raycasting   | `Phaser.Geom.Line` + `Phaser.Geom.Intersects.LineToRectangle` |
| Collision    | Bounding box (rectangle)                        |

---

## Safety & Edge Case Handling

- Minimum stroke length threshold to prevent tap misreads
- Rectangle-to-rectangle overlap prevention for object placement
- Pointer event handling: `pointerup`, `pointerupoutside`, `pointerout`

---

## MVP Feature Priorities

### Core (Must-Have)
- [x] Drawing input system
- [x] Weapon placement
- [x] Shield placement
- [x] Raycast-based attack
- [x] Yellow/red highlight feedback
- [x] HP system
- [x] Win condition

### Secondary
- [ ] AI opponent
- [ ] Animations polish
- [ ] Sound effects

---

## Win Condition

Destroy all **4 base HP nodes** of the opponent.

---

## Key Innovations

- **Drawing as input** — sketch commands become machine actions
- **Real-time raycast feedback** — instant visual validation before committing an attack
- **Self-blocking spatial strategy** — your own units can obstruct your attacks
- **Emergent learning** — no tutorial required; the highlight system teaches through consequence
- **Extreme simplicity, high depth** — few rules, rich decision-making
