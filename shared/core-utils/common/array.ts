function findCommonElement <T> (array1: T[], array2: T[]) {
  for (const a of array1) {
    for (const b of array2) {
      if (a === b) return a
    }
  }

  return null
}

export {
  findCommonElement
}
