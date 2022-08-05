function findCommonElement <T> (array1: T[], array2: T[]) {
  for (const a of array1) {
    for (const b of array2) {
      if (a === b) return a
    }
  }

  return null
}

// Avoid conflict with other toArray() functions
function arrayify <T> (element: T | T[]) {
  if (Array.isArray(element)) return element

  return [ element ]
}

export {
  findCommonElement,
  arrayify
}
