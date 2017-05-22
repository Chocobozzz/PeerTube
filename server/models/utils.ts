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

function addMethodsToModel (model: any, classMethods: Function[], instanceMethods: Function[] = []) {
  classMethods.forEach(m => model[m.name] = m)
  instanceMethods.forEach(m => model.prototype[m.name] = m)
}

// ---------------------------------------------------------------------------

export {
  addMethodsToModel,
  getSort
}
