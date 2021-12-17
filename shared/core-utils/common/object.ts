function pick <O extends object, K extends keyof O> (object: O, keys: K[]): Pick<O, K> {
  const result: any = {}

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      result[key] = object[key]
    }
  }

  return result
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
  sortObjectComparator
}
