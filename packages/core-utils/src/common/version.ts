// Thanks https://gist.github.com/iwill/a83038623ba4fef6abb9efca87ae9ccb
function compareSemVer (a: string, b: string) {
  if (a.startsWith(b + '-')) return -1
  if (b.startsWith(a + '-')) return 1

  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'case', caseFirst: 'upper' })
}

export {
  compareSemVer
}
