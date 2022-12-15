// Thanks https://stackoverflow.com/a/16187766
function compareSemVer (a: string, b: string) {
  const regExStrip0 = /(\.0+)+$/
  const segmentsA = a.replace(regExStrip0, '').split('.')
  const segmentsB = b.replace(regExStrip0, '').split('.')

  const l = Math.min(segmentsA.length, segmentsB.length)

  for (let i = 0; i < l; i++) {
    const diff = parseInt(segmentsA[i], 10) - parseInt(segmentsB[i], 10)

    if (diff) return diff
  }

  return segmentsA.length - segmentsB.length
}

export {
  compareSemVer
}
