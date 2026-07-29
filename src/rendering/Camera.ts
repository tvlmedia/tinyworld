import { TILE_SIZE } from "../app/Config";
import { Point, clamp } from "../utils/MathUtils";
import { World } from "../world/World";

export class Camera {
  x = 0;
  y = 0;
  zoom = 2;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  centerOn(point: Point, world: World): void {
    this.x = point.x * TILE_SIZE - this.canvas.width / (2 * this.zoom);
    this.y = point.y * TILE_SIZE - this.canvas.height / (2 * this.zoom);
    this.clampToWorld(world);
  }

  reset(world: World): void {
    this.zoom = 2;
    this.centerOn(world.spawn, world);
  }

  pan(dx: number, dy: number, world: World): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.clampToWorld(world);
  }

  setZoom(nextZoom: number, world: World, screenPoint?: Point): void {
    const before = screenPoint ? this.screenToWorld(screenPoint.x, screenPoint.y) : undefined;
    this.zoom = clamp(nextZoom, 0.6, 5);
    if (before && screenPoint) {
      const after = this.screenToWorld(screenPoint.x, screenPoint.y);
      this.x += before.x - after.x;
      this.y += before.y - after.y;
    }
    this.clampToWorld(world);
  }

  screenToWorld(screenX: number, screenY: number): Point {
    return {
      x: (screenX / this.zoom + this.x) / TILE_SIZE,
      y: (screenY / this.zoom + this.y) / TILE_SIZE
    };
  }

  worldToScreen(worldX: number, worldY: number): Point {
    return {
      x: (worldX * TILE_SIZE - this.x) * this.zoom,
      y: (worldY * TILE_SIZE - this.y) * this.zoom
    };
  }

  visibleTileBounds(world: World): { minX: number; minY: number; maxX: number; maxY: number } {
    return {
      minX: clamp(Math.floor(this.x / TILE_SIZE) - 2, 0, world.width - 1),
      minY: clamp(Math.floor(this.y / TILE_SIZE) - 2, 0, world.height - 1),
      maxX: clamp(Math.ceil((this.x + this.canvas.width / this.zoom) / TILE_SIZE) + 2, 0, world.width - 1),
      maxY: clamp(Math.ceil((this.y + this.canvas.height / this.zoom) / TILE_SIZE) + 2, 0, world.height - 1)
    };
  }

  clampToWorld(world: World): void {
    const maxX = Math.max(0, world.width * TILE_SIZE - this.canvas.width / this.zoom);
    const maxY = Math.max(0, world.height * TILE_SIZE - this.canvas.height / this.zoom);
    this.x = clamp(this.x, 0, maxX);
    this.y = clamp(this.y, 0, maxY);
  }
}
