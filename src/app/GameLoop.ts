import { FIXED_TIMESTEP_MS, MAX_CATCH_UP_TICKS } from "./Config";

export interface GameLoopCallbacks {
  update: (dt: number) => void;
  render: (time: number, dt: number) => void;
}

export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private raf = 0;
  private frameCounter = 0;
  private fpsTimer = 0;
  fps = 0;

  constructor(private readonly callbacks: GameLoopCallbacks) {}

  start(): void {
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private frame = (time: number): void => {
    const frameMs = Math.min(250, time - this.lastTime);
    this.lastTime = time;
    this.accumulator += frameMs;

    let ticks = 0;
    while (this.accumulator >= FIXED_TIMESTEP_MS && ticks < MAX_CATCH_UP_TICKS) {
      this.callbacks.update(FIXED_TIMESTEP_MS / 1000);
      this.accumulator -= FIXED_TIMESTEP_MS;
      ticks += 1;
    }
    if (ticks >= MAX_CATCH_UP_TICKS) this.accumulator = 0;

    this.callbacks.render(time, frameMs / 1000);
    this.frameCounter += 1;
    this.fpsTimer += frameMs;
    if (this.fpsTimer >= 500) {
      this.fps = (this.frameCounter / this.fpsTimer) * 1000;
      this.frameCounter = 0;
      this.fpsTimer = 0;
    }
    this.raf = requestAnimationFrame(this.frame);
  };
}
