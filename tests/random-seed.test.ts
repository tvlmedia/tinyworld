import { describe, expect, it } from "vitest";
import { randomWorldSeed } from "../src/app/Game";

describe("random world seed", () => {
  it("creates a fresh display seed from page-start entropy", () => {
    const first = randomWorldSeed(100, 0.1);
    const second = randomWorldSeed(101, 0.1);
    const third = randomWorldSeed(100, 0.2);

    expect(first).toMatch(/^World-[A-Z2-9]{6}$/);
    expect(new Set([first, second, third]).size).toBe(3);
  });
});
