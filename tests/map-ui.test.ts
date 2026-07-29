import { describe, expect, it } from "vitest";
import { createNewGameState } from "../src/app/GameState";
import { MAP_MODE_DEFINITIONS, mapModeHtml } from "../src/ui/CivilizationPanel";
import { mapModeStatus } from "../src/rendering/MapOverlayRenderer";
import { minimapRect, minimapScreenToWorld, minimapWorldToScreen } from "../src/rendering/MinimapRenderer";
import { settlementLabelData } from "../src/rendering/SettlementRenderer";

describe("map UI helpers", () => {
  it("defines one unique primary button per map mode", () => {
    const modes = MAP_MODE_DEFINITIONS.map((item) => item.mode);
    expect(new Set(modes).size).toBe(modes.length);
    expect(modes).toEqual(["normal", "political", "diplomacy", "resources", "population", "technology", "war", "trade"]);
  });

  it("renders only one active map mode button", () => {
    const state = createNewGameState("map-mode-html", 128);
    state.mapMode = "war";
    const html = mapModeHtml(state);
    expect((html.match(/class="is-active"/g) ?? []).length).toBe(1);
    expect(html).toContain('data-map-mode="war"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("returns graceful empty statuses for data-light modes", () => {
    const state = createNewGameState("empty-map-modes", 128);
    state.mapMode = "diplomacy";
    expect(mapModeStatus(state)).toBe("Er zijn nog geen andere beschavingen ontdekt.");
    state.mapMode = "war";
    expect(mapModeStatus(state)).toBe("Er zijn momenteel geen oorlogen.");
    state.mapMode = "trade";
    expect(mapModeStatus(state)).toBe("Er zijn nog geen handelsroutes.");
  });

  it("builds settlement label data with name tier and population", () => {
    const state = createNewGameState("settlement-label", 128);
    const label = settlementLabelData(state, state.settlements[0]);
    expect(label.title).toBe(state.settlements[0].name);
    expect(label.subtitle).toContain("Hoofdstad");
    expect(label.subtitle).toContain("inwoners");
  });

  it("maps minimap coordinates across different world sizes", () => {
    const rect = minimapRect(1440, 900);
    const screen = minimapWorldToScreen(256, 384, rect, 512, 512);
    const world = minimapScreenToWorld(screen.x, screen.y, rect, 512, 512);
    expect(world.x).toBeCloseTo(256, 0);
    expect(world.y).toBeCloseTo(384, 0);
  });
});

