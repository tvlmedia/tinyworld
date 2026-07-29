export class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  get length(): number {
    return this.items.length;
  }

  enqueue(item: T, priority: number): void {
    this.items.push({ item, priority });
    this.bubbleUp(this.items.length - 1);
  }

  dequeue(): T | undefined {
    if (this.items.length === 0) return undefined;
    const first = this.items[0];
    const last = this.items.pop();
    if (last && this.items.length > 0) {
      this.items[0] = last;
      this.sinkDown(0);
    }
    return first.item;
  }

  private bubbleUp(index: number): void {
    let child = index;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (this.items[parent].priority <= this.items[child].priority) break;
      [this.items[parent], this.items[child]] = [this.items[child], this.items[parent]];
      child = parent;
    }
  }

  private sinkDown(index: number): void {
    let parent = index;
    while (true) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let smallest = parent;

      if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) {
        smallest = left;
      }
      if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) {
        smallest = right;
      }
      if (smallest === parent) break;
      [this.items[parent], this.items[smallest]] = [this.items[smallest], this.items[parent]];
      parent = smallest;
    }
  }
}
