import { Jsonify } from 'type-fest'

// Forbid _attributes key to prevent pick on a sequelize model, that doesn't work for attributes
export function pick<O extends (object & { _attributes?: never }), K extends keyof O> (object: O, keys: K[]): Pick<O, K> {
  const result: any = {}

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      result[key] = object[key]
    }
  }

  return result
}

export function omit<O extends object, K extends keyof O> (object: O, keys: K[]): Exclude<O, K> {
  const result: any = {}
  const keysSet = new Set(keys) as Set<string>

  for (const [ key, value ] of Object.entries(object)) {
    if (keysSet.has(key)) continue

    result[key] = value
  }

  return result
}

export function objectKeysTyped<O extends object, K extends keyof O> (object: O): K[] {
  return (Object.keys(object) as K[])
}

export function getKeys<O extends object, K extends keyof O> (object: O, keys: K[]): K[] {
  return (Object.keys(object) as K[]).filter(k => keys.includes(k))
}

export function hasKey<T extends object> (obj: T, k: keyof any): k is keyof T {
  return k in obj
}

export function sortObjectComparator (key: string, order: 'asc' | 'desc') {
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

export function shallowCopy<T> (o: T): T {
  return Object.assign(Object.create(Object.getPrototypeOf(o)), o)
}

export function exists (value: any) {
  return value !== undefined && value !== null
}

// ---------------------------------------------------------------------------

export function simpleObjectsDeepEqual<T, U> (a: Jsonify<T>, b: Jsonify<U>) {
  if (a as any === b as any) return true
  if (a === undefined && b === undefined) return true

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
