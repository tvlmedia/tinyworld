import { GameState } from "../app/GameState";
import { Camera } from "./Camera";
import { EntityRenderer } from "./EntityRenderer";
import { LightingRenderer } from "./LightingRenderer";
import { ParticleSystem } from "./ParticleSystem";
import { TerritoryRenderer } from "./TerritoryRenderer";
import { TileRenderer } from "./TileRenderer";
import { WeatherRenderer } from "./WeatherRenderer";

export class Renderer {
  readonly camera: Camera;
  readonly particles = new ParticleSystem();
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tiles = new TileRenderer();
  private readonly territory = new TerritoryRenderer();
  private readonly entities = new EntityRenderer();
  private readonly weather = new WeatherRenderer();
  private readonly lighting = new LightingRenderer();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context ontbreekt.");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.camera = new Camera(canvas);
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  render(state: GameState, time: number, dt: number): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.ctx.imageSmoothingEnabled = false;
    this.tiles.draw(this.ctx, state, this.camera, time);
    this.territory.draw(this.ctx, state, this.camera);
    this.entities.draw(this.ctx, state, this.camera, time);
    this.lighting.draw(this.ctx, state, width, height);
    this.weather.draw(this.ctx, state, width, height, time);
    this.particles.update(dt);
    this.particles.draw(this.ctx);
  }
}
