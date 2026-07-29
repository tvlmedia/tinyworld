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
  private hasDragged = false;
  private lastPointer?: Point;
  private pointerDownAt?: Point;
  private pointerId?: number;
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
    this.canvas.addEventListener("touchend", this.onTouchEnd);
    this.canvas.addEventListener("touchcancel", this.onTouchEnd);
    window.addEventListener("keydown", this.onKeyDown);
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
    this.canvas.removeEventListener("touchcancel", this.onTouchEnd);
    window.removeEventListener("keydown", this.onKeyDown);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || (event.pointerType === "touch" && !event.isPrimary)) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.pointerId = event.pointerId;
    this.dragging = true;
    this.hasDragged = false;
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.pointerDownAt = { x: event.clientX, y: event.clientY };
    this.canvas.classList.add("is-panning");
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging || !this.lastPointer || event.pointerId !== this.pointerId) return;
    const dx = event.clientX - this.lastPointer.x;
    const dy = event.clientY - this.lastPointer.y;
    if (this.pointerDownAt && Math.hypot(event.clientX - this.pointerDownAt.x, event.clientY - this.pointerDownAt.y) > 4) {
      this.hasDragged = true;
    }
    this.renderer.camera.pan(dx, dy, this.state.world);
    this.lastPointer = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointerDownAt || event.pointerId !== this.pointerId) return;
    const moved = Math.hypot(event.clientX - this.pointerDownAt.x, event.clientY - this.pointerDownAt.y);
    this.dragging = false;
    this.lastPointer = undefined;
    this.pointerDownAt = undefined;
    this.pointerId = undefined;
    this.canvas.classList.remove("is-panning");
    if (this.hasDragged || moved > 6) return;
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
    const factor = Math.exp(-event.deltaY * 0.0018);
    this.renderer.camera.zoomBy(factor, this.state.world, {
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
      const rect = this.canvas.getBoundingClientRect();
      const center = {
        x: (first.clientX + second.clientX) / 2 - rect.left,
        y: (first.clientY + second.clientY) / 2 - rect.top
      };
      this.renderer.camera.zoomBy(distance / this.lastTouchDistance, this.state.world, center);
    }
    this.lastTouchDistance = distance;
  };

  private onTouchEnd = (): void => {
    this.lastTouchDistance = undefined;
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName)) return;
    if (event.key === " ") {
      event.preventDefault();
      this.callbacks.onPauseToggle();
    } else if (event.key === "1" || event.key === "2" || event.key === "4" || event.key === "8") {
      this.callbacks.onSpeedChange(Number(event.key) as GameSpeed);
    } else if (event.key === "+" || event.key === "=") {
      this.renderer.camera.zoomBy(1.25, this.state.world);
    } else if (event.key === "-") {
      this.renderer.camera.zoomBy(1 / 1.25, this.state.world);
    } else if (event.key === "0") {
      this.renderer.camera.fitToWorld(this.state.world);
    } else if (event.key.toLowerCase() === "f") {
      this.renderer.camera.focusVillage(this.state.world);
    } else if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
      this.renderer.camera.pan(0, 90, this.state.world);
    } else if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
      this.renderer.camera.pan(0, -90, this.state.world);
    } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      this.renderer.camera.pan(90, 0, this.state.world);
    } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      this.renderer.camera.pan(-90, 0, this.state.world);
    } else if (event.key === "`") {
      this.state.debug.enabled = !this.state.debug.enabled;
    }
  };
}
