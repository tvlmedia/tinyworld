import { GameSpeed } from "../app/Config";
import { GameState } from "../app/GameState";
import { Renderer } from "../rendering/Renderer";
import { Point } from "../utils/MathUtils";
import { selectAtWorldPosition } from "./SelectionManager";
import { useToolAt } from "./ToolManager";

export interface InputCallbacks {
  onSelectionChanged: () => void;
  onPauseToggle: () => void;
  onSpeedChange: (speed: GameSpeed) => void;
}

export class InputManager {
  private dragging = false;
  private lastPointer?: Point;
  private pointerDownAt?: Point;
  private lastTouchDistance?: number;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly state: GameState,
    private readonly renderer: Renderer,
    private readonly callbacks: InputCallbacks
  ) {}

  bind(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    window.removeEventListener("keydown", this.onKeyDown);
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.canvas.setPointerCapture(event.pointerId);
    this.dragging = true;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.pointerDownAt = { x: event.clientX, y: event.clientY };
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging || !this.lastPointer) return;
    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    this.renderer.camera.pan(dx, dy, this.state.world);
    this.lastPointer = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointerDownAt) return;
    const moved = Math.hypot(event.clientX - this.pointerDownAt.x, event.clientY - this.pointerDownAt.y);
    this.dragging = false;
    this.lastPointer = undefined;
    this.pointerDownAt = undefined;
    if (moved > 6) return;
    const rect = this.canvas.getBoundingClientRect();
    const world = this.renderer.camera.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
    const tileX = Math.floor(world.x);
    const tileY = Math.floor(world.y);
    if (!useToolAt(this.state, this.state.activeTool, tileX, tileY)) {
      this.state.selected = selectAtWorldPosition(this.state, world.x, world.y);
      this.callbacks.onSelectionChanged();
    }
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const delta = event.deltaY > 0 ? -0.16 : 0.16;
    this.renderer.camera.setZoom(this.renderer.camera.zoom + delta, this.state.world, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  private onTouchMove = (event: TouchEvent): void => {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    const [first, second] = [event.touches[0], event.touches[1]];
    const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    if (this.lastTouchDistance !== undefined) {
      const delta = (distance - this.lastTouchDistance) / 160;
      this.renderer.camera.setZoom(this.renderer.camera.zoom + delta, this.state.world);
    }
    this.lastTouchDistance = distance;
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName)) return;
    if (event.key === " ") {
      event.preventDefault();
      this.callbacks.onPauseToggle();
    } else if (event.key === "+" || event.key === "=") {
      this.callbacks.onSpeedChange(nextSpeed(this.state.time.speed));
    } else if (event.key === "-") {
      this.renderer.camera.setZoom(this.renderer.camera.zoom - 0.2, this.state.world);
    } else if (event.key.toLowerCase() === "d") {
      this.state.debug.enabled = !this.state.debug.enabled;
    }
  };
}

function nextSpeed(speed: GameSpeed): GameSpeed {
  if (speed === 1) return 2;
  if (speed === 2) return 4;
  if (speed === 4) return 8;
  return 1;
}
