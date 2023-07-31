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

// Avoid conflict with other uniq() functions
function uniqify <T> (elements: T[]) {
  return Array.from(new Set(elements))
}

// Thanks: https://stackoverflow.com/a/12646864
function shuffle <T> (elements: T[]) {
  const shuffled = [ ...elements ]

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [ shuffled[i], shuffled[j] ] = [ shuffled[j], shuffled[i] ]
  }

  return shuffled
}

export {
  uniqify,
  findCommonElement,
  shuffle,
  arrayify
}
