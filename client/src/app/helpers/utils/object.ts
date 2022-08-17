function immutableAssign <A, B> (target: A, source: B) {
  return Object.assign({}, target, source)
}

function removeElementFromArray <T> (arr: T[], elem: T) {
  const index = arr.indexOf(elem)
  if (index !== -1) arr.splice(index, 1)
}

function sortBy (obj: any[], key1: string, key2?: string) {
  return obj.sort((a, b) => {
    const elem1 = key2 ? a[key1][key2] : a[key1]
    const elem2 = key2 ? b[key1][key2] : b[key1]

    if (elem1 < elem2) return -1
    if (elem1 === elem2) return 0
    return 1
  })
}

function splitIntoArray (value: any) {
  if (!value) return undefined
  if (Array.isArray(value)) return value

  if (typeof value === 'string') return value.split(',')

  return [ value ]
}

function toBoolean (value: any) {
  if (!value) return undefined

  if (typeof value === 'boolean') return value

  if (value === 'true') return true
  if (value === 'false') return false

  return undefined
}

export {
  sortBy,
  immutableAssign,
  removeElementFromArray,
  splitIntoArray,
  toBoolean
}
