import { GameState } from "../app/GameState";
import { SETTLEMENT_GROWTH } from "../config/balanceConfig";
import { Building } from "../entities/Building";
import { addEvent } from "./EventSystem";
import { hasTechnology } from "./TechnologySystem";

interface HouseUpgrade {
  level: number;
  label: string;
  capacity: number;
  population: number;
  technology: string;
  wood: number;
  stone: number;
}

export const HOUSE_UPGRADES: HouseUpgrade[] = [
  { level: 2, label: "ruim huis", capacity: 7, population: 12, technology: "woodworking", wood: 10, stone: 2 },
  { level: 3, label: "rijhuis", capacity: 12, population: 35, technology: "masonry", wood: 16, stone: 10 },
  { level: 4, label: "stadshuis", capacity: 20, population: 80, technology: "industry", wood: 24, stone: 20 }
];

export function updateHousingUpgrades(state: GameState, dt: number): void {
  state.housingUpgradeTimer -= dt;
  if (state.housingUpgradeTimer > 0 || state.fires.length > 0) return;
  state.housingUpgradeTimer = 28;

  const upgradeBudget = Math.min(
    SETTLEMENT_GROWTH.maxHousingUpgradesPerCycle,
    Math.max(1, Math.ceil(state.settlements.length / SETTLEMENT_GROWTH.settlementsPerUpgrade))
  );
  const upgradedSettlements = new Set<string>();
  for (let index = 0; index < upgradeBudget; index += 1) {
    const candidate = findUpgradeCandidate(state, upgradedSettlements);
    if (!candidate) break;
    const { house, upgrade } = candidate;
    state.resources.wood -= upgrade.wood;
    state.resources.stone -= upgrade.stone;
    house.upgradeLevel = upgrade.level;
    house.capacity = upgrade.capacity;
    house.maxHealth += upgrade.level >= 3 ? 12 : 5;
    house.health = house.maxHealth;
    house.productionTimer = 0;
    house.emergencyBuilt = false;
    const settlement = state.settlements.find((item) => item.id === house.settlementId);
    if (settlement) upgradedSettlements.add(settlement.id);
    addEvent(
      state,
      `${settlement?.name ?? state.world.name} verbouwde een huis tot ${upgrade.label}: ${upgrade.capacity} slaapplaatsen.`
    );
  }
}

function findUpgradeCandidate(
  state: GameState,
  excludedSettlements = new Set<string>()
): { house: Building; upgrade: HouseUpgrade } | undefined {
  const houses = state.buildings
    .filter(
      (building) =>
        building.type === "house" &&
        building.status === "complete" &&
        !!building.civilizationId &&
        !!building.settlementId &&
        !excludedSettlements.has(building.settlementId) &&
        (building.upgradeLevel ?? 1) < HOUSE_UPGRADES.length + 1
    )
    .sort((a, b) => upgradePriority(state, b) - upgradePriority(state, a) || a.id.localeCompare(b.id));

  for (const house of houses) {
    const upgrade = HOUSE_UPGRADES.find((item) => item.level === (house.upgradeLevel ?? 1) + 1);
    const settlement = state.settlements.find((item) => item.id === house.settlementId);
    const civilization = state.civilizations.find((item) => item.id === house.civilizationId);
    if (!upgrade || !settlement || settlement.population < upgrade.population || !hasTechnology(civilization, upgrade.technology)) continue;
    const woodReserve = Math.max(20, settlement.population * 0.35);
    const stoneReserve = upgrade.level >= 3 ? 10 : 2;
    if (state.resources.wood < upgrade.wood + woodReserve || state.resources.stone < upgrade.stone + stoneReserve) continue;
    return { house, upgrade };
  }
  return undefined;
}

function upgradePriority(state: GameState, house: Building): number {
  const settlement = state.settlements.find((item) => item.id === house.settlementId);
  if (!settlement) return 0;
  const shortage = Math.max(0, settlement.population + SETTLEMENT_GROWTH.baseHousingReserve - settlement.housingCapacity);
  const capitalPenalty = state.civilizations.some((civilization) => civilization.capitalSettlementId === settlement.id) ? 0 : 2;
  return shortage * 3 + settlement.population * 0.04 + capitalPenalty - (house.upgradeLevel ?? 1);
}

export function houseUpgradeLabel(house: Building): string {
  switch (house.upgradeLevel ?? 1) {
    case 2:
      return "Ruim huis";
    case 3:
      return "Rijhuis";
    case 4:
      return "Stadshuis";
    default:
      return "Huis";
  }
}
