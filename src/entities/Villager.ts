import { Point } from "../utils/MathUtils";
import { ResourceType } from "./Resources";

export type VillagerJob = "idle" | "gatherer" | "woodcutter" | "builder" | "farmer";

export type VillagerState =
  | "idle"
  | "wander"
  | "findFood"
  | "walkToFood"
  | "gatherFood"
  | "walkToStorage"
  | "eat"
  | "findTree"
  | "walkToTree"
  | "chopTree"
  | "findStone"
  | "walkToStone"
  | "mineStone"
  | "deliverWood"
  | "deliverFood"
  | "deliverStone"
  | "fetchMaterial"
  | "deliverMaterial"
  | "walkToBuildSite"
  | "build"
  | "sleep"
  | "fleeFire";

export interface Carrying {
  type: ResourceType;
  amount: number;
}

export interface Villager {
  id: string;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  age: number;
  health: number;
  hunger: number;
  energy: number;
  happiness: number;
  job: VillagerJob;
  state: VillagerState;
  carrying?: Carrying;
  homeId?: string;
  workplaceId?: string;
  path: Point[];
  actionTimer: number;
  targetTile?: Point;
  targetBuildingId?: string;
  speech?: string;
  speechTimer: number;
}

const NAMES = [
  "Mira",
  "Taro",
  "Lina",
  "Oren",
  "Pip",
  "Suri",
  "Niko",
  "Avi",
  "Juna",
  "Bram",
  "Fenn",
  "Ira",
  "Koa",
  "Rin",
  "Sef"
];

export function villagerName(index: number): string {
  return NAMES[index % NAMES.length];
}

export function createVillager(
  id: string,
  name: string,
  x: number,
  y: number,
  job: VillagerJob,
  age: number
): Villager {
  return {
    id,
    name,
    x,
    y,
    targetX: x,
    targetY: y,
    speed: 1.85,
    age,
    health: 100,
    hunger: 12,
    energy: 92,
    happiness: 72,
    job,
    state: "idle",
    path: [],
    actionTimer: 0,
    speechTimer: 0
  };
}

export function describeState(state: VillagerState): string {
  switch (state) {
    case "idle":
      return "rust even uit";
    case "wander":
      return "wandelt rond";
    case "findFood":
    case "walkToFood":
    case "gatherFood":
      return "zoekt voedsel";
    case "walkToStorage":
      return "loopt naar opslag";
    case "eat":
      return "eet iets";
    case "findTree":
    case "walkToTree":
    case "chopTree":
      return "verzamelt hout";
    case "findStone":
    case "walkToStone":
    case "mineStone":
      return "delft steen";
    case "deliverWood":
      return "brengt hout weg";
    case "deliverFood":
      return "brengt voedsel weg";
    case "deliverStone":
      return "brengt steen weg";
    case "fetchMaterial":
    case "deliverMaterial":
      return "vervoert bouwmateriaal";
    case "walkToBuildSite":
    case "build":
      return "werkt aan een gebouw";
    case "sleep":
      return "slaapt";
    case "fleeFire":
      return "vlucht voor vuur";
  }
}
