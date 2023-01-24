function isPromise <T = unknown> (value: T | Promise<T>): value is Promise<T> {
  return value && typeof (value as Promise<T>).then === 'function'
}

function isCatchable (value: any) {
  return value && typeof value.catch === 'function'
}

function timeoutPromise <T> (promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout>

  return Promise.race([
    promise,

    new Promise((_res, rej) => {
      timer = setTimeout(() => rej(new Error('Timeout')), timeoutMs)
    })
  ]).finally(() => clearTimeout(timer))
}

export {
  isPromise,
  isCatchable,
  timeoutPromise
}
