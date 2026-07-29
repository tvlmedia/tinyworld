import { DEFAULT_WORLD_SIZE, GAME_SPEEDS, GameSpeed, WORLD_SIZES } from "../app/Config";
import { GameState, SettingsState } from "../app/GameState";
import { SaveManager, SaveMeta } from "../persistence/SaveManager";
import { Renderer } from "../rendering/Renderer";
import { debugAction, cooldownRemaining, TOOL_DEFINITIONS } from "../input/ToolManager";
import { hudSummary } from "./HUD";
import { inspectorHtml } from "./Inspector";
import { eventLogHtml } from "./EventLog";
import { markTutorialSeen, tutorialHtml, tutorialSeen } from "./Tutorial";
import { saveSlotsHtml } from "./SaveMenu";

export interface UIActions {
  newWorld: (seed: string, size: number) => void;
  randomWorld: () => void;
  setSpeed: (speed: GameSpeed) => void;
  togglePause: () => void;
  save: (slot: number) => void;
  load: (slot: number) => void;
  updateSettings: (settings: SettingsState) => void;
}

export class UIManager {
  private saveMetas: SaveMeta[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly state: GameState,
    private readonly renderer: Renderer,
    private readonly saves: SaveManager,
    private readonly actions: UIActions
  ) {}

  init(): void {
    this.saveMetas = this.saves.listSlots();
    this.root.innerHTML = this.shellHtml();
    this.bind();
    this.update();
    if (!tutorialSeen()) this.showTutorial();
  }

  update(): void {
    this.replaceHtml("topbar", hudSummary(this.state));
    this.replaceHtml("inspector", inspectorHtml(this.state));
    this.replaceHtml("event-log", eventLogHtml(this.state));
    this.replaceHtml("debug-panel", this.debugHtml());
    this.updateToolButtons();
    this.root.style.setProperty("--ui-scale", String(this.state.settings.interfaceScale));
  }

  refreshSaves(): void {
    this.saveMetas = this.saves.listSlots();
    this.replaceHtml("save-slots", saveSlotsHtml(this.saveMetas));
  }

  private shellHtml(): string {
    return `
      <header class="topbar" id="topbar"></header>
      <aside class="panel panel--left">
        <section>
          <h2>Tools</h2>
          <div class="tool-grid">
            ${TOOL_DEFINITIONS.map(
              (tool) => `
                <button type="button" class="tool-button" title="${tool.description}" aria-label="${tool.label}" data-tool="${tool.id}">
                  <span aria-hidden="true">${tool.icon}</span>
                  <small>${tool.label}</small>
                </button>
              `
            ).join("")}
          </div>
        </section>
        <section>
          <h2>Tijd</h2>
          <div class="segmented" role="group" aria-label="Simulatiesnelheid">
            ${GAME_SPEEDS.map((speed) => `<button type="button" data-speed="${speed}">${speed}x</button>`).join("")}
          </div>
          <button type="button" data-action="pause">Pauze</button>
        </section>
        <section>
          <h2>Wereld</h2>
          <label>Seed <input id="seed-input" value="${this.state.world.seed}" /></label>
          <label>Grootte
            <select id="size-input">
              ${WORLD_SIZES.map((size) => `<option value="${size}" ${size === DEFAULT_WORLD_SIZE ? "selected" : ""}>${size} x ${size}</option>`).join("")}
            </select>
          </label>
          <div class="button-row">
            <button type="button" data-action="new-world">Nieuw</button>
            <button type="button" data-action="random-world">Random</button>
          </div>
          <div class="button-row">
            <button type="button" data-action="center">Dorp</button>
            <button type="button" data-action="reset-camera">Reset</button>
            <button type="button" data-action="zoom-in">+</button>
            <button type="button" data-action="zoom-out">-</button>
          </div>
        </section>
      </aside>
      <aside class="panel panel--right">
        <section class="inspector" id="inspector"></section>
        <section>
          <h2>Savegames</h2>
          <div id="save-slots">${saveSlotsHtml(this.saveMetas)}</div>
        </section>
        <section>
          <h2>Instellingen</h2>
          ${this.settingsHtml()}
        </section>
        <section class="debug-panel" id="debug-panel"></section>
      </aside>
      <section class="event-panel">
        <h2>Gebeurtenissen</h2>
        <ul id="event-log"></ul>
      </section>
      <div class="tutorial" id="tutorial" hidden></div>
    `;
  }

