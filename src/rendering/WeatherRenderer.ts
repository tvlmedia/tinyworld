import { GameState } from "../app/GameState";

export class WeatherRenderer {
  draw(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number, time: number): void {
    if (!state.settings.weatherAnimations) return;

    if (state.weather.current === "cloudy" || state.weather.current === "rain" || state.weather.current === "storm") {
      this.drawCloudShadows(ctx, state, width, height);
    }

    if (state.weather.current === "rain" || state.weather.current === "storm") {
      this.drawRain(ctx, width, height, time, state.weather.current === "storm");
    }

    if (state.weather.lightningFlash > 0) {
      ctx.fillStyle = `rgba(246, 250, 255, ${state.weather.lightningFlash * 0.45})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  private drawCloudShadows(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number): void {
    ctx.fillStyle = "rgba(40, 58, 62, 0.08)";
    const spacing = 260;
    for (let x = -spacing; x < width + spacing; x += spacing) {
      const offsetX = (x + state.weather.cloudOffset * 0.35) % (width + spacing) - spacing;
      ctx.beginPath();
      ctx.ellipse(offsetX, height * 0.25, 160, 46, 0.1, 0, Math.PI * 2);
      ctx.ellipse(offsetX + 120, height * 0.48, 190, 55, -0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRain(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, storm: boolean): void {
    ctx.strokeStyle = storm ? "rgba(210, 232, 250, 0.55)" : "rgba(210, 232, 250, 0.42)";
    ctx.lineWidth = storm ? 1.6 : 1;
    const count = storm ? 120 : 75;
    for (let i = 0; i < count; i += 1) {
      const x = (i * 97 + time * 0.28) % (width + 80) - 40;
      const y = (i * 53 + time * 0.72) % (height + 70) - 40;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 10, y + 22);
      ctx.stroke();
    }
  }
}
