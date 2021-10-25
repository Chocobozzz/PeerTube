function pick <O extends object, K extends keyof O> (object: O, keys: K[]): Pick<O, K> {
  const result: any = {}

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
