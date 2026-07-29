import { GameState } from "../app/GameState";
import { TILE_SIZE } from "../app/Config";
import { hash2D } from "../utils/MathUtils";
import { Tile, TileType, isWater } from "../world/Tile";
import { getTile } from "../world/World";
import { Camera } from "./Camera";

const COLORS: Record<TileType, string> = {
  deepWater: "#235b8a",
  water: "#3c8fc4",
  sand: "#d7c16f",
  grass: "#65a85f",
  forest: "#2f7b4b",
  rock: "#8c9294",
  mountain: "#727a82",
  farmland: "#9e8b4f",
  road: "#9d8060",
  burned: "#4f4b45"
};

export class TileRenderer {
  draw(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera, time: number): void {
    const bounds = camera.visibleTileBounds(state.world);
    const size = TILE_SIZE * camera.zoom;
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const tile = getTile(state.world, x, y);
        if (!tile) continue;
        const screen = camera.worldToScreen(x, y);
        this.drawTile(ctx, state, tile, screen.x, screen.y, size, time);
      }
    }

    if (state.debug.enabled && state.debug.showChunks) {
      this.drawChunks(ctx, camera, state);
    }
  }

  private drawTile(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    tile: Tile,
    screenX: number,
    screenY: number,
    size: number,
    time: number
  ): void {
    const variation = hash2D(tile.x, tile.y, 42) - 0.5;
    ctx.fillStyle = shade(COLORS[tile.type], variation * 18 + (tile.moisture - 0.5) * 8);
    if (state.weather.current === "drought" && (tile.type === "grass" || tile.type === "forest")) {
      ctx.fillStyle = shade(ctx.fillStyle, -18);
    }
    ctx.fillRect(Math.floor(screenX), Math.floor(screenY), Math.ceil(size), Math.ceil(size));

    switch (tile.type) {
      case "water":
      case "deepWater":
        this.drawWater(ctx, tile, screenX, screenY, size, time);
        if (touchesLand(state, tile)) this.drawFoam(ctx, screenX, screenY, size, time);
        break;
      case "grass":
        this.drawGrassDetails(ctx, tile, screenX, screenY, size);
        break;
      case "forest":
        this.drawForest(ctx, tile, screenX, screenY, size, time);
        break;
      case "rock":
        this.drawRock(ctx, screenX, screenY, size);
        break;
      case "mountain":
        this.drawMountain(ctx, screenX, screenY, size);
        break;
      case "road":
        this.drawRoad(ctx, state, tile, screenX, screenY, size);
        break;
      case "farmland":
        this.drawFarmland(ctx, tile, screenX, screenY, size);
        break;
      case "burned":
        this.drawAsh(ctx, tile, screenX, screenY, size);
        break;
      case "sand":
        this.drawSand(ctx, tile, screenX, screenY, size);
        break;
    }
  }

  private drawWater(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, size: number, time: number): void {
    ctx.strokeStyle = "rgba(231, 250, 255, 0.25)";
    ctx.lineWidth = Math.max(1, size / 18);
    const wave = (time * 0.002 + hash2D(tile.x, tile.y, 7) * 4) % 4;
    for (let i = 0; i < 2; i += 1) {
      const yy = y + ((i * 6 + wave) / 16) * size;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.15, yy);
      ctx.lineTo(x + size * 0.85, yy + Math.sin(time * 0.003 + i) * size * 0.05);
      ctx.stroke();
    }
  }

  private drawFoam(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number): void {
    ctx.fillStyle = `rgba(255,255,240,${0.18 + Math.sin(time * 0.004) * 0.05})`;
    ctx.fillRect(x, y + size * 0.08, size, Math.max(1, size * 0.08));
  }

  private drawGrassDetails(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, size: number): void {
    const detail = hash2D(tile.x, tile.y, 96);
    ctx.fillStyle = detail > 0.7 ? "#dbe889" : "rgba(35, 99, 45, 0.28)";
    ctx.fillRect(x + size * (0.2 + detail * 0.45), y + size * 0.35, Math.max(1, size * 0.08), Math.max(1, size * 0.08));
    if (tile.resourceAmount > 0) {
      ctx.fillStyle = "#c94848";
      ctx.fillRect(x + size * 0.56, y + size * 0.55, Math.max(2, size * 0.12), Math.max(2, size * 0.12));
    }
  }

  private drawForest(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, size: number, time: number): void {
    const sway = Math.sin(time * 0.002 + tile.x * 0.6 + tile.y) * size * 0.025;
    const scale = 0.45 + tile.resourceAmount * 0.055;
    ctx.fillStyle = "#5b3e2d";
    ctx.fillRect(x + size * 0.43, y + size * 0.45, size * 0.16, size * 0.36);
    ctx.fillStyle = shade("#2e7d45", hash2D(tile.x, tile.y, 5) * 18);
    ctx.beginPath();
    ctx.arc(x + size * 0.5 + sway, y + size * 0.36, size * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(20, 74, 39, 0.35)";
    ctx.fillRect(x + size * 0.18, y + size * 0.62, size * 0.65, size * 0.1);
  }

  private drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.fillStyle = "#a7aaad";
    ctx.beginPath();
    ctx.moveTo(x + size * 0.25, y + size * 0.75);
    ctx.lineTo(x + size * 0.48, y + size * 0.28);
    ctx.lineTo(x + size * 0.75, y + size * 0.72);
    ctx.closePath();
    ctx.fill();
  }

  private drawMountain(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.fillStyle = "#969da4";
    ctx.beginPath();
    ctx.moveTo(x + size * 0.12, y + size * 0.86);
    ctx.lineTo(x + size * 0.5, y + size * 0.12);
    ctx.lineTo(x + size * 0.9, y + size * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#565e67";
    ctx.beginPath();
    ctx.moveTo(x + size * 0.5, y + size * 0.12);
    ctx.lineTo(x + size * 0.9, y + size * 0.86);
    ctx.lineTo(x + size * 0.56, y + size * 0.76);
    ctx.closePath();
    ctx.fill();
  }

  private drawRoad(ctx: CanvasRenderingContext2D, state: GameState, tile: Tile, x: number, y: number, size: number): void {
    ctx.fillStyle = "#a98661";
    ctx.fillRect(x + size * 0.22, y + size * 0.22, size * 0.56, size * 0.56);
    const directions = [
      { dx: 1, dy: 0, rect: [0.5, 0.22, 0.5, 0.56] },
      { dx: -1, dy: 0, rect: [0, 0.22, 0.5, 0.56] },
      { dx: 0, dy: 1, rect: [0.22, 0.5, 0.56, 0.5] },
      { dx: 0, dy: -1, rect: [0.22, 0, 0.56, 0.5] }
    ] as const;
    for (const direction of directions) {
      if (getTile(state.world, tile.x + direction.dx, tile.y + direction.dy)?.type === "road") {
        const [rx, ry, rw, rh] = direction.rect;
        ctx.fillRect(x + size * rx, y + size * ry, size * rw, size * rh);
      }
    }
  }

  private drawFarmland(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, size: number): void {
    ctx.strokeStyle = "#6f633f";
    ctx.lineWidth = Math.max(1, size / 18);
    for (let i = 2; i < 16; i += 4) {
      ctx.beginPath();
      ctx.moveTo(x, y + (i / 16) * size);
      ctx.lineTo(x + size, y + ((i + 2) / 16) * size);
      ctx.stroke();
    }
    if (tile.resourceAmount > 1) {
      ctx.fillStyle = "#78b55f";
      ctx.fillRect(x + size * 0.35, y + size * 0.28, size * 0.25, size * 0.42);
    }
  }

  private drawAsh(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, size: number): void {
    ctx.fillStyle = hash2D(tile.x, tile.y, 71) > 0.55 ? "#262323" : "#5b554e";
    ctx.fillRect(x + size * 0.2, y + size * 0.55, size * 0.48, Math.max(1, size * 0.1));
  }

  private drawSand(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, size: number): void {
    ctx.fillStyle = "rgba(255,255,210,0.22)";
    ctx.fillRect(x + size * hash2D(tile.x, tile.y, 55) * 0.7, y + size * 0.65, Math.max(1, size * 0.12), Math.max(1, size * 0.08));
  }

  private drawChunks(ctx: CanvasRenderingContext2D, camera: Camera, state: GameState): void {
    const size = 16 * TILE_SIZE * camera.zoom;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    for (let y = 0; y <= state.world.height; y += 16) {
      for (let x = 0; x <= state.world.width; x += 16) {
        const screen = camera.worldToScreen(x, y);
        ctx.strokeRect(screen.x, screen.y, size, size);
      }
    }
  }
}

function touchesLand(state: GameState, tile: Tile): boolean {
  const neighbors = [
    getTile(state.world, tile.x + 1, tile.y),
    getTile(state.world, tile.x - 1, tile.y),
    getTile(state.world, tile.x, tile.y + 1),
    getTile(state.world, tile.x, tile.y - 1)
  ];
  return neighbors.some((neighbor) => neighbor && !isWater(neighbor.type));
}

function shade(hex: string, amount: number): string {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  const value = Number.parseInt(normalized, 16);
  const r = Math.max(0, Math.min(255, (value >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}
