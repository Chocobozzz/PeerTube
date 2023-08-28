function immutableAssign <A, B> (target: A, source: B) {
  return Object.assign({}, target, source)
}

function removeElementFromArray <T> (arr: T[], elem: T) {
  const index = arr.indexOf(elem)
  if (index !== -1) arr.splice(index, 1)
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
  if (value === '1') return true
  if (value === '0') return false

  return undefined
}

export {
  immutableAssign,
  removeElementFromArray,
  splitIntoArray,
  toBoolean
}
