import { Point } from "../utils/MathUtils";
import { ResourceStore, ResourceType, cloneResources } from "./Resources";

export type BuildingType =
  | "campfire"
  | "storage"
  | "house"
  | "woodcutter"
  | "farm"
  | "workshop"
  | "watchtower";

export type BuildingStatus = "planned" | "building" | "complete";

export interface BuildingDefinition {
  type: BuildingType;
  label: string;
  width: number;
  height: number;
  costs: Partial<Record<ResourceType, number>>;
  buildWorkRequired: number;
  capacity?: number;
  storageCapacity?: number;
}

export interface Building {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  status: BuildingStatus;
  health: number;
  maxHealth: number;
  progress: number;
  workRequired: number;
  capacity: number;
  storageCapacity: number;
  materialsDelivered: ResourceStore;
  storage: ResourceStore;
  productionTimer: number;
}

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  campfire: {
    type: "campfire",
    label: "Kampvuur",
    width: 2,
    height: 2,
    costs: {},
    buildWorkRequired: 1
  },
  storage: {
    type: "storage",
    label: "Opslag",
    width: 3,
    height: 2,
    costs: { wood: 8 },
    buildWorkRequired: 18,
    storageCapacity: 180
  },
  house: {
    type: "house",
    label: "Huis",
    width: 3,
    height: 3,
    costs: { wood: 22, stone: 2 },
    buildWorkRequired: 42,
    capacity: 4
  },
  woodcutter: {
    type: "woodcutter",
    label: "Houthakkershut",
    width: 3,
    height: 2,
    costs: { wood: 16, stone: 4 },
    buildWorkRequired: 34
  },
  farm: {
    type: "farm",
    label: "Boerderij",
    width: 4,
    height: 3,
    costs: { wood: 12 },
    buildWorkRequired: 30
  },
  workshop: {
    type: "workshop",
    label: "Werkplaats",
    width: 4,
    height: 3,
    costs: { wood: 26, stone: 12 },
    buildWorkRequired: 56
  },
  watchtower: {
    type: "watchtower",
    label: "Uitkijktoren",
    width: 2,
    height: 2,
    costs: { wood: 18, stone: 8 },
    buildWorkRequired: 38
  }
};

export function createBuilding(id: string, type: BuildingType, x: number, y: number, complete = false): Building {
  const definition = BUILDING_DEFINITIONS[type];
  const delivered = cloneResources(complete ? definition.costs : {});
  return {
    id,
    type,
    x,
    y,
    width: definition.width,
    height: definition.height,
    status: complete ? "complete" : "planned",
    health: 100,
    maxHealth: 100,
    progress: complete ? definition.buildWorkRequired : 0,
    workRequired: definition.buildWorkRequired,
    capacity: definition.capacity ?? 0,
    storageCapacity: definition.storageCapacity ?? 0,
    materialsDelivered: delivered,
    storage: cloneResources({}),
    productionTimer: 0
  };
}

export function buildingCenter(building: Building): Point {
  return {
    x: building.x + building.width / 2,
    y: building.y + building.height / 2
  };
}

export function buildingContains(building: Building, x: number, y: number): boolean {
  return x >= building.x && y >= building.y && x < building.x + building.width && y < building.y + building.height;
}

export function materialMissing(building: Building, resource: ResourceType): number {
  const cost = BUILDING_DEFINITIONS[building.type].costs[resource] ?? 0;
  return Math.max(0, cost - building.materialsDelivered[resource]);
}

export function allMaterialsDelivered(building: Building): boolean {
  return (["wood", "food", "stone"] as const).every((resource) => materialMissing(building, resource) <= 0);
}

export function costLabel(type: BuildingType): string {
  const costs = BUILDING_DEFINITIONS[type].costs;
  const parts = (Object.keys(costs) as ResourceType[])
    .filter((resource) => (costs[resource] ?? 0) > 0)
    .map((resource) => `${resource}: ${costs[resource]}`);
  return parts.length > 0 ? parts.join(", ") : "gratis";
}
