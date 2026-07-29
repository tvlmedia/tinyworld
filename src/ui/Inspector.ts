import { GameState } from "../app/GameState";
import { BUILDING_DEFINITIONS, allMaterialsDelivered, costLabel } from "../entities/Building";
import { describeState } from "../entities/Villager";
import { getTile } from "../world/World";

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
    return `
      <h2>${definition.label}</h2>
      <dl>
        <dt>Status</dt><dd>${building.status}</dd>
        <dt>Gezondheid</dt><dd>${Math.round(building.health)} / ${building.maxHealth}</dd>
        <dt>Voortgang</dt><dd>${Math.round((building.progress / building.workRequired) * 100)}%</dd>
        <dt>Materiaal</dt><dd>${allMaterialsDelivered(building) ? "klaar" : costLabel(building.type)}</dd>
        <dt>Bedden</dt><dd>${building.capacity}</dd>
        <dt>Opslagruimte</dt><dd>${building.storageCapacity}</dd>
        <dt>Productie</dt><dd>${buildingProductionLabel(building.type)}</dd>
      </dl>
    `;
  }

  if (selected.kind === "tile") {
    const tile = getTile(state.world, selected.x, selected.y);
    if (!tile) return emptyInspector();
    return `
      <h2>Tile ${tile.x}, ${tile.y}</h2>
      <dl>
        <dt>Type</dt><dd>${tile.type}</dd>
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
    case "workshop":
      return "steen en sneller bouwen";
    case "well":
      return "gezondheid";
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
