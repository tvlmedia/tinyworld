import { Villager, VillagerState } from "../entities/Villager";

export function setVillagerState(villager: Villager, state: VillagerState): void {
  if (villager.state !== state) villager.stateElapsed = 0;
  villager.state = state;
  villager.actionTimer = 0;
}

export function say(villager: Villager, text: string, seconds = 1.8): void {
  villager.speech = text;
  villager.speechTimer = seconds;
}
