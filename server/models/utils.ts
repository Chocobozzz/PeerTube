import { Sequelize } from 'sequelize-typescript'

type SortType = { sortModel: any, sortValue: string }

// Translate for example "-name" to [ [ 'name', 'DESC' ], [ 'id', 'ASC' ] ]
function getSort (value: string, lastSort: string[] = [ 'id', 'ASC' ]) {
  let { direction, field } = buildDirectionAndField(value)

  if (field.toLowerCase() === 'match') { // Search
    field = Sequelize.col('similarity')
  }

  return [ [ field, direction ], lastSort ]
}

function getVideoSort (value: string, lastSort: string[] = [ 'id', 'ASC' ]) {
  let { direction, field } = buildDirectionAndField(value)

  // Alias
  if (field.toLowerCase() === 'match') { // Search
    field = Sequelize.col('similarity')
  } else if (field.toLowerCase() === 'trending') { // Sort by aggregation
    return [
      [ Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('VideoViews.views')), '0'), direction ],

      [ Sequelize.col('VideoModel.views'), direction ],

      lastSort
    ]
  }

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

function buildBlockedAccountSQL (serverAccountId: number, userAccountId?: number) {
  const blockerIds = [ serverAccountId ]
  if (userAccountId) blockerIds.push(userAccountId)

  const blockerIdsString = blockerIds.join(', ')

  const query = 'SELECT "targetAccountId" AS "id" FROM "accountBlocklist" WHERE "accountId" IN (' + blockerIdsString + ')' +
    ' UNION ALL ' +
    'SELECT "account"."id" AS "id" FROM account INNER JOIN "actor" ON account."actorId" = actor.id ' +
    'INNER JOIN "serverBlocklist" ON "actor"."serverId" = "serverBlocklist"."targetServerId" ' +
    'WHERE "serverBlocklist"."accountId" IN (' + blockerIdsString + ')'

  return query
}

// ---------------------------------------------------------------------------

export {
  buildBlockedAccountSQL,
  SortType,
  getSort,
  getVideoSort,
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

function buildDirectionAndField (value: string) {
  let field: any
  let direction: 'ASC' | 'DESC'

  if (value.substring(0, 1) === '-') {
    direction = 'DESC'
    field = value.substring(1)
  } else {
    direction = 'ASC'
    field = value
  }

  return { direction, field }
}
