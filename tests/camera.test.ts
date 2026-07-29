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
    const world = createWorld(128, 128);
    camera.setZoom(0.05, world);
    expect(camera.zoom).toBeLessThanOrEqual(0.2);
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
});
