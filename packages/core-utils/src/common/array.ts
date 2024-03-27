export function findCommonElement <T> (array1: T[], array2: T[]) {
  for (const a of array1) {
    for (const b of array2) {
      if (a === b) return a
    }
  }

  return null
}

// Avoid conflict with other toArray() functions
export function arrayify <T> (element: T | T[]) {
  if (Array.isArray(element)) return element

  return [ element ]
}

// Avoid conflict with other uniq() functions
export function uniqify <T> (elements: T[]) {
  return Array.from(new Set(elements))
}

// Thanks: https://stackoverflow.com/a/12646864
export function shuffle <T> (elements: T[]) {
  const shuffled = [ ...elements ]

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [ shuffled[i], shuffled[j] ] = [ shuffled[j], shuffled[i] ]
  }

  return shuffled
}

export function sortBy (obj: any[], key1: string, key2?: string) {
  return obj.sort((a, b) => {
    const elem1 = key2 ? a[key1][key2] : a[key1]
    const elem2 = key2 ? b[key1][key2] : b[key1]

    if (elem1 < elem2) return -1
    if (elem1 === elem2) return 0
    return 1
  })
}

export function maxBy <T> (arr: T[], property: keyof T) {
  let result: T

  for (const obj of arr) {
    if (!result || result[property] < obj[property]) result = obj
  }

  return result
}

export function minBy <T> (arr: T[], property: keyof T) {
  let result: T

  for (const obj of arr) {
    if (!result || result[property] > obj[property]) result = obj
  }

  return result
}
