import { createBuildingAt, GameState } from "../app/GameState";
import { createVillager, villagerName } from "../entities/Villager";
import { forceWeather } from "../simulation/WeatherSystem";
import { addEvent } from "../simulation/EventSystem";
import { extinguishArea, igniteTile } from "../simulation/FireSystem";
import { getTile } from "../world/World";
import { isWalkableTile } from "../world/Tile";
import { assignJobByIndex } from "../ai/Jobs";
import { foundIndependentCivilizationAt } from "../simulation/CivilizationFoundationSystem";

export interface ToolDefinition {
  id: string;
  label: string;
  icon: string;
  cooldown: number;
  description: string;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { id: "inspect", label: "Inspecteer", icon: "?", cooldown: 0, description: "Selecteer bewoners, gebouwen of tiles." },
  { id: "plantTree", label: "Boom", icon: "&#127795;", cooldown: 1.8, description: "Plant een jonge boom." },
  { id: "rain", label: "Regen", icon: "&#9730;", cooldown: 8, description: "Roep een regenbui op." },
  { id: "food", label: "Voedsel", icon: "&#9679;", cooldown: 1.4, description: "Plaats wilde bessen." },
  { id: "villager", label: "Inwoner", icon: "&#9786;", cooldown: 10, description: "Laat een nieuwe kolonist verschijnen." },
  { id: "civilization", label: "Nieuwe civ", icon: "&#9873;", cooldown: 4, description: "Sticht op ruime grond een onafhankelijke beschaving." },
  { id: "fire", label: "Vuur", icon: "&#9650;", cooldown: 4, description: "Start een beheersbare brand." },
  { id: "extinguish", label: "Blus", icon: "&#126;", cooldown: 2.5, description: "Blus vuur in een klein gebied." },
  { id: "lightning", label: "Bliksem", icon: "&#9889;", cooldown: 9, description: "Laat bliksem inslaan." },
  { id: "restore", label: "Herstel", icon: "+", cooldown: 3, description: "Herstel verbrande grond." }
];

export function useToolAt(state: GameState, toolId: string, x: number, y: number): boolean {
  if (toolId === "inspect") return false;
  if (cooldownRemaining(state, toolId) > 0) return true;
  const tile = getTile(state.world, x, y);
  if (!tile) return true;

  switch (toolId) {
    case "plantTree":
      if (tile.type === "grass" || tile.type === "burned") {
        tile.type = "forest";
        tile.resourceAmount = 1;
        state.world.version += 1;
        addEvent(state, "Er werd een jonge boom geplant.");
        triggerCooldown(state, toolId);
      }
      return true;
    case "rain":
      forceWeather(state, "rain", 80);
      triggerCooldown(state, toolId);
      return true;
    case "food":
      if (tile.type === "grass" || tile.type === "farmland" || tile.type === "forest") {
        tile.resourceAmount = Math.min(8, tile.resourceAmount + 4);
        addEvent(state, "Wilde voedselbronnen verschenen.");
        triggerCooldown(state, toolId);
      }
      return true;
    case "villager":
      if (isWalkableTile(tile)) {
        const index = state.villagers.length;
        const villager = createVillager(
          state.ids.next("villager"),
          villagerName(index),
          x + 0.5,
          y + 0.5,
          assignJobByIndex(index),
          state.rng.int(16, 40)
        );
        state.villagers.push(villager);
        addEvent(state, `${villager.name} kwam aan op het eiland.`);
        triggerCooldown(state, toolId);
      }
      return true;
    case "civilization": {
      const result = foundIndependentCivilizationAt(state, x, y);
      if (result.founded && result.civilization && result.settlement) {
        addEvent(state, `${result.civilization.name} stichtten ${result.settlement.name}.`);
        triggerCooldown(state, toolId);
        state.activeTool = "inspect";
      } else {
        addEvent(state, result.reason ?? "Op deze plek kan geen nieuwe beschaving ontstaan.");
      }
      return true;
    }
    case "fire":
      if (igniteTile(state, x, y, 0.9)) {
        addEvent(state, "Een klein vuur begon te branden.");
        triggerCooldown(state, toolId);
      }
      return true;
    case "extinguish":
      extinguishArea(state, x, y, 4);
      addEvent(state, "Het vuur werd in de omgeving geblust.");
      triggerCooldown(state, toolId);
      return true;
    case "lightning":
      state.weather.lightningFlash = 1;
      if (igniteTile(state, x, y, 1.25)) addEvent(state, "Bliksem veroorzaakte een brand.");
      else addEvent(state, "Bliksem sloeg in zonder brand te veroorzaken.");
      triggerCooldown(state, toolId);
      return true;
    case "restore":
      if (tile.type === "burned") {
        tile.type = "grass";
        tile.resourceAmount = 1;
        state.world.version += 1;
      }
      extinguishArea(state, x, y, 2);
      addEvent(state, "De grond werd hersteld.");
      triggerCooldown(state, toolId);
      return true;
    default:
      return false;
  }
}

export function cooldownRemaining(state: GameState, toolId: string): number {
  return state.toolCooldowns.find((item) => item.tool === toolId)?.remaining ?? 0;
}

export function triggerCooldown(state: GameState, toolId: string): void {
  const definition = TOOL_DEFINITIONS.find((tool) => tool.id === toolId);
  if (!definition || definition.cooldown <= 0) return;
  const existing = state.toolCooldowns.find((item) => item.tool === toolId);
  if (existing) existing.remaining = definition.cooldown;
  else state.toolCooldowns.push({ tool: toolId, remaining: definition.cooldown });
}

export function debugAction(state: GameState, action: string): void {
  switch (action) {
    case "food":
      state.resources.food += 100;
      break;
    case "wood":
      state.resources.wood += 100;
      break;
    case "villager":
      useToolAt(state, "villager", Math.floor(state.world.spawn.x), Math.floor(state.world.spawn.y + 4));
      break;
    case "clearFire":
      state.fires = [];
      break;
    case "day":
      state.time.day += 1;
      break;
    case "finishBuild": {
      const site = state.buildings.find((building) => building.status !== "complete");
      if (site) {
        site.progress = site.workRequired;
        site.status = "complete";
      }
      break;
    }
    case "storage":
      createBuildingAt(state, "storage", state.world.spawn.x - 5, state.world.spawn.y + 4, true);
      break;
  }
}
