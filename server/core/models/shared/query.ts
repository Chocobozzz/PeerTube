import { forceNumber } from '@peertube/peertube-core-utils'
import { BindOrReplacements, Op, QueryOptionsWithType, QueryTypes, Sequelize, Transaction } from 'sequelize'
import { Fn } from 'sequelize/types/utils'
import validator from 'validator'

async function doesExist (options: {
  sequelize: Sequelize
  query: string
  bind?: BindOrReplacements
  transaction?: Transaction
}) {
  const { sequelize, query, bind, transaction } = options

  const queryOptions: QueryOptionsWithType<QueryTypes.SELECT> = {
    type: QueryTypes.SELECT,
    bind,
    raw: true,
    transaction
  }

  const results = await sequelize.query(query, queryOptions)

  return results.length === 1
}

// FIXME: have to specify the result type to not break peertube typings generation
function createSimilarityAttribute (col: string, value: string): Fn {
  return Sequelize.fn(
    'similarity',

    searchTrigramNormalizeCol(col),

    searchTrigramNormalizeValue(value)
  )
}

function buildWhereIdOrUUID (id: number | string) {
  return validator.default.isInt('' + id) ? { id } : { uuid: id }
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
  buildWhereIdOrUUID, createSafeIn, createSimilarityAttribute, doesExist, parseAggregateResult,
  parseRowCountResult, searchAttribute
}

// ---------------------------------------------------------------------------

function searchTrigramNormalizeValue (value: string) {
  return Sequelize.fn('lower', Sequelize.fn('immutable_unaccent', value))
}

function searchTrigramNormalizeCol (col: string) {
  return Sequelize.fn('lower', Sequelize.fn('immutable_unaccent', Sequelize.col(col)))
}
