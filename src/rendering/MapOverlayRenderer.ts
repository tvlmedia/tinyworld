import { GameState } from "../app/GameState";
import { MapMode } from "../entities/Civilization";

const MODE_EMPTY_MESSAGES: Partial<Record<MapMode, (state: GameState) => string | undefined>> = {
  diplomacy: (state) =>
    state.civilizations.length < 2 || state.diplomaticRelations.length === 0 ? "Er zijn nog geen andere beschavingen ontdekt." : undefined,
  war: (state) => (state.wars.some((war) => war.active) ? undefined : "Er zijn momenteel geen oorlogen."),
  trade: (state) => (state.tradeRoutes.some((route) => route.active) ? undefined : "Er zijn nog geen handelsroutes."),
  technology: (state) => (state.civilizations.length === 0 ? "Technologische gegevens zijn nog niet beschikbaar." : undefined)
};

export class MapOverlayRenderer {
  draw(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number): void {
    const message = MODE_EMPTY_MESSAGES[state.mapMode]?.(state);
    if (message) this.drawMessage(ctx, message, width);
    this.drawLegend(ctx, state, width, height);
  }

  private drawMessage(ctx: CanvasRenderingContext2D, message: string, width: number): void {
    ctx.fillStyle = "rgba(18, 24, 23, 0.82)";
    roundRect(ctx, width / 2 - 165, 78, 330, 34, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(244, 241, 227, 0.92)";
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, width / 2, 99);
  }

  private drawLegend(ctx: CanvasRenderingContext2D, state: GameState, width: number, height: number): void {
    const items = legendItems(state);
    if (items.length === 0) return;
    const boxWidth = 160;
    const rowHeight = 18;
    const boxHeight = 14 + items.length * rowHeight;
    const x = Math.max(14, width - boxWidth - 374);
    const y = height - boxHeight - 18;
    ctx.fillStyle = "rgba(18, 24, 23, 0.74)";
    roundRect(ctx, x, y, boxWidth, boxHeight, 6);
    ctx.fill();
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const yy = y + 14 + index * rowHeight;
      ctx.fillStyle = item.color;
      ctx.fillRect(x + 10, yy - 8, 10, 10);
      ctx.fillStyle = "rgba(244, 241, 227, 0.86)";
      ctx.fillText(item.label, x + 27, yy + 1);
    }
  }
}

export function mapModeStatus(state: GameState): string | undefined {
  return MODE_EMPTY_MESSAGES[state.mapMode]?.(state);
}

function legendItems(state: GameState): { color: string; label: string }[] {
  switch (state.mapMode) {
    case "resources":
      return [
        { color: "rgba(232, 78, 78, 0.85)", label: "voedsel" },
        { color: "rgba(48, 151, 76, 0.85)", label: "hout" },
        { color: "rgba(190, 193, 196, 0.85)", label: "steen" }
      ];
    case "population":
      return [
        { color: "rgba(255, 229, 115, 0.85)", label: "hoge bevolking" },
        { color: "rgba(244, 137, 78, 0.6)", label: "lagere dichtheid" }
      ];
    case "technology":
      return [
        { color: "#4d6b8f", label: "laag tech" },
        { color: "#f3d06b", label: "hoog tech" }
      ];
    case "diplomacy":
      return [
        { color: "#67c879", label: "vriendelijk" },
        { color: "#d5c66d", label: "neutraal" },
        { color: "#df554b", label: "vijandig/oorlog" }
      ];
    case "war":
      return [{ color: "#df554b", label: "actieve oorlog" }];
    default:
      return [];
  }
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

