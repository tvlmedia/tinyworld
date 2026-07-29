import { TILE_SIZE } from "../app/Config";
import { Point, clamp } from "../utils/MathUtils";
import { World } from "../world/World";

const MIN_ZOOM = 0.18;
const MAX_ZOOM = 6;
const OVERVIEW_MARGIN = 72;

export class Camera {
  x = 0;
  y = 0;
  zoom = 2;
  private animation?: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    startZoom: number;
    targetZoom: number;
    startedAt: number;
    durationMs: number;
  };

  constructor(private readonly canvas: HTMLCanvasElement) {}

  centerOn(point: Point, world: World, options: { animate?: boolean; durationMs?: number; zoom?: number } = {}): void {
    const targetZoom = options.zoom ?? this.zoom;
    const viewport = this.viewportSize();
    const targetX = point.x * TILE_SIZE - viewport.width / (2 * targetZoom);
    const targetY = point.y * TILE_SIZE - viewport.height / (2 * targetZoom);
    if (options.animate) {
      this.animation = {
        startX: this.x,
        startY: this.y,
        targetX,
        targetY,
        startZoom: this.zoom,
        targetZoom,
        startedAt: performance.now(),
        durationMs: options.durationMs ?? 380
      };
      return;
    }
    this.animation = undefined;
    this.zoom = targetZoom;
    this.x = targetX;
    this.y = targetY;
    this.clampToWorld(world);
  }

  reset(world: World): void {
    this.fitToWorld(world);
  }

  focusVillage(world: World): void {
    this.zoom = 1.6;
    this.centerOn(world.spawn, world);
  }

  fitToWorld(world: World): void {
    const viewport = this.viewportSize();
    const worldWidth = world.width * TILE_SIZE;
    const worldHeight = world.height * TILE_SIZE;
    const usableWidth = Math.max(240, viewport.width - OVERVIEW_MARGIN * 2);
    const usableHeight = Math.max(180, viewport.height - OVERVIEW_MARGIN * 2);
    this.zoom = clamp(Math.min(usableWidth / worldWidth, usableHeight / worldHeight), MIN_ZOOM, 1.25);
    this.centerOn({ x: world.width / 2, y: world.height / 2 }, world);
  }

  pan(dx: number, dy: number, world: World): void {
    this.animation = undefined;
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.clampToWorld(world);
  }

  setZoom(nextZoom: number, world: World, screenPoint?: Point): void {
    this.animation = undefined;
    const before = screenPoint ? this.screenToWorld(screenPoint.x, screenPoint.y) : undefined;
    this.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    if (before && screenPoint) {
      const after = this.screenToWorld(screenPoint.x, screenPoint.y);
      this.x += (before.x - after.x) * TILE_SIZE;
      this.y += (before.y - after.y) * TILE_SIZE;
    }
    this.clampToWorld(world);
  }

  zoomBy(factor: number, world: World, screenPoint?: Point): void {
    this.setZoom(this.zoom * factor, world, screenPoint);
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
    const viewport = this.viewportSize();
    return {
      minX: clamp(Math.floor(this.x / TILE_SIZE) - 2, 0, world.width - 1),
      minY: clamp(Math.floor(this.y / TILE_SIZE) - 2, 0, world.height - 1),
      maxX: clamp(Math.ceil((this.x + viewport.width / this.zoom) / TILE_SIZE) + 2, 0, world.width - 1),
      maxY: clamp(Math.ceil((this.y + viewport.height / this.zoom) / TILE_SIZE) + 2, 0, world.height - 1)
    };
  }

  clampToWorld(world: World): void {
    const viewport = this.viewportSize();
    const viewportWidthInWorldPixels = viewport.width / this.zoom;
    const viewportHeightInWorldPixels = viewport.height / this.zoom;
    const worldWidth = world.width * TILE_SIZE;
    const worldHeight = world.height * TILE_SIZE;

    this.x =
      viewportWidthInWorldPixels >= worldWidth
        ? (worldWidth - viewportWidthInWorldPixels) / 2
        : clamp(this.x, 0, worldWidth - viewportWidthInWorldPixels);
    this.y =
      viewportHeightInWorldPixels >= worldHeight
        ? (worldHeight - viewportHeightInWorldPixels) / 2
        : clamp(this.y, 0, worldHeight - viewportHeightInWorldPixels);
  }

  updateAnimation(world: World, now = performance.now()): void {
    if (!this.animation) return;
    const elapsed = now - this.animation.startedAt;
    const t = clamp(elapsed / this.animation.durationMs, 0, 1);
    const eased = t * t * (3 - 2 * t);
    this.zoom = this.animation.startZoom + (this.animation.targetZoom - this.animation.startZoom) * eased;
    this.x = this.animation.startX + (this.animation.targetX - this.animation.startX) * eased;
    this.y = this.animation.startY + (this.animation.targetY - this.animation.startY) * eased;
    this.clampToWorld(world);
    if (t >= 1) this.animation = undefined;
  }

  private viewportSize(): { width: number; height: number } {
    return {
      width: this.canvas.clientWidth || this.canvas.width,
      height: this.canvas.clientHeight || this.canvas.height
    };
  }
}
