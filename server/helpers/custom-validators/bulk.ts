/**
 * @throws {Error}
 */
function checkBulkRemoveCommentsOfScope (value: string) {
  const possibleValues = [ 'my-videos', 'instance' ]
  if (!possibleValues.includes(value)) throw new Error('Should have a bulk removal scope among ' + possibleValues.join(', '))
  return true
}

// ---------------------------------------------------------------------------

export {
  checkBulkRemoveCommentsOfScope
}
