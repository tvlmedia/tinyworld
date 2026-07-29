import { Point, manhattan, neighbors4, tileKey } from "../utils/MathUtils";
import { PriorityQueue } from "../utils/PriorityQueue";
import { isWalkableTile, movementCost } from "../world/Tile";
import { World, getTile, inBounds } from "../world/World";

export interface PathResult {
  path: Point[];
  visitedNodes: number;
}

export interface PathfinderOptions {
  maxNodes?: number;
  allowOccupiedGoal?: string;
}

export class Pathfinder {
  private cache = new Map<string, { version: number; path: Point[] }>();
  activePathCount = 0;
  lastVisitedNodes = 0;

  findPath(world: World, start: Point, goal: Point, options: PathfinderOptions = {}): PathResult {
    const normalizedStart = { x: Math.floor(start.x), y: Math.floor(start.y) };
    const normalizedGoal = { x: Math.floor(goal.x), y: Math.floor(goal.y) };
    const key = `${world.version}:${tileKey(normalizedStart.x, normalizedStart.y)}>${tileKey(normalizedGoal.x, normalizedGoal.y)}`;
    const cached = this.cache.get(key);
    if (cached && cached.version === world.version) {
      return { path: cached.path.map((point) => ({ ...point })), visitedNodes: 0 };
    }

    const maxNodes = options.maxNodes ?? 1600;
    const frontier = new PriorityQueue<Point>();
    const cameFrom = new Map<string, string>();
    const costs = new Map<string, number>();
    const startKey = tileKey(normalizedStart.x, normalizedStart.y);
    const goalKey = tileKey(normalizedGoal.x, normalizedGoal.y);

    frontier.enqueue(normalizedStart, 0);
    costs.set(startKey, 0);
    let visitedNodes = 0;

    while (frontier.length > 0 && visitedNodes < maxNodes) {
      const current = frontier.dequeue();
      if (!current) break;
      visitedNodes += 1;
      if (tileKey(current.x, current.y) === goalKey) break;

      for (const next of neighbors4(current)) {
        if (!inBounds(world, next.x, next.y)) continue;
        const nextTile = getTile(world, next.x, next.y);
        if (!nextTile) continue;
        const isGoal = next.x === normalizedGoal.x && next.y === normalizedGoal.y;
        if (!isGoal && !isWalkableTile(nextTile)) continue;
        if (isGoal && !isWalkableTile(nextTile, options.allowOccupiedGoal)) continue;

        const currentCost = costs.get(tileKey(current.x, current.y)) ?? Number.POSITIVE_INFINITY;
        const newCost = currentCost + movementCost(nextTile);
        const nextKey = tileKey(next.x, next.y);
        if (newCost >= (costs.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;

        costs.set(nextKey, newCost);
        const priority = newCost + manhattan(next, normalizedGoal);
        frontier.enqueue(next, priority);
        cameFrom.set(nextKey, tileKey(current.x, current.y));
      }
    }

    this.lastVisitedNodes = visitedNodes;
    this.activePathCount += 1;
    const path = reconstructPath(cameFrom, normalizedStart, normalizedGoal);
    if (path.length > 0) {
      this.cache.set(key, { version: world.version, path });
      if (this.cache.size > 800) this.cache.clear();
    }
    return { path, visitedNodes };
  }

  clear(): void {
    this.cache.clear();
  }
}

function reconstructPath(cameFrom: Map<string, string>, start: Point, goal: Point): Point[] {
  const startKey = tileKey(start.x, start.y);
  let currentKey = tileKey(goal.x, goal.y);
  if (currentKey !== startKey && !cameFrom.has(currentKey)) return [];

  const path: Point[] = [goal];
  while (currentKey !== startKey) {
    const previous = cameFrom.get(currentKey);
    if (!previous) return [];
    const [x, y] = previous.split(",").map(Number);
    path.push({ x, y });
    currentKey = previous;
  }

  path.reverse();
  return path;
}
