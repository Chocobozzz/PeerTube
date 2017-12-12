// Translate for example "-name" to [ 'name', 'DESC' ]
function getSort (value: string) {
  let field: string
  let direction: 'ASC' | 'DESC'

  if (value.substring(0, 1) === '-') {
    direction = 'DESC'
    field = value.substring(1)
  } else {
    direction = 'ASC'
    field = value
  }

  return [ field, direction ]
}

function getSortOnModel (model: any, value: string) {
  let sort = getSort(value)

  if (model) return [ model, sort[0], sort[1] ]
  return sort
}

function throwIfNotValid (value: any, validator: (value: any) => boolean, fieldName = 'value') {
  if (validator(value) === false) {
    throw new Error(`"${value}" is not a valid ${fieldName}.`)
  }
}

// ---------------------------------------------------------------------------

export {
  getSort,
  getSortOnModel,
  throwIfNotValid
}
