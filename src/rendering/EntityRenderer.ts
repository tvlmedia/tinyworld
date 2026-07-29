import { GameState } from "../app/GameState";
import { TILE_SIZE } from "../app/Config";
import { CIVILIZATION_COLORS } from "../config/civilizationConfig";
import { BUILDING_DEFINITIONS, Building } from "../entities/Building";
import { Villager } from "../entities/Villager";
import { daylightAmount } from "../simulation/TimeSystem";
import { Camera } from "./Camera";

export class EntityRenderer {
  draw(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera, time: number): void {
    const bounds = camera.visibleTileBounds(state.world);
    const orderedBuildings = state.buildings
      .filter((building) => building.x + building.width >= bounds.minX - 4 && building.x <= bounds.maxX + 4 && building.y + building.height >= bounds.minY - 4 && building.y <= bounds.maxY + 4)
      .sort((a, b) => a.y - b.y);
    for (const building of orderedBuildings) this.drawBuilding(ctx, state, camera, building, time);
    for (const fire of state.fires.filter((fire) => fire.x >= bounds.minX - 3 && fire.x <= bounds.maxX + 3 && fire.y >= bounds.minY - 3 && fire.y <= bounds.maxY + 3)) {
      this.drawFire(ctx, camera, fire.x, fire.y, fire.intensity, time);
    }
    const orderedVillagers = state.villagers
      .filter((villager) => villager.x >= bounds.minX - 2 && villager.x <= bounds.maxX + 2 && villager.y >= bounds.minY - 2 && villager.y <= bounds.maxY + 2)
      .sort((a, b) => a.y - b.y);
    for (const villager of orderedVillagers) this.drawVillager(ctx, state, camera, villager, time);
    if (state.mapMode === "trade" || state.mapMode === "diplomacy") this.drawTradeRoutes(ctx, state, camera);
    if (state.mapMode === "war" || state.mapMode === "diplomacy") this.drawWarLines(ctx, state, camera);
    for (const army of state.armies) this.drawArmy(ctx, state, camera, army.id, army.x, army.y, army.civilizationId, army.soldierIds.length, army.morale);
    for (const group of state.colonistGroups) this.drawTravelGroup(ctx, state, camera, group.x, group.y, group.civilizationId, group.settlers, "kol");
    for (const group of state.migrationGroups) this.drawTravelGroup(ctx, state, camera, group.x, group.y, undefined, group.migrants, "mig");
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

    if (building.status === "complete" && building.civilizationId && (building.type === "campfire" || building.type === "storage" || building.type === "market" || building.type === "watchtower")) {
      this.drawCivilizationFlag(ctx, state, building, screen.x, screen.y, width, height);
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

    if (building.type === "well") {
      ctx.fillStyle = "#6e6154";
      ctx.beginPath();
      ctx.ellipse(x + width * 0.5, y + height * 0.58, width * 0.34, height * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4d91b7";
      ctx.beginPath();
      ctx.ellipse(x + width * 0.5, y + height * 0.55, width * 0.22, height * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7b5236";
      ctx.fillRect(x + width * 0.22, y + height * 0.22, width * 0.1, height * 0.48);
      ctx.fillRect(x + width * 0.68, y + height * 0.22, width * 0.1, height * 0.48);
      ctx.fillStyle = "#7c4f3f";
      ctx.fillRect(x + width * 0.25, y + height * 0.16, width * 0.5, height * 0.12);
      return;
    }

    if (building.type === "monument") {
      ctx.fillStyle = "#797f86";
      ctx.fillRect(x + width * 0.2, y + height * 0.75, width * 0.6, height * 0.12);
      ctx.fillStyle = "#aeb4bb";
      ctx.beginPath();
      ctx.moveTo(x + width * 0.5, y + height * 0.13);
      ctx.lineTo(x + width * 0.68, y + height * 0.75);
      ctx.lineTo(x + width * 0.32, y + height * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255, 230, 145, 0.28)";
      ctx.beginPath();
      ctx.arc(x + width * 0.5, y + height * 0.23, width * 0.18, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const body =
      building.visualEra === "industry"
        ? "#7d8584"
        : building.visualEra === "stone"
          ? "#9aa0a0"
          : building.type === "storage"
            ? "#b07b52"
            : building.type === "workshop"
              ? "#8a6b91"
              : building.type === "mine"
                ? "#766456"
                : building.type === "market"
                  ? "#c98945"
                  : building.type === "school"
                    ? "#6d8eb4"
                    : "#b86f58";
    const roof = building.type === "watchtower" ? "#6d573c" : building.type === "mine" ? "#49382f" : building.type === "market" ? "#b4473e" : "#7c4f3f";
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

    if (building.type === "market") {
      ctx.fillStyle = "#f1d36b";
      ctx.fillRect(x + width * 0.18, y + height * 0.46, width * 0.18, height * 0.16);
      ctx.fillStyle = "#7bb661";
      ctx.fillRect(x + width * 0.64, y + height * 0.46, width * 0.18, height * 0.16);
    }

    if (building.type === "mine") {
      ctx.fillStyle = "#2d2926";
      ctx.beginPath();
      ctx.ellipse(x + width * 0.5, y + height * 0.66, width * 0.18, height * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9da1a4";
      ctx.fillRect(x + width * 0.18, y + height * 0.48, width * 0.18, height * 0.1);
      ctx.fillRect(x + width * 0.64, y + height * 0.48, width * 0.18, height * 0.1);
    }

    if (building.type === "school") {
      ctx.fillStyle = "#f4e3a1";
      ctx.fillRect(x + width * 0.18, y + height * 0.5, width * 0.18, height * 0.15);
      ctx.fillRect(x + width * 0.64, y + height * 0.5, width * 0.18, height * 0.15);
      ctx.strokeStyle = "rgba(44, 58, 71, 0.55)";
      ctx.beginPath();
      ctx.moveTo(x + width * 0.5, y + height * 0.2);
      ctx.lineTo(x + width * 0.5, y + height * 0.38);
      ctx.stroke();
    }

    const light = 1 - daylightAmount(state.time.minutes);
    if (light > 0.18 && (building.type === "house" || building.type === "workshop" || building.type === "market" || building.type === "school")) {
      ctx.fillStyle = `rgba(255, 209, 104, ${light * 0.9})`;
      ctx.fillRect(x + width * 0.22, y + height * 0.52, width * 0.14, height * 0.13);
      ctx.fillRect(x + width * 0.64, y + height * 0.52, width * 0.14, height * 0.13);
    }

    if (building.type === "house" || building.type === "workshop" || building.type === "school") {
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

  private drawCivilizationFlag(ctx: CanvasRenderingContext2D, state: GameState, building: Building, x: number, y: number, width: number, height: number): void {
    const civilization = state.civilizations.find((item) => item.id === building.civilizationId);
    if (!civilization) return;
    const color = CIVILIZATION_COLORS[civilization.colorIndex % CIVILIZATION_COLORS.length];
    const poleX = x + width * 0.72;
    const poleTop = y + height * 0.05;
    ctx.strokeStyle = "#3c3028";
    ctx.lineWidth = Math.max(1, width * 0.025);
    ctx.beginPath();
    ctx.moveTo(poleX, poleTop);
    ctx.lineTo(poleX, y + height * 0.42);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(poleX, poleTop);
    ctx.lineTo(poleX + width * 0.18, poleTop + height * 0.06);
    ctx.lineTo(poleX, poleTop + height * 0.16);
    ctx.closePath();
    ctx.fill();
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

  private drawTravelGroup(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camera: Camera,
    worldX: number,
    worldY: number,
    civilizationId: string | undefined,
    count: number,
    label: string
  ): void {
    const screen = camera.worldToScreen(worldX, worldY);
    const size = TILE_SIZE * camera.zoom;
    const civilization = civilizationId ? state.civilizations.find((item) => item.id === civilizationId) : undefined;
    const color = civilization ? CIVILIZATION_COLORS[civilization.colorIndex % CIVILIZATION_COLORS.length] : "#f2c14e";
    ctx.fillStyle = "rgba(36, 29, 22, 0.55)";
    ctx.fillRect(screen.x - size * 0.42, screen.y + size * 0.18, size * 0.84, size * 0.18);
    ctx.fillStyle = "#9c6b42";
    ctx.fillRect(screen.x - size * 0.32, screen.y - size * 0.12, size * 0.64, size * 0.34);
    ctx.fillStyle = color;
    ctx.fillRect(screen.x + size * 0.16, screen.y - size * 0.5, size * 0.32, size * 0.18);
    ctx.strokeStyle = "#3c3028";
    ctx.beginPath();
    ctx.moveTo(screen.x + size * 0.16, screen.y - size * 0.5);
    ctx.lineTo(screen.x + size * 0.16, screen.y - size * 0.08);
    ctx.stroke();
    ctx.fillStyle = "#f0c7a1";
    for (let i = 0; i < Math.min(4, count); i += 1) {
      ctx.fillRect(screen.x - size * 0.36 + i * size * 0.18, screen.y - size * 0.32, size * 0.1, size * 0.16);
    }
    if (camera.zoom > 0.7) {
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.font = `${Math.max(8, size * 0.14)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(label, screen.x, screen.y - size * 0.62);
    }
  }

  private drawTradeRoutes(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera): void {
    for (const route of state.tradeRoutes) {
      if (!route.active) continue;
      const from = state.settlements.find((settlement) => settlement.id === route.fromSettlementId);
      const to = state.settlements.find((settlement) => settlement.id === route.toSettlementId);
      if (!from || !to) continue;
      const a = camera.worldToScreen(from.centerX, from.centerY);
      const b = camera.worldToScreen(to.centerX, to.centerY);
      ctx.strokeStyle = "rgba(255, 220, 108, 0.62)";
      ctx.lineWidth = Math.max(1, TILE_SIZE * camera.zoom * 0.06);
      ctx.setLineDash([Math.max(3, camera.zoom * 4), Math.max(3, camera.zoom * 3)]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const t = route.progress <= 0.5 ? route.progress * 2 : (1 - route.progress) * 2;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      ctx.fillStyle = "#f2c14e";
      ctx.fillRect(x - 4 * camera.zoom, y - 3 * camera.zoom, 8 * camera.zoom, 6 * camera.zoom);
    }
  }

  private drawWarLines(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera): void {
    for (const war of state.wars) {
      if (!war.active || !war.targetSettlementId) continue;
      const target = state.settlements.find((settlement) => settlement.id === war.targetSettlementId);
      if (!target) continue;
      const targetScreen = camera.worldToScreen(target.centerX, target.centerY);
      for (const army of state.armies.filter((item) => item.warId === war.id)) {
        const armyScreen = camera.worldToScreen(army.x, army.y);
        ctx.strokeStyle = army.civilizationId === target.civilizationId ? "rgba(91, 181, 120, 0.55)" : "rgba(222, 74, 64, 0.62)";
        ctx.lineWidth = Math.max(1, TILE_SIZE * camera.zoom * 0.05);
        ctx.setLineDash([Math.max(4, camera.zoom * 5), Math.max(3, camera.zoom * 3)]);
        ctx.beginPath();
        ctx.moveTo(armyScreen.x, armyScreen.y);
        ctx.lineTo(targetScreen.x, targetScreen.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private drawArmy(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camera: Camera,
    id: string,
    worldX: number,
    worldY: number,
    civilizationId: string,
    soldiers: number,
    morale: number
  ): void {
    const screen = camera.worldToScreen(worldX, worldY);
    const size = TILE_SIZE * camera.zoom;
    const civilization = state.civilizations.find((item) => item.id === civilizationId);
    const color = civilization ? CIVILIZATION_COLORS[civilization.colorIndex % CIVILIZATION_COLORS.length] : "#d44c41";
    const selected = state.selected.kind === "tile" && Math.hypot(state.selected.x - worldX, state.selected.y - worldY) < 1.5;
    if (selected) {
      ctx.strokeStyle = "#fff3a6";
      ctx.lineWidth = Math.max(2, camera.zoom * 1.2);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(31, 23, 20, 0.42)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + size * 0.32, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(screen.x - size * 0.18, screen.y - size * 0.48);
    ctx.lineTo(screen.x + size * 0.42, screen.y - size * 0.34);
    ctx.lineTo(screen.x - size * 0.18, screen.y - size * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2d2520";
    ctx.lineWidth = Math.max(1, camera.zoom);
    ctx.beginPath();
    ctx.moveTo(screen.x - size * 0.18, screen.y - size * 0.5);
    ctx.lineTo(screen.x - size * 0.18, screen.y + size * 0.28);
    ctx.stroke();
    ctx.fillStyle = "#34302c";
    for (let i = 0; i < Math.min(5, soldiers); i += 1) {
      ctx.fillRect(screen.x - size * 0.38 + i * size * 0.17, screen.y - size * 0.04, size * 0.1, size * 0.24);
    }
    if (camera.zoom > 0.5) {
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = `${Math.max(8, size * 0.14)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${soldiers} · ${Math.round(morale)}`, screen.x, screen.y - size * 0.66);
    }
    void id;
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
