export function isPromise <T = unknown> (value: T | Promise<T>): value is Promise<T> {
  return value && typeof (value as Promise<T>).then === 'function'
}

export function isCatchable (value: any) {
  return value && typeof value.catch === 'function'
}

export function timeoutPromise <T> (promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout>

  return Promise.race([
    promise,

    new Promise((_res, rej) => {
      timer = setTimeout(() => rej(new Error('Timeout')), timeoutMs)
    })
  ]).finally(() => clearTimeout(timer))
}

export function promisify0<A> (func: (cb: (err: any, result: A) => void) => void): () => Promise<A> {
  return function promisified (): Promise<A> {
    return new Promise<A>((resolve: (arg: A) => void, reject: (err: any) => void) => {
      // eslint-disable-next-line no-useless-call
      func.apply(null, [ (err: any, res: A) => err ? reject(err) : resolve(res) ])
    })
  }
}

// Thanks to https://gist.github.com/kumasento/617daa7e46f13ecdd9b2
export function promisify1<T, A> (func: (arg: T, cb: (err: any, result: A) => void) => void): (arg: T) => Promise<A> {
  return function promisified (arg: T): Promise<A> {
    return new Promise<A>((resolve: (arg: A) => void, reject: (err: any) => void) => {
      // eslint-disable-next-line no-useless-call
      func.apply(null, [ arg, (err: any, res: A) => err ? reject(err) : resolve(res) ])
    })
  }
}

// eslint-disable-next-line max-len
export function promisify2<T, U, A> (func: (arg1: T, arg2: U, cb: (err: any, result: A) => void) => void): (arg1: T, arg2: U) => Promise<A> {
  return function promisified (arg1: T, arg2: U): Promise<A> {
    return new Promise<A>((resolve: (arg: A) => void, reject: (err: any) => void) => {
      // eslint-disable-next-line no-useless-call
      func.apply(null, [ arg1, arg2, (err: any, res: A) => err ? reject(err) : resolve(res) ])
    })
  }
}

// eslint-disable-next-line max-len
export function promisify3<T, U, V, A> (func: (arg1: T, arg2: U, arg3: V, cb: (err: any, result: A) => void) => void): (arg1: T, arg2: U, arg3: V) => Promise<A> {
  return function promisified (arg1: T, arg2: U, arg3: V): Promise<A> {
    return new Promise<A>((resolve: (arg: A) => void, reject: (err: any) => void) => {
      // eslint-disable-next-line no-useless-call
      func.apply(null, [ arg1, arg2, arg3, (err: any, res: A) => err ? reject(err) : resolve(res) ])
    })
  }
}
