'use strict'

const miscsUtils = {
  dateIsValid
}

// ---------------------- Export functions --------------------

function dateIsValid (dateString) {
  const dateToCheck = new Date(dateString)
  const now = new Date()

  // Check if the interval is more than 2 minutes
  if (now - dateToCheck > 120000) return false

  return true
}

// ---------------------------------------------------------------------------

module.exports = miscsUtils
