export class PromiseCache <A, R> {
  private readonly running = new Map<string, Promise<R>>()

  constructor (
    private readonly fn: (arg: A) => Promise<R>,
    private readonly keyBuilder: (arg: A) => string
  ) {
  }

  run (arg: A) {
    const key = this.keyBuilder(arg)

    if (this.running.has(key)) return this.running.get(key)

    const p = this.fn(arg)

    this.running.set(key, p)

    return p.finally(() => this.running.delete(key))
  }
}
