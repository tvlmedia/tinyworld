export type ResourceType = "wood" | "food" | "stone";

export interface ResourceStore {
  wood: number;
  food: number;
  stone: number;
}

export const EMPTY_RESOURCES: ResourceStore = {
  wood: 0,
  food: 0,
  stone: 0
};

export function cloneResources(resources: Partial<ResourceStore>): ResourceStore {
  return {
    wood: resources.wood ?? 0,
    food: resources.food ?? 0,
    stone: resources.stone ?? 0
  };
}

export function addResources(target: ResourceStore, source: Partial<ResourceStore>): void {
  target.wood += source.wood ?? 0;
  target.food += source.food ?? 0;
  target.stone += source.stone ?? 0;
}

export function subtractResources(target: ResourceStore, source: Partial<ResourceStore>): boolean {
  if (!hasResources(target, source)) return false;
  target.wood -= source.wood ?? 0;
  target.food -= source.food ?? 0;
  target.stone -= source.stone ?? 0;
  return true;
}

export function hasResources(target: ResourceStore, cost: Partial<ResourceStore>): boolean {
  return (
    target.wood >= (cost.wood ?? 0) &&
    target.food >= (cost.food ?? 0) &&
    target.stone >= (cost.stone ?? 0)
  );
}

export function resourceTotal(resources: ResourceStore): number {
  return resources.wood + resources.food + resources.stone;
}
