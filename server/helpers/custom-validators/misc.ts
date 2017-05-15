function exists (value) {
  return value !== undefined && value !== null
}

function isArray (value) {
  return Array.isArray(value)
}

// ---------------------------------------------------------------------------

export {
  exists,
  isArray
}
