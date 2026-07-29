import { GameState } from "../app/GameState";
import { TILE_SIZE } from "../app/Config";
import { CIVILIZATION_COLORS } from "../config/civilizationConfig";
import { SETTLEMENT_TIER_LABELS } from "../config/settlementConfig";
import { Settlement } from "../entities/Civilization";
import { Camera } from "./Camera";

export interface SettlementLabelHitbox {
  settlementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LabelCandidate extends SettlementLabelHitbox {
  priority: number;
  markerX: number;
  markerY: number;
  color: string;
  title: string;
  subtitle: string;
  selected: boolean;
  capital: boolean;
}

export class SettlementRenderer {
  private hitboxes: SettlementLabelHitbox[] = [];

  draw(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera, time: number): void {
    this.hitboxes = [];
    if (state.settings.settlementInfluence && state.mapMode === "normal") this.drawInfluence(ctx, state, camera);
    this.drawMarkers(ctx, state, camera, time);
    this.drawLabels(ctx, state, camera);
  }

  hitTest(screenX: number, screenY: number): string | undefined {
    return this.hitboxes.find((hitbox) => screenX >= hitbox.x && screenY >= hitbox.y && screenX <= hitbox.x + hitbox.width && screenY <= hitbox.y + hitbox.height)?.settlementId;
  }

