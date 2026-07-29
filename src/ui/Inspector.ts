import { GameState } from "../app/GameState";
import { BUILDING_DEFINITIONS, allMaterialsDelivered, costLabel } from "../entities/Building";
import { SETTLEMENT_TIER_LABELS } from "../config/settlementConfig";
import { describeState } from "../entities/Villager";
import { occupantsForHouse } from "../simulation/HousingSystem";
import { getTile, tileIndex } from "../world/World";

export function inspectorHtml(state: GameState): string {
  const selected = state.selected;
  if (selected.kind === "villager") {
    const villager = state.villagers.find((item) => item.id === selected.id);
    if (!villager) return emptyInspector();
    const carried = villager.carrying ? `${villager.carrying.amount} ${villager.carrying.type}` : "niets";
    const home = villager.homeId ? state.buildings.find((building) => building.id === villager.homeId)?.type ?? "onbekend" : "geen";
    return `
      <h2>${villager.name}</h2>
      <dl>
        <dt>Leeftijd</dt><dd>${Math.floor(villager.age)}</dd>
        <dt>Beroep</dt><dd>${villager.job}</dd>
        <dt>Taak</dt><dd>${describeState(villager.state)}</dd>
        <dt>Gezondheid</dt><dd>${Math.round(villager.health)}</dd>
        <dt>Honger</dt><dd>${Math.round(villager.hunger)}</dd>
        <dt>Energie</dt><dd>${Math.round(villager.energy)}</dd>
        <dt>Geluk</dt><dd>${Math.round(villager.happiness)}</dd>
        <dt>Draagt</dt><dd>${carried}</dd>
        <dt>Woonhuis</dt><dd>${home}</dd>
      </dl>
    `;
  }

  if (selected.kind === "building") {
    const building = state.buildings.find((item) => item.id === selected.id);
    if (!building) return emptyInspector();
    const definition = BUILDING_DEFINITIONS[building.type];
    const occupants = building.type === "house" ? occupantsForHouse(state, building.id).length : 0;
    const status = building.civilizationId ? building.status : "verlaten";
    return `
      <h2>${definition.label}</h2>
      <dl>
        <dt>Status</dt><dd>${status}</dd>
        <dt>Gezondheid</dt><dd>${Math.round(building.health)} / ${building.maxHealth}</dd>
        <dt>Voortgang</dt><dd>${Math.round((building.progress / building.workRequired) * 100)}%</dd>
        <dt>Materiaal</dt><dd>${allMaterialsDelivered(building) ? "klaar" : costLabel(building.type)}</dd>
        <dt>Bedden</dt><dd>${building.capacity > 0 ? `${occupants} / ${building.capacity}` : "-"}</dd>
        <dt>Opslagruimte</dt><dd>${building.storageCapacity}</dd>
        <dt>Productie</dt><dd>${building.civilizationId ? buildingProductionLabel(building.type) : "inactief"}</dd>
      </dl>
    `;
  }

  if (selected.kind === "settlement") {
    const settlement = state.settlements.find((item) => item.id === selected.id);
    if (!settlement) return emptyInspector();
    const civilization = state.civilizations.find((item) => item.id === settlement.civilizationId);
    const capital = civilization ? state.settlements.find((item) => item.id === civilization.capitalSettlementId) : undefined;
    const distanceToCapital =
      capital && capital.id !== settlement.id ? `${Math.round(Math.hypot(settlement.centerX - capital.centerX, settlement.centerY - capital.centerY))} tiles` : "hoofdstad";
    return `
      <h2>${settlement.name}</h2>
      <dl>
        <dt>Type</dt><dd>${SETTLEMENT_TIER_LABELS[settlement.tier]}</dd>
        <dt>Beschaving</dt><dd>${civilization?.name ?? "onbekend"}</dd>
        <dt>Bevolking</dt><dd>${settlement.population}</dd>
        <dt>Bedden</dt><dd>${settlement.housingCapacity}</dd>
        <dt>Voedselzekerheid</dt><dd>${Math.round(settlement.foodSecurity)}</dd>
        <dt>Verdediging</dt><dd>${Math.round(settlement.defense)}</dd>
        <dt>Stabiliteit</dt><dd>${Math.round(settlement.stability)}</dd>
        <dt>Afstand tot hoofdstad</dt><dd>${distanceToCapital}</dd>
        <dt>Centrum</dt><dd>${Math.round(settlement.centerX)}, ${Math.round(settlement.centerY)}</dd>
      </dl>
    `;
  }

  if (selected.kind === "tile") {
    const tile = getTile(state.world, selected.x, selected.y);
    if (!tile) return emptyInspector();
    const ownerId = state.territory.ownerByTile[tileIndex(state.world, tile.x, tile.y)];
    const owner = ownerId ? state.civilizations.find((civilization) => civilization.id === ownerId)?.name : undefined;
    return `
      <h2>Tile ${tile.x}, ${tile.y}</h2>
      <dl>
        <dt>Type</dt><dd>${tile.type}</dd>
        <dt>Territorium</dt><dd>${owner ?? "neutraal"}</dd>
        <dt>Hoogte</dt><dd>${tile.elevation.toFixed(2)}</dd>
        <dt>Vocht</dt><dd>${tile.moisture.toFixed(2)}</dd>
        <dt>Vruchtbaar</dt><dd>${tile.fertility.toFixed(2)}</dd>
        <dt>Temperatuur</dt><dd>${tile.temperature.toFixed(2)}</dd>
        <dt>Bronnen</dt><dd>${tile.resourceAmount}</dd>
      </dl>
    `;
  }

  return emptyInspector();
}

function buildingProductionLabel(type: keyof typeof BUILDING_DEFINITIONS): string {
  switch (type) {
    case "farm":
      return "voedsel";
    case "woodcutter":
      return "hout";
    case "mine":
      return "steenaders";
    case "workshop":
      return "steen en sneller bouwen";
    case "well":
      return "gezondheid";
    case "reservoir":
      return "bluswater en brandbeveiliging";
    case "firestation":
      return "snellere georganiseerde brandweer";
    case "market":
      return "welvaart en handel";
    case "school":
      return "kennis";
    case "monument":
      return "cultuur";
    case "watchtower":
      return "veiligheid";
    default:
      return "-";
  }
}

function emptyInspector(): string {
  return `
    <h2>Inspectie</h2>
    <p>Klik op een bewoner, gebouw of tile om details te zien.</p>
  `;
}
