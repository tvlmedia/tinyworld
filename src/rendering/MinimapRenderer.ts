import { GameState } from "../app/GameState";
import { CIVILIZATION_COLORS } from "../config/civilizationConfig";
import { isWater } from "../world/Tile";
import { Camera } from "./Camera";

export interface MinimapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class MinimapRenderer {
  private cache?: { key: string; canvas: HTMLCanvasElement };
  private rect: MinimapRect = { x: 0, y: 0, width: 0, height: 0 };

  draw(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera, viewportWidth: number, viewportHeight: number): void {
    this.rect = minimapRect(viewportWidth, viewportHeight);
    const base = this.baseCanvas(state);
    ctx.fillStyle = "rgba(18, 24, 23, 0.82)";
    roundRect(ctx, this.rect.x - 6, this.rect.y - 6, this.rect.width + 12, this.rect.height + 12, 8);
    ctx.fill();
    ctx.drawImage(base, this.rect.x, this.rect.y, this.rect.width, this.rect.height);
    this.drawMarkers(ctx, state);
    this.drawViewport(ctx, state, camera);
  }

  hitTest(screenX: number, screenY: number): boolean {
    return screenX >= this.rect.x && screenY >= this.rect.y && screenX <= this.rect.x + this.rect.width && screenY <= this.rect.y + this.rect.height;
  }

  screenToWorld(screenX: number, screenY: number, state: GameState): { x: number; y: number } {
    return minimapScreenToWorld(screenX, screenY, this.rect, state.world.width, state.world.height);
  }

  private baseCanvas(state: GameState): HTMLCanvasElement {
    const key = `${state.world.seed}:${state.world.width}:${state.world.height}:${state.world.version}:${state.mapMode === "political" ? state.territory.version : 0}:${state.mapMode}`;
    if (this.cache?.key === key) return this.cache.canvas;
    const canvas = document.createElement("canvas");
    canvas.width = state.world.width;
    canvas.height = state.world.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const image = ctx.createImageData(state.world.width, state.world.height);
    for (let index = 0; index < state.world.tiles.length; index += 1) {
      const tile = state.world.tiles[index];
      const color =
        state.mapMode === "political" && state.territory.ownerByTile[index]
          ? civilizationColor(state, state.territory.ownerByTile[index]!)
          : isWater(tile.type)
            ? tile.type === "deepWater"
              ? [35, 91, 138]
              : [60, 143, 196]
            : tile.type === "mountain"
              ? [114, 122, 130]
              : tile.type === "forest"
                ? [47, 123, 75]
                : tile.type === "rock"
                  ? [140, 146, 148]
                  : [101, 168, 95];
      const offset = index * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    this.cache = { key, canvas };
    return canvas;
  }

  private drawMarkers(ctx: CanvasRenderingContext2D, state: GameState): void {
    for (const settlement of state.settlements) {
      const screen = minimapWorldToScreen(settlement.centerX, settlement.centerY, this.rect, state.world.width, state.world.height);
      const civilization = state.civilizations.find((item) => item.id === settlement.civilizationId);
      const capital = civilization?.capitalSettlementId === settlement.id;
      const color = civilization ? CIVILIZATION_COLORS[civilization.colorIndex % CIVILIZATION_COLORS.length] : "#f2c14e";
      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(18, 24, 23, 0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, capital ? 3.2 : 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawViewport(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera): void {
    const bounds = camera.visibleTileBounds(state.world);
    const topLeft = minimapWorldToScreen(bounds.minX, bounds.minY, this.rect, state.world.width, state.world.height);
    const bottomRight = minimapWorldToScreen(bounds.maxX, bounds.maxY, this.rect, state.world.width, state.world.height);
    ctx.strokeStyle = "rgba(255, 245, 176, 0.92)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(topLeft.x, topLeft.y, Math.max(4, bottomRight.x - topLeft.x), Math.max(4, bottomRight.y - topLeft.y));
  }
}

export function minimapRect(viewportWidth: number, viewportHeight: number): MinimapRect {
  const size = Math.min(154, Math.max(112, viewportHeight * 0.16));
  return {
    x: viewportWidth > 940 ? 318 : 14,
    y: viewportHeight - size - 18,
    width: size,
    height: size
  };
}

export function minimapWorldToScreen(worldX: number, worldY: number, rect: MinimapRect, worldWidth: number, worldHeight: number): { x: number; y: number } {
  return {
    x: rect.x + (worldX / Math.max(1, worldWidth)) * rect.width,
    y: rect.y + (worldY / Math.max(1, worldHeight)) * rect.height
  };
}

export function minimapScreenToWorld(screenX: number, screenY: number, rect: MinimapRect, worldWidth: number, worldHeight: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(worldWidth - 1, ((screenX - rect.x) / rect.width) * worldWidth)),
    y: Math.max(0, Math.min(worldHeight - 1, ((screenY - rect.y) / rect.height) * worldHeight))
  };
}

function civilizationColor(state: GameState, civilizationId: string): [number, number, number] {
  const civilization = state.civilizations.find((item) => item.id === civilizationId);
  const hex = civilization ? CIVILIZATION_COLORS[civilization.colorIndex % CIVILIZATION_COLORS.length] : "#9aa0a0";
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

