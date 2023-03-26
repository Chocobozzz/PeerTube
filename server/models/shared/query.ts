import { BindOrReplacements, Op, QueryTypes, Sequelize } from 'sequelize'
import validator from 'validator'
import { forceNumber } from '@shared/core-utils'

function doesExist (sequelize: Sequelize, query: string, bind?: BindOrReplacements) {
  const options = {
    type: QueryTypes.SELECT as QueryTypes.SELECT,
    bind,
    raw: true
  }

  return sequelize.query(query, options)
            .then(results => results.length === 1)
}

function createSimilarityAttribute (col: string, value: string) {
  return Sequelize.fn(
    'similarity',

    searchTrigramNormalizeCol(col),

    searchTrigramNormalizeValue(value)
  )
}

function buildWhereIdOrUUID (id: number | string) {
  return validator.isInt('' + id) ? { id } : { uuid: id }
}

function parseAggregateResult (result: any) {
  if (!result) return 0

  const total = forceNumber(result)
  if (isNaN(total)) return 0

  return total
}

function parseRowCountResult (result: any) {
  if (result.length !== 0) return result[0].total

  return 0
}

function createSafeIn (sequelize: Sequelize, toEscape: (string | number)[], additionalUnescaped: string[] = []) {
  return toEscape.map(t => {
    return t === null
      ? null
      : sequelize.escape('' + t)
  }).concat(additionalUnescaped).join(', ')
}

function searchAttribute (sourceField?: string, targetField?: string) {
  if (!sourceField) return {}

  return {
    [targetField]: {
      // FIXME: ts error
      [Op.iLike as any]: `%${sourceField}%`
    }
  }
}

export {
  doesExist,
  createSimilarityAttribute,
  buildWhereIdOrUUID,
  parseAggregateResult,
  parseRowCountResult,
  createSafeIn,
  searchAttribute
}

// ---------------------------------------------------------------------------

function searchTrigramNormalizeValue (value: string) {
  return Sequelize.fn('lower', Sequelize.fn('immutable_unaccent', value))
}

function searchTrigramNormalizeCol (col: string) {
  return Sequelize.fn('lower', Sequelize.fn('immutable_unaccent', Sequelize.col(col)))
}
