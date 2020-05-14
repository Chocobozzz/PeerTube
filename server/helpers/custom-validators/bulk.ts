function isBulkRemoveCommentsOfScopeValid (value: string) {
  return value === 'my-videos' || value === 'instance'
}

// ---------------------------------------------------------------------------

export {
  isBulkRemoveCommentsOfScopeValid
}
