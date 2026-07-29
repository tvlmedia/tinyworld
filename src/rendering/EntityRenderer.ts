import { GameState } from "../app/GameState";
import { TILE_SIZE } from "../app/Config";
import { BUILDING_DEFINITIONS, Building } from "../entities/Building";
import { Villager } from "../entities/Villager";
import { daylightAmount } from "../simulation/TimeSystem";
import { Camera } from "./Camera";

export class EntityRenderer {
  draw(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera, time: number): void {
    const orderedBuildings = [...state.buildings].sort((a, b) => a.y - b.y);
    for (const building of orderedBuildings) this.drawBuilding(ctx, state, camera, building, time);
    for (const fire of state.fires) this.drawFire(ctx, camera, fire.x, fire.y, fire.intensity, time);
    const orderedVillagers = [...state.villagers].sort((a, b) => a.y - b.y);
    for (const villager of orderedVillagers) this.drawVillager(ctx, state, camera, villager, time);
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera, building: Building, time: number): void {
    const screen = camera.worldToScreen(building.x, building.y);
    const width = building.width * TILE_SIZE * camera.zoom;
    const height = building.height * TILE_SIZE * camera.zoom;
    const selected = state.selected.kind === "building" && state.selected.id === building.id;

    if (state.settings.shadows) {
      ctx.fillStyle = "rgba(20, 25, 20, 0.25)";
      ctx.fillRect(screen.x + width * 0.08, screen.y + height * 0.75, width * 0.9, height * 0.2);
    }

    if (building.status !== "complete") {
      ctx.fillStyle = "#8c7355";
      ctx.fillRect(screen.x + width * 0.12, screen.y + height * 0.58, width * 0.76, height * 0.18);
      ctx.strokeStyle = "#eee0ad";
      ctx.lineWidth = Math.max(1, camera.zoom);
      ctx.strokeRect(screen.x + width * 0.16, screen.y + height * 0.16, width * 0.68, height * 0.56);
      ctx.fillStyle = "#e2cf8d";
      ctx.fillRect(screen.x + width * 0.2, screen.y + height * 0.84, width * (building.progress / building.workRequired) * 0.6, height * 0.08);
      this.drawMaterialPile(ctx, building, screen.x, screen.y, width, height);
    } else {
      this.drawCompleteBuilding(ctx, state, building, screen.x, screen.y, width, height, time);
    }

    if (selected) {
      ctx.strokeStyle = "#fff3a6";
      ctx.lineWidth = Math.max(2, camera.zoom * 1.2);
      ctx.strokeRect(screen.x - 2, screen.y - 2, width + 4, height + 4);
    }
  }

