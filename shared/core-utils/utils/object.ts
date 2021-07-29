function pick <T extends object> (object: T, keys: (keyof T)[]) {
  const result: Partial<T> = {}

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      result[key] = object[key]
    }
  }

  return result
}

export {
  pick
}
