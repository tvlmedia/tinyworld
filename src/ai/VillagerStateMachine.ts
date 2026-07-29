import { Villager, VillagerState } from "../entities/Villager";

export function setVillagerState(villager: Villager, state: VillagerState): void {
  villager.state = state;
  villager.actionTimer = 0;
}

export function say(villager: Villager, text: string, seconds = 1.8): void {
  villager.speech = text;
  villager.speechTimer = seconds;
}
