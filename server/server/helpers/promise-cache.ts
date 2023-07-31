export class CachePromiseFactory <A, R> {
  private readonly running = new Map<string, Promise<R>>()

  constructor (
    private readonly fn: (arg: A) => Promise<R>,
    private readonly keyBuilder: (arg: A) => string
  ) {
  }

  run (arg: A) {
    return this.runWithContext(null, arg)
  }

  runWithContext (ctx: any, arg: A) {
    const key = this.keyBuilder(arg)

    if (this.running.has(key)) return this.running.get(key)

    const p = this.fn.apply(ctx || this, [ arg ])

    this.running.set(key, p)

    return p.finally(() => this.running.delete(key))
  }
}

export function CachePromise (options: {
  keyBuilder: (...args: any[]) => string
}) {
  return function (_target, _key, descriptor: PropertyDescriptor) {
    const promiseCache = new CachePromiseFactory(descriptor.value, options.keyBuilder)

    descriptor.value = function () {
      if (arguments.length !== 1) throw new Error('Cache promise only support methods with 1 argument')

      return promiseCache.runWithContext(this, arguments[0])
    }
  }
}
