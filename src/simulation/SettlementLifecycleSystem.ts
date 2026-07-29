import { GameState, releaseBuildingTiles } from "../app/GameState";
import { Building } from "../entities/Building";
import { Settlement } from "../entities/Civilization";
import { tileIndex } from "../world/World";
import { addHistoricalEvent } from "./HistorySystem";

export function removeEmptySettlements(state: GameState): void {
  const abandoned = state.settlements.filter((settlement) => settlement.population <= 0);
  if (abandoned.length === 0) return;
  const abandonedIds = new Set(abandoned.map((settlement) => settlement.id));
  const incompleteIds = new Set(
    state.buildings
      .filter((building) => abandonedIds.has(building.settlementId ?? "") && building.status !== "complete")
      .map((building) => building.id)
  );

  for (const building of state.buildings) {
    if (incompleteIds.has(building.id)) releaseBuildingTiles(state.world, building);
  }
  state.buildings = state.buildings.filter((building) => !incompleteIds.has(building.id));

  for (const settlement of abandoned) {
    for (const building of state.buildings) {
      if (building.settlementId === settlement.id) building.civilizationId = undefined;
    }
    addHistoricalEvent(state, "settlementAbandoned", `${settlement.name} raakte volledig verlaten. De overgebleven gebouwen staan nu leeg.`, {
      civilizationId: settlement.civilizationId,
      settlementId: settlement.id,
      x: settlement.centerX,
      y: settlement.centerY
    });
  }

  state.settlements = state.settlements.filter((settlement) => !abandonedIds.has(settlement.id));
  for (const settlement of state.settlements) {
    settlement.connectedSettlementIds = settlement.connectedSettlementIds.filter((id) => !abandonedIds.has(id));
  }
  for (const civilization of state.civilizations) {
    civilization.settlementIds = civilization.settlementIds.filter((id) => !abandonedIds.has(id));
    if (abandonedIds.has(civilization.capitalSettlementId)) {
      civilization.capitalSettlementId =
        state.settlements.find((settlement) => settlement.civilizationId === civilization.id)?.id ?? "";
    }
  }
  state.tradeRoutes = state.tradeRoutes.filter(
    (route) => !abandonedIds.has(route.fromSettlementId) && !abandonedIds.has(route.toSettlementId)
  );
  state.colonistGroups = state.colonistGroups.filter((group) => !abandonedIds.has(group.originSettlementId));
  state.migrationGroups = state.migrationGroups.filter(
    (group) => !abandonedIds.has(group.fromSettlementId) && !abandonedIds.has(group.toSettlementId)
  );
  for (const war of state.wars) {
    if (war.targetSettlementId && abandonedIds.has(war.targetSettlementId)) war.targetSettlementId = undefined;
    war.occupiedSettlementIds = war.occupiedSettlementIds.filter((id) => !abandonedIds.has(id));
  }
  for (const army of state.armies) {
    if (army.targetSettlementId && abandonedIds.has(army.targetSettlementId)) army.targetSettlementId = undefined;
  }
  if (state.selected.kind === "settlement" && abandonedIds.has(state.selected.id)) state.selected = { kind: "none" };
  state.territory.dirty = true;
  state.territory.recalculationTimer = 0;
}

export function claimAbandonedBuildings(state: GameState): void {
  for (const buildings of abandonedBuildingGroups(state).values()) {
    const representative = buildings[0];
    const centerX = Math.floor(representative.x + representative.width / 2);
    const centerY = Math.floor(representative.y + representative.height / 2);
    const ownerId = state.territory.ownerByTile[tileIndex(state.world, centerX, centerY)];
    if (!ownerId) continue;
    const settlement = nearestSettlement(state, centerX, centerY, ownerId);
    if (!settlement) continue;

    for (const building of buildings) {
      building.civilizationId = ownerId;
      building.settlementId = settlement.id;
      if (!settlement.buildingIds.includes(building.id)) settlement.buildingIds.push(building.id);
    }
    const civilization = state.civilizations.find((item) => item.id === ownerId);
    addHistoricalEvent(
      state,
      "ruinsClaimed",
      `${civilization?.name ?? "Een beschaving"} namen ${buildings.length} verlaten gebouwen bij ${settlement.name} over.`,
      {
        civilizationId: ownerId,
        settlementId: settlement.id,
        x: centerX,
        y: centerY
      }
    );
  }
}

function abandonedBuildingGroups(state: GameState): Map<string, Building[]> {
  const groups = new Map<string, Building[]>();
  for (const building of state.buildings) {
    if (building.civilizationId || building.status !== "complete" || building.health <= 0) continue;
    const key = building.settlementId ?? building.id;
    const group = groups.get(key) ?? [];
    group.push(building);
    groups.set(key, group);
  }
  return groups;
}

function nearestSettlement(state: GameState, x: number, y: number, civilizationId: string): Settlement | undefined {
  return state.settlements
    .filter((settlement) => settlement.civilizationId === civilizationId)
    .sort((a, b) => Math.hypot(a.centerX - x, a.centerY - y) - Math.hypot(b.centerX - x, b.centerY - y))[0];
}