  private settingsHtml(): string {
    const settings = this.state.settings;
    return `
      <label>Interface <input data-setting="interfaceScale" type="range" min="0.85" max="1.25" step="0.05" value="${settings.interfaceScale}" /></label>
      <label>Particles
        <select data-setting="particles">
          ${(["low", "medium", "high"] as const).map((value) => `<option value="${value}" ${settings.particles === value ? "selected" : ""}>${value}</option>`).join("")}
        </select>
      </label>
      <label><input data-setting="shadows" type="checkbox" ${settings.shadows ? "checked" : ""} /> Schaduwen</label>
      <label><input data-setting="weatherAnimations" type="checkbox" ${settings.weatherAnimations ? "checked" : ""} /> Weeranimaties</label>
      <label><input data-setting="reducedMotion" type="checkbox" ${settings.reducedMotion ? "checked" : ""} /> Minder beweging</label>
      <label><input data-setting="soundEnabled" type="checkbox" ${settings.soundEnabled ? "checked" : ""} /> Geluid</label>
      <label><input data-setting="autosave" type="checkbox" ${settings.autosave ? "checked" : ""} /> Autosave</label>
      <label>Dag/nacht <input data-setting="dayNightSpeed" type="range" min="0.5" max="2" step="0.1" value="${settings.dayNightSpeed}" /></label>
    `;
  }

  private bind(): void {
    this.root.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("button");
      if (!target) return;
      const tool = target.dataset.tool;
      if (tool) {
        this.state.activeTool = tool;
        this.updateToolButtons();
        return;
      }
      const speed = target.dataset.speed;
      if (speed) {
        this.actions.setSpeed(Number(speed) as GameSpeed);
        return;
      }
      const action = target.dataset.action;
      if (!action) return;
      this.handleAction(action, target);
    });

    this.root.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement;
      const setting = target.dataset.setting as keyof SettingsState | undefined;
      if (!setting) return;
      const settings = { ...this.state.settings };
      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        settings[setting] = target.checked as never;
      } else if (setting === "interfaceScale" || setting === "dayNightSpeed") {
        settings[setting] = Number(target.value) as never;
      } else {
        settings[setting] = target.value as never;
      }
      this.actions.updateSettings(settings);
    });
  }

  private handleAction(action: string, target: HTMLElement): void {
    if (action === "pause") this.actions.togglePause();
    if (action === "new-world") {
      const seed = this.root.querySelector<HTMLInputElement>("#seed-input")?.value.trim() || "Tiny";
      const size = Number(this.root.querySelector<HTMLSelectElement>("#size-input")?.value ?? DEFAULT_WORLD_SIZE);
      this.actions.newWorld(seed, size);
    }
    if (action === "random-world") this.actions.randomWorld();
    if (action === "center") this.renderer.camera.centerOn(this.state.world.spawn, this.state.world);
    if (action === "reset-camera") this.renderer.camera.reset(this.state.world);
    if (action === "zoom-in") this.renderer.camera.setZoom(this.renderer.camera.zoom + 0.25, this.state.world);
    if (action === "zoom-out") this.renderer.camera.setZoom(this.renderer.camera.zoom - 0.25, this.state.world);
    if (action === "close-tutorial") {
      markTutorialSeen();
      const tutorial = this.root.querySelector<HTMLElement>("#tutorial");
      if (tutorial) tutorial.hidden = true;
    }
    if (action === "save") this.actions.save(Number(target.dataset.slot));
    if (action === "load") this.actions.load(Number(target.dataset.slot));
    if (action.startsWith("debug:")) debugAction(this.state, action.slice("debug:".length));
  }

  private updateToolButtons(): void {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
      const tool = button.dataset.tool ?? "";
      const remaining = cooldownRemaining(this.state, tool);
      button.classList.toggle("is-active", tool === this.state.activeTool);
      button.disabled = remaining > 0;
      const small = button.querySelector("small");
      const definition = TOOL_DEFINITIONS.find((item) => item.id === tool);
      if (small && definition) small.textContent = remaining > 0 ? `${Math.ceil(remaining)}s` : definition.label;
    }
  }

  private showTutorial(): void {
    const tutorial = this.root.querySelector<HTMLElement>("#tutorial");
    if (!tutorial) return;
    tutorial.innerHTML = tutorialHtml();
    tutorial.hidden = false;
  }

  private replaceHtml(id: string, html: string): void {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (element) element.innerHTML = html;
  }

  private debugHtml(): string {
    if (!this.state.debug.enabled) return "";
    return `
      <h2>Debug</h2>
      <dl>
        <dt>FPS</dt><dd>${Math.round(this.state.debug.fps)}</dd>
        <dt>Tick</dt><dd>${this.state.debug.tickMs.toFixed(2)} ms</dd>
        <dt>Entities</dt><dd>${this.state.villagers.length}</dd>
        <dt>Paden</dt><dd>${this.state.debug.activePaths}</dd>
        <dt>Nodes</dt><dd>${this.state.debug.lastVisitedNodes}</dd>
        <dt>Seed</dt><dd>${this.state.world.seed}</dd>
      </dl>
      <div class="debug-actions">
        <button type="button" data-action="debug:food">+100 food</button>
        <button type="button" data-action="debug:wood">+100 wood</button>
        <button type="button" data-action="debug:villager">Spawn</button>
        <button type="button" data-action="debug:clearFire">Wis vuur</button>
        <button type="button" data-action="debug:day">+1 dag</button>
        <button type="button" data-action="debug:finishBuild">Bouw klaar</button>
      </div>
    `;
  }
}
