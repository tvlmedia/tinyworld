import { Villager, VillagerJob } from "../entities/Villager";

export function assignJobByIndex(index: number): VillagerJob {
  const jobs: VillagerJob[] = ["gatherer", "woodcutter", "builder", "farmer", "idle"];
  return jobs[index % jobs.length];
}

export function preferredWork(villager: Villager): "food" | "wood" | "build" | "wander" {
  if (villager.job === "gatherer" || villager.job === "farmer") return "food";
  if (villager.job === "woodcutter") return "wood";
  if (villager.job === "builder") return "build";
  return "wander";
}
