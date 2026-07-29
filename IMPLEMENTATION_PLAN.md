# Tiny World Civilization Expansion Plan

## Context

Tiny World is een lokale Vite/TypeScript/Canvas-simulator met een centrale `GameState`, seeded randomness, tile-based world data, A* pathfinding, fysieke villagers/buildings, lokale resources, localStorage saves, and deterministic Vitest coverage. The expansion will keep the existing individual villager simulation intact and add settlement/civilization layers above it.

## Architecture Principles

- Keep three levels separated:
  - Individuals: existing villagers keep local gathering, hauling, building, resting, fleeing and later soldier tasks.
  - Settlements: aggregate population, housing, production, food security, defense, local projects and migration.
  - Civilizations: manage multiple settlements, territory, traits, research, diplomacy, trade, armies, wars and stability.
- Run macro systems on explicit timers instead of every frame.
- Keep physical simulation for visible events such as colonist groups, caravans and armies.
- Keep saves backward-compatible through migrations.
- Use local templates, seeded randomness and data-driven config only.

## Phase 1 - Civilization And Settlement Foundation

Status: complete and validated (`npm run test`, `npm run typecheck`, `npm run build`).

- Add central civilization, settlement, territory, diplomacy/history/map-mode data structures.
- Initialize the first civilization and settlement from existing worlds.
- Assign existing villagers/buildings to that settlement.
- Add seeded civilization names, colors, traits and government.
- Add political map overlay, civilization/settlement UI, inspector details and history log.
- Save/load and migrate old saves.
- Tests: civilization creation, settlement synchronization, territory assignment, save migration.

## Phase 2 - Growth And Colonization

Status: complete and validated (`npm run test`, `npm run typecheck`, `npm run build`).

- Add settlement tier rules not based only on population.
- Add expansion location scoring.
- Add physical colonist groups that reserve resources, travel, found camps and connect settlements.
- Update the planner to build around each settlement instead of only world spawn.
- Add roads between settlements and basic migration groups.
- Tests: tier progression, expansion scoring, colony founding, road connection, migration invariants.

## Phase 3 - Technology And Macro Economy

Status: complete and validated (`npm run test`, `npm run typecheck`, `npm run build`).

- Add data-driven technology definitions and eras.
- Add settlement-level macro economy with food, wood, stone, metal, tools, wealth and research.
- Add research selection by needs and traits.
- Technology unlocks must have measurable/visible effects.
- Add technology panel and building/road visual variants.
- Tests: prerequisites, research choice, unlock effects, deterministic research progress.

## Phase 4 - Trade And Diplomacy

Status: complete and validated (`npm run test`, `npm run typecheck`, `npm run build`).

- Add asymmetric diplomatic relations.
- Add discovery, relation modifiers, treaty/trade eligibility and physical caravans.
- Add trade routes that improve wealth, relations and research spread.
- Add diplomacy UI and map modes.
- Tests: trade eligibility, relation drift, caravan creation, route interruption.

## Phase 5 - Armies And Defense

Status: complete and validated (`npm run test`, `npm run typecheck`, `npm run build`).

- Add soldier job/mobilization rules and army entities.
- Add army movement, morale, supply consumption and defensive stance.
- Add fortification effects and visible banners.
- Tests: army supply, mobilization caps, defensive strength.

## Phase 6 - War And Peace

Status: complete and validated (`npm run test`, `npm run typecheck`, `npm run build`).

- Add war desirability scoring with concrete goals.
- Add war declarations, battles, sieges, settlement capture and war exhaustion.
- Add peace evaluation and outcomes.
- Tests: war desirability, battle calculation, siege/capture, peace evaluation.

## Phase 7 - Stability And Collapse

Status: complete and validated (`npm run test`, `npm run typecheck`, `npm run build`).

- Add administrative pressure, local unrest, rebellions, secessions, civil wars and collapse.
- Add ruins and possible recolonization.
- Tests: rebellion chance, secession logic, collapse cleanup.

## Phase 8 - Polish, Balance And Reporting

Status: complete and validated (`npm run test`, `npm run typecheck`, `npm run build`).

- Add broader history filters, world statistics, debug overlays and local simulation reports.
- Add long deterministic headless simulation checks.
- Tune growth caps, colonization costs, research pace, diplomacy, war and stability.
- Update documentation.

## Validation Rhythm

After each implemented phase:

1. `npm run test`
2. `npm run typecheck`
3. `npm run build`

Fix regressions before moving to the next phase.
