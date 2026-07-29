import { AUTOSAVE_INTERVAL_MS, DEFAULT_WORLD_SIZE, GameSpeed, simulationSubsteps } from "./Config";
import { createNewGameState, GameState, SettingsState } from "./GameState";
import { GameLoop } from "./GameLoop";
import { InputManager } from "../input/InputManager";
import { SaveManager } from "../persistence/SaveManager";
import { Renderer } from "../rendering/Renderer";
import { Simulation } from "../simulation/Simulation";
import { UIManager } from "../ui/UIManager";
import { SeededRandom } from "../world/SeededRandom";

export class Game {
  private readonly renderer: Renderer;
  private readonly simulation = new Simulation();
  private readonly saves = new SaveManager();
  private state: GameState;
  private ui: UIManager;
  private input: InputManager;
  private loop: GameLoop;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly uiRoot: HTMLElement) {
    const settings = this.saves.loadSettings();
    const autosave = this.saves.loadAutosave();
    this.state = autosave ? this.saves.restoreState(autosave) : createNewGameState(defaultSeed(), DEFAULT_WORLD_SIZE, settings);
    this.renderer = new Renderer(canvas);
    this.renderer.resize();
    this.renderer.camera.fitToWorld(this.state.world);
    this.ui = this.createUi();
    this.input = this.createInput();
    this.loop = this.createLoop();
  }

  start(): void {
    window.addEventListener("resize", this.onResize);
    window.addEventListener("beforeunload", this.onBeforeUnload);
    this.input.bind();
    this.ui.init();
    this.loop.start();
  }

  private createLoop(): GameLoop {
    return new GameLoop({
      update: (dt) => {
        if (!this.state.time.paused && this.state.time.speed > 0) {
          const simulationDt = dt * this.state.time.speed;
          const steps = simulationSubsteps(dt, this.state.time.speed);
          const stepDt = simulationDt / steps;
          for (let step = 0; step < steps; step += 1) {
            this.simulation.update(this.state, stepDt);
          }
        }
        if (this.state.settings.autosave && Date.now() - this.state.lastAutosaveAt > AUTOSAVE_INTERVAL_MS) {
          this.saves.saveAutosave(this.state);
          this.state.lastAutosaveAt = Date.now();
        }
      },
      render: (time, dt) => {
        this.state.debug.fps = this.loop.fps;
        this.renderer.render(this.state, time, dt);
        this.ui.updateFrame(time);
      }
    });
  }

  private createUi(): UIManager {
    return new UIManager(this.uiRoot, this.state, this.renderer, this.saves, {
      newWorld: (seed, size) => this.replaceState(createNewGameState(seed, size, this.state.settings)),
      randomWorld: () => this.replaceState(createNewGameState(randomSeed(), this.state.world.width, this.state.settings)),
      setSpeed: (speed) => {
        this.state.time.speed = speed;
        this.state.time.paused = false;
      },
      togglePause: () => {
        this.state.time.paused = !this.state.time.paused;
      },
      save: (slot) => {
        this.saves.saveSlot(slot, this.state);
        this.ui.refreshSaves();
      },
      load: (slot) => {
        const save = this.saves.loadSlot(slot);
        if (save) this.replaceState(this.saves.restoreState(save));
      },
      updateSettings: (settings) => {
        this.state.settings = settings;
        this.saves.saveSettings(settings);
      }
    });
  }

  private createInput(): InputManager {
    return new InputManager(this.canvas, this.state, this.renderer, {
      onSelectionChanged: () => this.ui.update(),
      onPauseToggle: () => {
        this.state.time.paused = !this.state.time.paused;
      },
      onSpeedChange: (speed: GameSpeed) => {
        this.state.time.speed = speed;
        this.state.time.paused = false;
      }
    });
  }

  private replaceState(nextState: GameState): void {
    this.state = nextState;
    this.renderer.camera.reset(this.state.world);
    this.input.dispose();
    this.input = this.createInput();
    this.input.bind();
    this.ui = this.createUi();
    this.ui.init();
  }

  private onResize = (): void => {
    this.renderer.resize();
    this.renderer.camera.clampToWorld(this.state.world);
  };

  private onBeforeUnload = (): void => {
    if (this.state.settings.autosave) this.saves.saveAutosave(this.state);
  };
}

function defaultSeed(): string {
  const date = new Date();
  return `Tiny-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function randomSeed(): string {
  const rng = new SeededRandom(`${Date.now()}-${Math.random()}`);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let seed = "World-";
  for (let index = 0; index < 6; index += 1) seed += alphabet[Math.floor(rng.next() * alphabet.length)];
  return seed;
}
