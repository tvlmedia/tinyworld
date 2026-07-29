import { describe, expect, it } from "vitest";
import { Camera } from "../src/rendering/Camera";
import { Tile } from "../src/world/Tile";
import { World } from "../src/world/World";

function createCanvas(width: number, height: number): HTMLCanvasElement {
  return {
    width,
    height,
    clientWidth: width,
    clientHeight: height
  } as HTMLCanvasElement;
}

function createWorld(width: number, height: number): World {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push({
        x,
        y,
        type: "grass",
        elevation: 0.5,
        moisture: 0.5,
        fertility: 0.5,
        temperature: 0.5,
        resourceAmount: 0
      });
    }
  }
  return {
    seed: "camera",
    name: "Camera",
    width,
    height,
    tiles,
    spawn: { x: width / 2, y: height / 2 },
    version: 0
  };
}

describe("Camera", () => {
  it("can zoom far enough out for an overview", () => {
    const camera = new Camera(createCanvas(1440, 900));
    const world = createWorld(512, 512);
    camera.setZoom(0.01, world);
    expect(camera.zoom).toBe(0.05);
    const topLeft = camera.worldToScreen(0, 0);
    const bottomRight = camera.worldToScreen(world.width, world.height);
    expect(topLeft.x).toBeGreaterThan(0);
    expect(topLeft.y).toBeGreaterThan(0);
    expect(bottomRight.x).toBeLessThan(1440);
    expect(bottomRight.y).toBeLessThan(900);
  });

  it("centers the world when the viewport is larger than the zoomed map", () => {
    const camera = new Camera(createCanvas(1600, 1000));
    const world = createWorld(64, 64);
    camera.fitToWorld(world);
    camera.setZoom(0.18, world);
    const center = camera.worldToScreen(world.width / 2, world.height / 2);
    expect(center.x).toBeCloseTo(800, 0);
    expect(center.y).toBeCloseTo(500, 0);
  });

  it("keeps camera bounds valid on a 512 world", () => {
    const camera = new Camera(createCanvas(1440, 900));
    const world = createWorld(512, 512);
    camera.fitToWorld(world);
    camera.setZoom(0.3, world);
    camera.pan(-100000, -100000, world);
    const bottomRight = camera.screenToWorld(1440, 900);
    expect(bottomRight.x).toBeLessThanOrEqual(512);
    expect(bottomRight.y).toBeLessThanOrEqual(512);
    camera.pan(100000, 100000, world);
    const topLeft = camera.screenToWorld(0, 0);
    expect(topLeft.x).toBeGreaterThanOrEqual(0);
    expect(topLeft.y).toBeGreaterThanOrEqual(0);
  });

  it("fits a complete 512 world inside the viewport", () => {
    const camera = new Camera(createCanvas(1440, 900));
    const world = createWorld(512, 512);
    camera.fitToWorld(world);
    const topLeft = camera.worldToScreen(0, 0);
    const bottomRight = camera.worldToScreen(world.width, world.height);
    expect(topLeft.x).toBeGreaterThanOrEqual(0);
    expect(topLeft.y).toBeGreaterThanOrEqual(0);
    expect(bottomRight.x).toBeLessThanOrEqual(1440);
    expect(bottomRight.y).toBeLessThanOrEqual(900);
  });
});
