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

function parseRowCountResult (result: any): number {
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
      [Op.iLike as any]: buildLikeSearch(sourceField)
    }
  }
}

// ---------------------------------------------------------------------------

const SEARCH_MAX_LENGTH = 250 // Word similarity and LIKE costs grow with the search length
function truncateSearch (search: string) {
  return (search + '').slice(0, SEARCH_MAX_LENGTH)
}

function buildLikeSearch (search: string) {
  const escaped = (search + '').replace(/[\\%_]/g, '\\$&')

  return '%' + escaped + '%'
}

// pg_trgm only extracts trigrams from letters and digits: without any, a trigram index cannot filter and PG would scan all rows
function hasTrigramChars (search: string) {
  return /[\p{L}\p{N}]/u.test(search)
}

// Minimum length to use the trigram index
const LIKE_SEARCH_MIN_LENGTH = 3

function canUseLikeSearch (search: string) {
  return hasTrigramChars(search) && search.trim().length >= LIKE_SEARCH_MIN_LENGTH
}

export {
  buildLikeSearch,
  buildWhereIdOrUUID,
  canUseLikeSearch,
  createSafeIn,
  createSimilarityAttribute,
  doesExist,
  hasTrigramChars,
  parseAggregateResult,
  parseRowCountResult,
  SEARCH_MAX_LENGTH,
  searchAttribute,
  truncateSearch
}

// ---------------------------------------------------------------------------

function searchTrigramNormalizeValue (value: string) {
  return Sequelize.fn('lower', Sequelize.fn('immutable_unaccent', value))
}

function searchTrigramNormalizeCol (col: string) {
  return Sequelize.fn('lower', Sequelize.fn('immutable_unaccent', Sequelize.col(col)))
}
