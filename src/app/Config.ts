export const GAME_VERSION = 1;

export const DEFAULT_WORLD_SIZE = 128;
export const TILE_SIZE = 16;
export const FIXED_TIMESTEP_MS = 100;
export const MAX_CATCH_UP_TICKS = 5;
export const AUTOSAVE_INTERVAL_MS = 30_000;

export const WORLD_SIZES = [64, 128, 192] as const;
export type WorldSize = (typeof WORLD_SIZES)[number];

export type GameSpeed = 0 | 1 | 2 | 4 | 8;

export const GAME_SPEEDS: GameSpeed[] = [1, 2, 4, 8];
