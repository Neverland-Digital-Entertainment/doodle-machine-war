# Doodle Machine War — Pseudocode

This directory holds the stage-by-stage pseudocode design for the game described
in [`../DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md). Each file corresponds to
one stage in that plan and is intended to be read **before** any JavaScript is
written for that stage. The pseudocode is JS-flavored but deliberately
non-executable — read it, do not run it.

> **Tech-stack reminder.** HTML + vanilla JavaScript + Phaser 3 only. No
> bundler, no TypeScript, no extra npm packages. Every block of pseudocode in
> this directory must be implementable inside that constraint.

## Reading order

Start at Stage 0 and walk forward. Each stage assumes the modules from the
previous stages already exist.

| Milestone            | Stages | Files                                                                                                    | Playable state                                       |
|----------------------|--------|----------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| **M1 — Drawable**    | 0–2    | [Stage 0](./stage-0-scaffolding.md), [Stage 1](./stage-1-drawing-input.md), [Stage 2](./stage-2-shape-classification.md) | Strokes are captured and classified                  |
| **M2 — Buildable**   | 3–4    | [Stage 3](./stage-3-battlefield-entities.md), [Stage 4](./stage-4-turn-manager.md)                       | Shields and weapons can be placed; turns alternate   |
| **M3 — Playable MVP**| 5–7    | [Stage 5](./stage-5-raycast-attack.md), [Stage 6](./stage-6-highlight-feedback.md), [Stage 7](./stage-7-win-lose.md) | Full hot-seat match with a win condition             |
| **M4 — Polished**    | 8      | [Stage 8](./stage-8-ai-polish.md)                                                                        | Heuristic AI, projectile/explosion FX, sound effects |

## Stage file template

Every `stage-N-*.md` file is structured the same way so you can scan a stage
quickly:

1. **Goal** — one-sentence restatement from `DEVELOPMENT_PLAN.md`.
2. **Inputs / Outputs** — what flows in, what artifacts and runtime state come
   out.
3. **Data structures** — JS-ish structs introduced by the stage.
4. **Pseudocode modules** — one fenced block per file the stage will add.
5. **Integration notes** — how the stage wires into earlier stages.
6. **Acceptance check** — checklist version of the plan's "Acceptance:" line.

## Cross-cutting rules to remember

- **One action per turn.** Stages 3, 5, 6, and 8 all route their actions
  through the `TurnManager` gate defined in
  [Stage 4](./stage-4-turn-manager.md). Do not invent parallel action paths.
- **Nearest hit wins.** The `Shield → Weapon → Base` list in the README is
  *visual* framing only. The actual rule, defined in
  [Stage 5](./stage-5-raycast-attack.md), is "closest intersection along the
  ray, regardless of entity type".
- **Free exploration.** Aim drags that resolve as red (self-blocked) or empty
  space must NOT consume a turn. See
  [Stage 6](./stage-6-highlight-feedback.md).
- **Pure `Graphics`.** No sprite assets are required for the MVP. Anything
  visual is drawn with `Phaser.GameObjects.Graphics`.
