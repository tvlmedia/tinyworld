import { GameState } from "../app/GameState";
import { daylightAmount } from "../simulation/TimeSystem";

export class LightingRenderer {
  draw(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number): void {
    const daylight = daylightAmount(state.time.minutes);
    const alpha = (1 - daylight) * 0.42;
    if (alpha <= 0.02) return;
    ctx.fillStyle = `rgba(15, 25, 46, ${alpha})`;
    ctx.fillRect(0, 0, width, height);
  }
}