  private drawInfluence(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera): void {
    for (const settlement of visibleSettlements(state, camera, 24)) {
      const civilization = state.civilizations.find((item) => item.id === settlement.civilizationId);
      if (!civilization) continue;
      const screen = camera.worldToScreen(settlement.centerX, settlement.centerY);
      const color = CIVILIZATION_COLORS[civilization.colorIndex % CIVILIZATION_COLORS.length];
      const radius = influenceRadius(settlement) * TILE_SIZE * camera.zoom;
      ctx.fillStyle = hexToRgba(color, 0.045);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(color, 0.22);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawMarkers(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera, time: number): void {
    for (const settlement of visibleSettlements(state, camera, 8)) {
      const screen = camera.worldToScreen(settlement.centerX, settlement.centerY);
      const civilization = state.civilizations.find((item) => item.id === settlement.civilizationId);
      const color = civilization ? CIVILIZATION_COLORS[civilization.colorIndex % CIVILIZATION_COLORS.length] : "#f1d36b";
      const selected = state.selected.kind === "settlement" && state.selected.id === settlement.id;
      const capital = civilization?.capitalSettlementId === settlement.id;
      const size = Math.max(6, Math.min(15, TILE_SIZE * camera.zoom * (capital ? 0.8 : 0.58)));

      if (selected) {
        const pulse = 1 + Math.sin(time * 0.006) * 0.08;
        ctx.strokeStyle = "rgba(255, 245, 176, 0.86)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, size * 1.25 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(18, 24, 23, 0.72)";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, size * 0.68, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      if (capital) {
        drawDiamond(ctx, screen.x, screen.y, size * 0.62);
      } else if (settlement.tier === "city" || settlement.tier === "town") {
        ctx.fillRect(screen.x - size * 0.45, screen.y - size * 0.45, size * 0.9, size * 0.9);
      } else {
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, size * 0.44, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawLabels(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera): void {
    const candidates = labelCandidates(ctx, state, camera);
    const placed: SettlementLabelHitbox[] = [];
    for (const candidate of candidates) {
      const positioned = placeCandidate(candidate, placed);
      if (!positioned && !candidate.selected) continue;
      const label = positioned ?? candidate;
      placed.push(label);
      this.hitboxes.push({ settlementId: label.settlementId, x: label.x, y: label.y, width: label.width, height: label.height });
      drawLabel(ctx, label);
    }
  }
}

export function settlementLabelData(state: GameState, settlement: Settlement): { title: string; subtitle: string; priority: number } {
  const civilization = state.civilizations.find((item) => item.id === settlement.civilizationId);
  const capital = civilization?.capitalSettlementId === settlement.id;
  const tier = capital ? "Hoofdstad" : SETTLEMENT_TIER_LABELS[settlement.tier];
  return {
    title: settlement.name,
    subtitle: `${tier} · ${settlement.population} inwoners`,
    priority: settlementPriority(settlement, capital, state.selected.kind === "settlement" && state.selected.id === settlement.id)
  };
}

function labelCandidates(ctx: CanvasRenderingContext2D, state: GameState, camera: Camera): LabelCandidate[] {
  const farZoom = camera.zoom < 0.34;
  const normalZoom = camera.zoom >= 0.34 && camera.zoom < 1.75;
  const fontSize = farZoom ? 11 : 12;
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  return visibleSettlements(state, camera, 12)
    .map((settlement) => {
      const civilization = state.civilizations.find((item) => item.id === settlement.civilizationId);
      const selected = state.selected.kind === "settlement" && state.selected.id === settlement.id;
      const capital = civilization?.capitalSettlementId === settlement.id;
      const data = settlementLabelData(state, settlement);
      const title = data.title;
      const subtitle = farZoom ? `${capital ? "◆" : "●"} ${roundedPopulation(settlement.population)}` : normalZoom ? data.subtitle : selected || capital ? data.subtitle : "";
      const titleWidth = ctx.measureText(title).width;
      const subtitleWidth = subtitle ? ctx.measureText(subtitle).width : 0;
      const width = Math.ceil(Math.max(titleWidth, subtitleWidth) + 22);
      const height = subtitle ? 35 : 23;
      const marker = camera.worldToScreen(settlement.centerX, settlement.centerY);
      return {
        settlementId: settlement.id,
        markerX: marker.x,
        markerY: marker.y,
        x: marker.x - width / 2,
        y: marker.y - height - 14,
        width,
        height,
        priority: data.priority,
        color: civilization ? CIVILIZATION_COLORS[civilization.colorIndex % CIVILIZATION_COLORS.length] : "#f1d36b",
        title,
        subtitle,
        selected,
        capital: !!capital
      };
    })
    .filter((candidate) => camera.zoom < 2.6 || candidate.selected || candidate.capital)
    .sort((a, b) => b.priority - a.priority);
}

function placeCandidate(candidate: LabelCandidate, placed: SettlementLabelHitbox[]): LabelCandidate | undefined {
  const offsets = [
    { x: 0, y: 0 },
    { x: 0, y: -candidate.height - 6 },
    { x: 0, y: candidate.height + 18 },
    { x: -candidate.width * 0.58, y: 0 },
    { x: candidate.width * 0.58, y: 0 },
    { x: -candidate.width * 0.45, y: -candidate.height },
    { x: candidate.width * 0.45, y: -candidate.height }
  ];
  for (const offset of offsets) {
    const next = { ...candidate, x: candidate.x + offset.x, y: candidate.y + offset.y };
    if (!placed.some((existing) => overlaps(next, existing))) return next;
  }
  return undefined;
}

function drawLabel(ctx: CanvasRenderingContext2D, label: LabelCandidate): void {
  ctx.fillStyle = label.selected ? "rgba(24, 32, 30, 0.92)" : "rgba(24, 32, 30, 0.78)";
  roundRect(ctx, label.x, label.y, label.width, label.height, 5);
  ctx.fill();
  ctx.fillStyle = label.color;
  ctx.fillRect(label.x + 7, label.y + 8, 5, label.height - 16);
  ctx.fillStyle = "#f4f1e3";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(label.title, label.x + 17, label.y + 15);
  if (label.subtitle) {
    ctx.fillStyle = "rgba(244, 241, 227, 0.78)";
    ctx.font = "500 10px system-ui, sans-serif";
    ctx.fillText(label.subtitle, label.x + 17, label.y + 29);
  }
}

function visibleSettlements(state: GameState, camera: Camera, marginTiles: number): Settlement[] {
  const bounds = camera.visibleTileBounds(state.world);
  return state.settlements.filter(
    (settlement) =>
      settlement.centerX >= bounds.minX - marginTiles &&
      settlement.centerX <= bounds.maxX + marginTiles &&
      settlement.centerY >= bounds.minY - marginTiles &&
      settlement.centerY <= bounds.maxY + marginTiles
  );
}

function settlementPriority(settlement: Settlement, capital: boolean | undefined, selected: boolean): number {
  if (selected) return 100;
  if (capital) return 90;
  switch (settlement.tier) {
    case "capital":
      return 88;
    case "city":
      return 75;
    case "town":
      return 66;
    case "village":
      return 54;
    case "hamlet":
      return 42;
    case "camp":
      return 30;
  }
}

function influenceRadius(settlement: Settlement): number {
  switch (settlement.tier) {
    case "capital":
      return 18;
    case "city":
      return 15;
    case "town":
      return 12;
    case "village":
      return 9;
    case "hamlet":
      return 7;
    case "camp":
      return 5;
  }
}

function roundedPopulation(population: number): string {
  if (population < 100) return String(population);
  return `${Math.round(population / 10) * 10}+`;
}

function overlaps(a: SettlementLabelHitbox, b: SettlementLabelHitbox): boolean {
  return a.x < b.x + b.width + 4 && a.x + a.width + 4 > b.x && a.y < b.y + b.height + 4 && a.y + a.height + 4 > b.y;
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
  ctx.fill();
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

function hexToRgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = value >> 16;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

