export class MatchmakingQueue<T> {
  private readonly items: T[] = [];

  enqueue(item: T) {
    if (!this.items.includes(item)) {
      this.items.push(item);
    }
  }

  remove(item: T) {
    const index = this.items.indexOf(item);

    if (index >= 0) {
      this.items.splice(index, 1);
    }
  }

  dequeuePair(): [T, T] | null {
    if (this.items.length < 2) {
      return null;
    }

    const first = this.items.shift() as T;
    const second = this.items.shift() as T;
    return [first, second];
  }

  positionOf(item: T) {
    const index = this.items.indexOf(item);
    return index >= 0 ? index + 1 : null;
  }

  size() {
    return this.items.length;
  }

  values() {
    return [...this.items];
  }
}
