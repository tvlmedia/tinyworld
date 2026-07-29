export const GAME_VERSION = 4;

export const DEFAULT_WORLD_SIZE = 512;
export const TILE_SIZE = 16;
export const FIXED_TIMESTEP_MS = 100;
export const MAX_CATCH_UP_TICKS = 5;
export const AUTOSAVE_INTERVAL_MS = 30_000;

export interface WorldSizeOption {
  label: string;
  width: number;
  height: number;
}

export const WORLD_SIZE_OPTIONS = [
  { label: "Klein", width: 128, height: 128 },
  { label: "Gemiddeld", width: 256, height: 256 },
  { label: "Groot", width: 512, height: 512 }
] as const satisfies readonly WorldSizeOption[];

export const WORLD_SIZES = WORLD_SIZE_OPTIONS.map((option) => option.width);
export type WorldSize = (typeof WORLD_SIZES)[number];

export type GameSpeed = 0 | 1 | 2 | 4 | 8 | 16 | 32;

export const GAME_SPEEDS: GameSpeed[] = [1, 2, 4, 8, 16, 32];
