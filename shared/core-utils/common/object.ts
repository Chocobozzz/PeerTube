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

export {
  pick,
  omit,
  getKeys,
  sortObjectComparator
}
