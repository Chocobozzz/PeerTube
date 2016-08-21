'use strict'

const miscValidators = {
  exists: exists,
  isArray: isArray
}

function exists (value) {
  return value !== undefined && value !== null
}

function isArray (value) {
  return Array.isArray(value)
}

// ---------------------------------------------------------------------------

module.exports = miscValidators
