export const objectConverter = (oldObject: any, keyConverter: (e: string) => string, valueConverter: (e: any) => any) => {
  if (!oldObject || typeof oldObject !== 'object') {
    return valueConverter(oldObject)
  }

  if (Array.isArray(oldObject)) {
    return oldObject.map(e => objectConverter(e, keyConverter, valueConverter))
  }

  const newObject = {}
  Object.keys(oldObject).forEach(oldKey => {
    const newKey = keyConverter(oldKey)
    newObject[newKey] = objectConverter(oldObject[oldKey], keyConverter, valueConverter)
  })

  return newObject
}

export function mapToJSON (map: Map<any, any>) {
  const obj: any = {}

  for (const [ k, v ] of map) {
    obj[k] = v
  }

  return obj
}
