import { GameState } from "../app/GameState";
import { TILE_SIZE } from "../app/Config";
import { CIVILIZATION_COLORS } from "../config/civilizationConfig";
import { tileIndex } from "../world/World";
import { Camera } from "./Camera";

export class TerritoryRenderer {
  draw(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera): void {
    if (state.mapMode === "normal" || state.mapMode === "trade") return;
    if (state.mapMode === "population") {
      this.drawPopulation(ctx, state, camera);
      return;
    }
    const bounds = camera.visibleTileBounds(state.world);
    const size = TILE_SIZE * camera.zoom;
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        if (state.mapMode === "resources") {
          const tile = state.world.tiles[tileIndex(state.world, x, y)];
          const resourceColor = resourceOverlayColor(tile);
          if (!resourceColor) continue;
          const screen = camera.worldToScreen(x, y);
          ctx.fillStyle = resourceColor;
          ctx.fillRect(Math.floor(screen.x), Math.floor(screen.y), Math.ceil(size), Math.ceil(size));
          continue;
        }
        const owner = state.territory.ownerByTile[tileIndex(state.world, x, y)];
        if (!owner) continue;
        const civilization = state.civilizations.find((item) => item.id === owner);
        if (!civilization) continue;
        const screen = camera.worldToScreen(x, y);
        const color = overlayCivilizationColor(state, owner);
        const alpha = state.mapMode === "political" ? 0.18 : state.mapMode === "diplomacy" ? 0.16 : state.mapMode === "technology" ? 0.2 : state.mapMode === "war" ? 0.16 : 0.1;
        ctx.fillStyle = hexToRgba(color, alpha);
        ctx.fillRect(Math.floor(screen.x), Math.floor(screen.y), Math.ceil(size), Math.ceil(size));
        this.drawBorder(ctx, state, camera, x, y, owner, color, size);
      }
    }
  }

  private drawPopulation(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera): void {
    const bounds = camera.visibleTileBounds(state.world);
    for (const settlement of state.settlements) {
      if (settlement.centerX < bounds.minX - 30 || settlement.centerX > bounds.maxX + 30 || settlement.centerY < bounds.minY - 30 || settlement.centerY > bounds.maxY + 30) continue;
      const screen = camera.worldToScreen(settlement.centerX, settlement.centerY);
      const radius = Math.max(8, Math.sqrt(Math.max(1, settlement.population)) * TILE_SIZE * camera.zoom * 0.65);
      const gradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius);
      gradient.addColorStop(0, "rgba(255, 229, 115, 0.34)");
      gradient.addColorStop(0.62, "rgba(244, 137, 78, 0.18)");
      gradient.addColorStop(1, "rgba(244, 137, 78, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBorder(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    camera: Camera,
    x: number,
    y: number,
    owner: string,
    color: string,
    size: number
  ): void {
    const screen = camera.worldToScreen(x, y);
    const neighbors = [
      { dx: 0, dy: -1, line: [0, 0, 1, 0] },
      { dx: 1, dy: 0, line: [1, 0, 1, 1] },
      { dx: 0, dy: 1, line: [0, 1, 1, 1] },
      { dx: -1, dy: 0, line: [0, 0, 0, 1] }
    ] as const;
    ctx.strokeStyle = hexToRgba(color, state.mapMode === "political" ? 0.75 : 0.48);
    ctx.lineWidth = Math.max(1, size * 0.05);
    for (const neighbor of neighbors) {
      const nx = x + neighbor.dx;
      const ny = y + neighbor.dy;
      const other =
        nx < 0 || ny < 0 || nx >= state.world.width || ny >= state.world.height
          ? null
          : state.territory.ownerByTile[tileIndex(state.world, nx, ny)];
      if (other === owner) continue;
      const [x1, y1, x2, y2] = neighbor.line;
      ctx.beginPath();
      ctx.moveTo(screen.x + size * x1, screen.y + size * y1);
      ctx.lineTo(screen.x + size * x2, screen.y + size * y2);
      ctx.stroke();
    }
  }
}

function overlayCivilizationColor(state: GameState, ownerId: string): string {
  const owner = state.civilizations.find((item) => item.id === ownerId);
  if (!owner) return "#ffffff";
  if (state.mapMode === "technology") {
    const value = Math.min(1, owner.technologicalStrength / 100);
    return interpolateColor("#4d6b8f", "#f3d06b", value);
  }
  if (state.mapMode === "diplomacy") {
    const selectedId = state.selectedCivilizationId ?? state.civilizations[0]?.id;
    if (!selectedId || selectedId === ownerId) return "#6db6ff";
    const relation = state.diplomaticRelations.find(
      (item) =>
        (item.civilizationAId === selectedId && item.civilizationBId === ownerId) ||
        (item.civilizationBId === selectedId && item.civilizationAId === ownerId)
    );
    if (relation?.status === "allied" || relation?.status === "friendly") return "#67c879";
    if (relation?.status === "atWar" || relation?.status === "hostile") return "#df554b";
    return "#d5c66d";
  }
  if (state.mapMode === "war") {
    const atWar = state.wars.some((war) => war.active && (war.attackerCivilizationIds.includes(ownerId) || war.defenderCivilizationIds.includes(ownerId)));
    return atWar ? "#df554b" : "#7c8386";
  }
  return CIVILIZATION_COLORS[owner.colorIndex % CIVILIZATION_COLORS.length];
}

function resourceOverlayColor(tile: { type: string; resourceAmount: number } | undefined): string | undefined {
  if (!tile) return undefined;
  if (tile.type === "forest") return "rgba(48, 151, 76, 0.34)";
  if (tile.type === "rock") return "rgba(190, 193, 196, 0.38)";
  if ((tile.type === "grass" || tile.type === "farmland") && tile.resourceAmount > 0) return "rgba(232, 78, 78, 0.34)";
  return undefined;
}

function hexToRgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = value >> 16;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function interpolateColor(a: string, b: string, t: number): string {
  const av = Number.parseInt(a.slice(1), 16);
  const bv = Number.parseInt(b.slice(1), 16);
  const ar = av >> 16;
  const ag = (av >> 8) & 255;
  const ab = av & 255;
  const br = bv >> 16;
  const bg = (bv >> 8) & 255;
  const bb = bv & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const blue = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
