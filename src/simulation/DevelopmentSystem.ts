import { createBuildingAt, GameState } from "../app/GameState";
import {
  CASTLE_LEVELS,
  DEVELOPMENT_UPDATE_INTERVAL,
  DevelopmentStage,
  developmentStageFor,
  developmentStageRank
} from "../config/developmentConfig";
import { Building, BuildingType } from "../entities/Building";
import { Civilization, GovernmentType, Settlement } from "../entities/Civilization";
import { Point, rectsOverlap } from "../utils/MathUtils";
import { isWalkableTile } from "../world/Tile";
import { getTile } from "../world/World";
import { addEvent } from "./EventSystem";
import { addHistoricalEvent } from "./HistorySystem";
import { findBuildingSpot } from "./SettlementPlanner";
import { hasTechnology } from "./TechnologySystem";

const DEFENSE_TYPES: BuildingType[] = ["wall", "gate"];

export function updateDevelopment(state: GameState, dt: number): void {
  state.civilizationTimers.development -= dt;
  if (state.civilizationTimers.development > 0) return;
  state.civilizationTimers.development = DEVELOPMENT_UPDATE_INTERVAL;

  for (const civilization of state.civilizations) {
    const settlements = state.settlements.filter((settlement) => settlement.civilizationId === civilization.id);
    const stage = developmentStageFor(civilization, settlements);
    civilization.government = governmentForStage(stage.id, civilization.government);
    civilization.debugDecision = `fase ${stage.label.toLowerCase()} · ${civilization.strategicGoals.join(", ")}`;
    if (civilization.id === state.civilizations[0]?.id) {
      state.civilization.level = developmentStageRank(stage.id);
      state.civilization.title = stage.label;
    }

    const capital = settlements.find((settlement) => settlement.id === civilization.capitalSettlementId);
    if (!capital) continue;
    if (settlements.some((settlement) => settlement.recovery && settlement.recovery.state !== "normal")) continue;
    ensureCapitalCastle(state, civilization, capital, stage.id);
    updateFortifications(state, civilization, capital, stage.id);
  }
}

function ensureCapitalCastle(
  state: GameState,
  civilization: Civilization,
  capital: Settlement,
  stage: DevelopmentStage
): void {
  if (developmentStageRank(stage) < developmentStageRank("fortifiedVillage")) return;
  const castle = state.buildings.find(
    (building) => building.type === "castle" && building.civilizationId === civilization.id
  );
  if (!castle) {
    const spot = findBuildingSpot(state, "castle", { x: capital.centerX, y: capital.centerY });
    if (!spot) return;
    const planned = createBuildingAt(state, "castle", spot.x, spot.y);
    planned.civilizationId = civilization.id;
    planned.settlementId = capital.id;
    planned.visualEra = "wood";
    capital.buildingIds.push(planned.id);
    addEvent(state, `${capital.name} begon aan een centraal houten fort.`);
    return;
  }
  if (castle.status !== "complete" || castle.upgradeTargetLevel) return;
  const currentLevel = castle.upgradeLevel ?? 1;
  const next = CASTLE_LEVELS.find((level) => level.level === currentLevel + 1);
  if (!next || developmentStageRank(stage) < developmentStageRank(next.stage)) return;
  if (next.level >= 2 && !hasTechnology(civilization, "masonry")) return;
  if (next.level >= 4 && !hasTechnology(civilization, "fortification")) return;
  if (!canAfford(state, next.costs)) return;
  spend(state, next.costs);
  castle.upgradeTargetLevel = next.level;
  castle.status = "building";
  castle.progress = 0;
  castle.workRequired = 70 + next.level * 38;
  addEvent(state, `Bewoners van ${capital.name} breiden het kasteel uit tot ${next.label}.`);
}

