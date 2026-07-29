export class IdGenerator {
  private counters = new Map<string, number>();

  next(prefix: string): string {
    const current = this.counters.get(prefix) ?? 0;
    const next = current + 1;
    this.counters.set(prefix, next);
    return `${prefix}-${next.toString(36)}`;
  }

  observe(id: string): void {
    const [prefix, raw] = id.split("-");
    const parsed = Number.parseInt(raw ?? "0", 36);
    if (!prefix || Number.isNaN(parsed)) return;
    this.counters.set(prefix, Math.max(this.counters.get(prefix) ?? 0, parsed));
  }
}
