import { describe, expect, it } from "vitest";
import { SeededRandom } from "../src/world/SeededRandom";

describe("SeededRandom", () => {
  it("produces the same sequence for the same seed", () => {
    const a = new SeededRandom("oak-haven");
    const b = new SeededRandom("oak-haven");
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("keeps integer output inside the inclusive range", () => {
    const rng = new SeededRandom("range");
    for (let index = 0; index < 50; index += 1) {
      const value = rng.int(2, 4);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(4);
    }
  });
});
