'use strict'

const miscsUtils = {
  dateIsValid
}

// ---------------------- Export functions --------------------

function dateIsValid (dateString, interval) {
  const dateToCheck = new Date(dateString)
  const now = new Date()

  // Check if the interval is more than 2 minutes
  if (!interval) interval = 120000

  if (now - dateToCheck > interval) return false

  return true
}

// ---------------------------------------------------------------------------

module.exports = miscsUtils
