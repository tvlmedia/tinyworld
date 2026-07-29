import { GameState } from "../app/GameState";
import { TILE_SIZE } from "../app/Config";
import { CIVILIZATION_COLORS } from "../config/civilizationConfig";
import { tileIndex } from "../world/World";
import { Camera } from "./Camera";

export class TerritoryRenderer {
  draw(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera): void {
    if (state.mapMode === "normal") return;
    const bounds = camera.visibleTileBounds(state.world);
    const size = TILE_SIZE * camera.zoom;
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const owner = state.territory.ownerByTile[tileIndex(state.world, x, y)];
        if (!owner) continue;
        const civilization = state.civilizations.find((item) => item.id === owner);
        if (!civilization) continue;
        const screen = camera.worldToScreen(x, y);
        const color = CIVILIZATION_COLORS[civilization.colorIndex % CIVILIZATION_COLORS.length];
        const alpha = state.mapMode === "political" ? 0.18 : state.mapMode === "diplomacy" ? 0.12 : 0.1;
        ctx.fillStyle = hexToRgba(color, alpha);
        ctx.fillRect(Math.floor(screen.x), Math.floor(screen.y), Math.ceil(size), Math.ceil(size));
        this.drawBorder(ctx, state, camera, x, y, owner, color, size);
      }
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

function hexToRgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = value >> 16;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
