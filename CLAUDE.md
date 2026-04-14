# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Doodle Machine War** — a turn-based line-drawing strategy game built with Phaser 3 (web). See `README.md` for the full game design spec.

## Status

Active development in phases. Currently completed:
- ✅ Phase 1: Project initialization
- ✅ Phase 2: Drawing input system with shape detection
- ✅ Phase 3: Game state management
- ✅ Phase 4: Unit system (shields and weapons)
- ✅ Phase 5: Raycast and attack system

## Development Workflow

### Per-Phase Delivery Rules

**After completing and testing each Phase:**

1. **Create a new branch** for the Phase (e.g., `feature/phase-X-description`)
2. **Commit all Phase changes** with descriptive commit message including Phase number and summary
3. **Push the branch** to GitHub (`git push origin feature/phase-X-description`)
4. **Create a Pull Request** on GitHub with:
   - Title: `Phase X: Feature Description`
   - Body: Summary of changes, test checklist, and notable implementations
   - Link back to development plan
5. **Merge to main** after PR review

### Commands

```bash
npm run dev      # Start development server (https://localhost:5173)
npm run build    # Production build
```

## Architecture

- **Entry**: `src/main.js` → Phaser 3 initialization
- **Scene**: `src/scenes/GameScene.js` → Main game logic
- **Systems**: `src/systems/` → GameState, DrawingSystem, UnitManager, RaycastSystem, CombatSystem
- **Entities**: `src/entities/` → Player, Shield, Weapon
- **Utils**: `src/utils/` → ShapeDetector (Douglas-Peucker polyline simplification)
