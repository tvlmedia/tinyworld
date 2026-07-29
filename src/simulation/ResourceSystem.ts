import { Building, BUILDING_DEFINITIONS, BuildingType } from "../entities/Building";
import { ResourceStore, ResourceType, resourceTotal } from "../entities/Resources";

export function totalStorageCapacity(buildings: Building[]): number {
  const base = 80;
  return (
    base +
    buildings
      .filter((building) => building.status === "complete")
      .reduce((sum, building) => sum + building.storageCapacity, 0)
  );
}

export function isStorageNearCapacity(resources: ResourceStore, buildings: Building[]): boolean {
  return resourceTotal(resources) > totalStorageCapacity(buildings) * 0.82;
}

export function costFor(type: BuildingType): Partial<Record<ResourceType, number>> {
  return BUILDING_DEFINITIONS[type].costs;
}
