// Translate for example "-name" to [ [ 'name', 'DESC' ], [ 'id', 'ASC' ] ]
import { Sequelize } from 'sequelize-typescript'

type SortType = { sortModel: any, sortValue: string }

function getSort (value: string, lastSort: string[] = [ 'id', 'ASC' ]) {
  let field: any
  let direction: 'ASC' | 'DESC'

  if (value.substring(0, 1) === '-') {
    direction = 'DESC'
    field = value.substring(1)
  } else {
    direction = 'ASC'
    field = value
  }

  // Alias
  if (field.toLowerCase() === 'match') field = Sequelize.col('similarity')

  return [ [ field, direction ], lastSort ]
}

function getSortOnModel (model: any, value: string, lastSort: string[] = [ 'id', 'ASC' ]) {
  let [ firstSort ] = getSort(value)

  if (model) return [ [ model, firstSort[0], firstSort[1] ], lastSort ]
  return [ firstSort, lastSort ]
}

function throwIfNotValid (value: any, validator: (value: any) => boolean, fieldName = 'value') {
  if (validator(value) === false) {
    throw new Error(`"${value}" is not a valid ${fieldName}.`)
  }
}

function buildTrigramSearchIndex (indexName: string, attribute: string) {
  return {
    name: indexName,
    fields: [ Sequelize.literal('lower(immutable_unaccent(' + attribute + '))') as any ],
    using: 'gin',
    operator: 'gin_trgm_ops'
  }
}

function createSimilarityAttribute (col: string, value: string) {
  return Sequelize.fn(
    'similarity',

    searchTrigramNormalizeCol(col),

    searchTrigramNormalizeValue(value)
  )
}

// ---------------------------------------------------------------------------

export {
  SortType,
  getSort,
  getSortOnModel,
  createSimilarityAttribute,
  throwIfNotValid,
  buildTrigramSearchIndex
}

// ---------------------------------------------------------------------------

function searchTrigramNormalizeValue (value: string) {
  return Sequelize.fn('lower', Sequelize.fn('immutable_unaccent', value))
}

function searchTrigramNormalizeCol (col: string) {
  return Sequelize.fn('lower', Sequelize.fn('immutable_unaccent', Sequelize.col(col)))
}