  private drawCompleteBuilding(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    building: Building,
    x: number,
    y: number,
    width: number,
    height: number,
    time: number
  ): void {
    if (building.type === "campfire") {
      ctx.fillStyle = "#6e4b34";
      ctx.fillRect(x + width * 0.18, y + height * 0.58, width * 0.64, height * 0.15);
      this.drawFire(ctx, { worldToScreen: () => ({ x, y }) }, building.x + 0.48, building.y + 0.42, 0.65, time, width);
      return;
    }

    if (building.type === "farm") {
      ctx.fillStyle = "rgba(98, 64, 34, 0.25)";
      ctx.fillRect(x + width * 0.08, y + height * 0.1, width * 0.84, height * 0.8);
      ctx.fillStyle = "#71b85b";
      for (let row = 0; row < 3; row += 1) {
        ctx.fillRect(x + width * 0.18, y + height * (0.2 + row * 0.2), width * 0.62, height * 0.06);
      }
      return;
    }

    const body = building.type === "storage" ? "#b07b52" : building.type === "workshop" ? "#8a6b91" : "#b86f58";
    const roof = building.type === "watchtower" ? "#6d573c" : "#7c4f3f";
    ctx.fillStyle = body;
    ctx.fillRect(x + width * 0.12, y + height * 0.35, width * 0.76, height * 0.52);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.05, y + height * 0.38);
    ctx.lineTo(x + width * 0.5, y + height * 0.08);
    ctx.lineTo(x + width * 0.95, y + height * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#4b382c";
    ctx.fillRect(x + width * 0.42, y + height * 0.6, width * 0.16, height * 0.27);

    const light = 1 - daylightAmount(state.time.minutes);
    if (light > 0.18 && (building.type === "house" || building.type === "workshop")) {
      ctx.fillStyle = `rgba(255, 209, 104, ${light * 0.9})`;
      ctx.fillRect(x + width * 0.22, y + height * 0.52, width * 0.14, height * 0.13);
      ctx.fillRect(x + width * 0.64, y + height * 0.52, width * 0.14, height * 0.13);
    }

    if (building.type === "house" || building.type === "workshop") {
      ctx.fillStyle = "rgba(85, 85, 85, 0.55)";
      const smokeX = x + width * 0.68 + Math.sin(time * 0.002) * 3;
      ctx.beginPath();
      ctx.arc(smokeX, y + height * 0.05 - (time * 0.02) % 15, Math.max(2, width * 0.035), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMaterialPile(ctx: CanvasRenderingContext2D, building: Building, x: number, y: number, width: number, height: number): void {
    const definition = BUILDING_DEFINITIONS[building.type];
    const delivered = building.materialsDelivered.wood + building.materialsDelivered.food + building.materialsDelivered.stone;
    const needed = (definition.costs.wood ?? 0) + (definition.costs.food ?? 0) + (definition.costs.stone ?? 0);
    if (needed <= 0 || delivered <= 0) return;
    ctx.fillStyle = "#7b5236";
    const piles = Math.min(5, Math.ceil((delivered / needed) * 5));
    for (let i = 0; i < piles; i += 1) {
      ctx.fillRect(x + width * (0.18 + i * 0.1), y + height * 0.74, width * 0.07, height * 0.08);
    }
  }

  private drawVillager(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera, villager: Villager, time: number): void {
    const screen = camera.worldToScreen(villager.x, villager.y);
    const size = TILE_SIZE * camera.zoom;
    const selected = state.selected.kind === "villager" && state.selected.id === villager.id;
    const bob = Math.sin(time * 0.012 + villager.x) * size * 0.04;
    const x = screen.x;
    const y = screen.y + bob;

    if (selected) {
      ctx.strokeStyle = "#fff3a6";
      ctx.lineWidth = Math.max(2, camera.zoom);
      ctx.beginPath();
      ctx.ellipse(x, y + size * 0.1, size * 0.32, size * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = jobColor(villager.job);
    ctx.fillRect(x - size * 0.14, y - size * 0.2, size * 0.28, size * 0.36);
    ctx.fillStyle = "#f0c7a1";
    ctx.fillRect(x - size * 0.11, y - size * 0.38, size * 0.22, size * 0.18);
    ctx.fillStyle = "#42372f";
    ctx.fillRect(x - size * 0.13, y - size * 0.43, size * 0.26, size * 0.08);

    if (villager.carrying) {
      ctx.fillStyle = villager.carrying.type === "wood" ? "#8b5e34" : villager.carrying.type === "food" ? "#c94141" : "#9da1a4";
      ctx.fillRect(x + size * 0.12, y - size * 0.24, size * 0.18, size * 0.16);
    }

    if (villager.speech && !state.settings.reducedMotion) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(x - size * 0.34, y - size * 0.72, size * 0.68, size * 0.22);
      ctx.fillStyle = "#2e3a37";
      ctx.font = `${Math.max(9, size * 0.16)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(villager.speech, x, y - size * 0.55);
    }
  }

  private drawFire(
    ctx: CanvasRenderingContext2D,
    camera: Pick<Camera, "worldToScreen"> & { zoom?: number },
    tileX: number,
    tileY: number,
    intensity: number,
    time: number,
    overrideSize?: number
  ): void {
    const screen = camera.worldToScreen(tileX, tileY);
    const size = overrideSize ?? TILE_SIZE * (camera.zoom ?? 1);
    const flame = Math.sin(time * 0.02 + tileX) * size * 0.06;
    ctx.fillStyle = "rgba(255, 92, 35, 0.86)";
    ctx.beginPath();
    ctx.moveTo(screen.x + size * 0.48, screen.y + size * (0.18 - intensity * 0.08));
    ctx.lineTo(screen.x + size * (0.26 + flame / size), screen.y + size * 0.78);
    ctx.lineTo(screen.x + size * 0.72, screen.y + size * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 224, 91, 0.78)";
    ctx.beginPath();
    ctx.moveTo(screen.x + size * 0.5, screen.y + size * 0.34);
    ctx.lineTo(screen.x + size * 0.38, screen.y + size * 0.78);
    ctx.lineTo(screen.x + size * 0.62, screen.y + size * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(75, 72, 68, 0.35)";
    ctx.beginPath();
    ctx.arc(screen.x + size * 0.58, screen.y + size * 0.1 - (time * 0.015) % 12, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function jobColor(job: Villager["job"]): string {
  switch (job) {
    case "gatherer":
      return "#78a857";
    case "woodcutter":
      return "#b0713e";
    case "builder":
      return "#d8b14d";
    case "farmer":
      return "#5f9d73";
    case "idle":
      return "#6a8bb8";
  }
}
