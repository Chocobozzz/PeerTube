'use strict'

const utils = {
  getSort
}

// Translate for example "-name" to [ 'name', 'DESC' ]
function getSort (value) {
  let field
  let direction

  if (value.substring(0, 1) === '-') {
    direction = 'DESC'
    field = value.substring(1)
  } else {
    direction = 'ASC'
    field = value
  }

  return [ field, direction ]
}

// ---------------------------------------------------------------------------

module.exports = utils