function updateFortifications(
  state: GameState,
  civilization: Civilization,
  settlement: Settlement,
  stage: DevelopmentStage
): void {
  if (developmentStageRank(stage) < developmentStageRank("fortifiedVillage")) return;
  const existingDefense = state.buildings.filter(
    (building) => building.settlementId === settlement.id && DEFENSE_TYPES.includes(building.type)
  );
  const targetLevel = developmentStageRank(stage) >= developmentStageRank("empire")
    ? 3
    : hasTechnology(civilization, "masonry")
      ? 2
      : 1;
  const upgrade = existingDefense.find(
    (building) =>
      building.status === "complete" &&
      !building.upgradeTargetLevel &&
      (building.upgradeLevel ?? 1) < targetLevel
  );
  if (upgrade) {
    const costs = targetLevel >= 3 ? { wood: 1, food: 0, stone: 5 } : { wood: 1, food: 0, stone: 3 };
    if (!canAfford(state, costs)) return;
    spend(state, costs);
    upgrade.upgradeTargetLevel = (upgrade.upgradeLevel ?? 1) + 1;
    upgrade.status = "building";
    upgrade.progress = 0;
    upgrade.workRequired = upgrade.type === "gate" ? 20 : 9;
    return;
  }
  if (existingDefense.some((building) => building.status !== "complete")) return;

  const rings = developmentStageRank(stage) >= developmentStageRank("kingdom") ? [3, 6] : [3];
  const candidates = rings.flatMap((padding) => defenseRing(state, settlement, padding));
  const missing = candidates.find(
    (candidate) =>
      !state.buildings.some(
        (building) =>
          building.settlementId === settlement.id &&
          building.type === candidate.type &&
          building.x === candidate.x &&
          building.y === candidate.y
      ) && canPlaceDefense(state, candidate)
  );
  if (!missing) {
    const alreadyLogged = state.historicEvents.some(
      (event) => event.type === "fortificationBuilt" && event.settlementId === settlement.id
    );
    if (!alreadyLogged && existingDefense.length >= 12) {
      addHistoricalEvent(state, "fortificationBuilt", `${settlement.name} voltooide zijn verdedigingsring.`, {
        civilizationId: civilization.id,
        settlementId: settlement.id,
        x: settlement.centerX,
        y: settlement.centerY
      });
    }
    return;
  }
  const building = createBuildingAt(state, missing.type, missing.x, missing.y);
  building.civilizationId = civilization.id;
  building.settlementId = settlement.id;
  building.visualEra = "wood";
  settlement.buildingIds.push(building.id);
}

function defenseRing(state: GameState, settlement: Settlement, padding: number): Array<Point & { type: "wall" | "gate" }> {
  const core = state.buildings.filter(
    (building) => building.settlementId === settlement.id && !DEFENSE_TYPES.includes(building.type)
  );
  const minX = Math.floor(Math.min(settlement.centerX - 6, ...core.map((building) => building.x)) - padding);
  const maxX = Math.ceil(Math.max(settlement.centerX + 6, ...core.map((building) => building.x + building.width - 1)) + padding);
  const minY = Math.floor(Math.min(settlement.centerY - 6, ...core.map((building) => building.y)) - padding);
  const maxY = Math.ceil(Math.max(settlement.centerY + 6, ...core.map((building) => building.y + building.height - 1)) + padding);
  const gateX = Math.floor((minX + maxX) / 2) - 1;
  const candidates: Array<Point & { type: "wall" | "gate" }> = [{ x: gateX, y: maxY, type: "gate" }];
  for (let x = minX; x <= maxX; x += 1) {
    candidates.push({ x, y: minY, type: "wall" });
    if (x !== gateX && x !== gateX + 1) candidates.push({ x, y: maxY, type: "wall" });
  }
  for (let y = minY + 1; y < maxY; y += 1) {
    candidates.push({ x: minX, y, type: "wall" }, { x: maxX, y, type: "wall" });
  }
  return candidates;
}

function canPlaceDefense(state: GameState, candidate: Point & { type: "wall" | "gate" }): boolean {
  const width = candidate.type === "gate" ? 2 : 1;
  const rect = { x: candidate.x, y: candidate.y, width, height: 1 };
  if (candidate.x < 1 || candidate.y < 1 || candidate.x + width >= state.world.width - 1 || candidate.y >= state.world.height - 1) {
    return false;
  }
  if (state.buildings.some((building) => rectsOverlap(rect, building))) return false;
  for (let x = candidate.x; x < candidate.x + width; x += 1) {
    const tile = getTile(state.world, x, candidate.y);
    if (!tile || !isWalkableTile(tile)) return false;
  }
  return true;
}

function governmentForStage(stage: DevelopmentStage, current: GovernmentType): GovernmentType {
  if (stage === "empire") return "empire";
  if (stage === "kingdom" || stage === "capital") return current === "republic" ? "republic" : "kingdom";
  if (stage === "city" || stage === "fortifiedVillage") return "chiefdom";
  return "tribe";
}

function canAfford(state: GameState, costs: { wood: number; food: number; stone: number }): boolean {
  return state.resources.wood >= costs.wood && state.resources.food >= costs.food && state.resources.stone >= costs.stone;
}

function spend(state: GameState, costs: { wood: number; food: number; stone: number }): void {
  state.resources.wood -= costs.wood;
  state.resources.food -= costs.food;
  state.resources.stone -= costs.stone;
}
