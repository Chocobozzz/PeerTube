function pick <O extends object, K extends keyof O> (object: O, keys: K[]): Pick<O, K> {
  const result: any = {}

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      result[key] = object[key]
    }
  }

  return result
}

function omit <O extends object, K extends keyof O> (object: O, keys: K[]): Exclude<O, K> {
  const result: any = {}
  const keysSet = new Set(keys) as Set<string>

  for (const [ key, value ] of Object.entries(object)) {
    if (keysSet.has(key)) continue

    result[key] = value
  }

  return result
}

function getKeys <O extends object, K extends keyof O> (object: O, keys: K[]): K[] {
  return (Object.keys(object) as K[]).filter(k => keys.includes(k))
}

function sortObjectComparator (key: string, order: 'asc' | 'desc') {
  return (a: any, b: any) => {
    if (a[key] < b[key]) {
      return order === 'asc' ? -1 : 1
    }

    if (a[key] > b[key]) {
      return order === 'asc' ? 1 : -1
    }

    return 0
  }
}

function shallowCopy <T> (o: T): T {
  return Object.assign(Object.create(Object.getPrototypeOf(o)), o)
}

function simpleObjectsDeepEqual (a: any, b: any) {
  if (a === b) return true

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (!keysB.includes(key)) return false

    if (!simpleObjectsDeepEqual(a[key], b[key])) return false
  }

  return true
}

export {
  pick,
  omit,
  getKeys,
  shallowCopy,
  sortObjectComparator,
  simpleObjectsDeepEqual
}
