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

function addMethodsToModel (model: any, classMethods: Function[], instanceMethods: Function[] = []) {
  classMethods.forEach(m => model[m.name] = m)
  instanceMethods.forEach(m => model.prototype[m.name] = m)
}

function getSortOnModel (model: any, value: string) {
  let sort = getSort(value)

  if (model) return [ { model: model }, sort[0], sort[1] ]
  return sort
}

// ---------------------------------------------------------------------------

export {
  addMethodsToModel,
  getSort,
  getSortOnModel
}
