import { Sequelize } from 'sequelize-typescript'
import * as validator from 'validator'
import { ACTIVITY_PUB } from '../initializers'

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

  const firstSort = typeof field === 'string' ?
    field.split('.').concat([ direction ]) :
    [ field, direction ]

  return [ firstSort, lastSort ]
}

function getSortOnModel (model: any, value: string, lastSort: string[] = [ 'id', 'ASC' ]) {
  let [ firstSort ] = getSort(value)

  if (model) return [ [ model, firstSort[0], firstSort[1] ], lastSort ]
  return [ firstSort, lastSort ]
}

function isOutdated (model: { createdAt: Date, updatedAt: Date }, refreshInterval: number) {
  const now = Date.now()
  const createdAtTime = model.createdAt.getTime()
  const updatedAtTime = model.updatedAt.getTime()

  return (now - createdAtTime) > refreshInterval && (now - updatedAtTime) > refreshInterval
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

  return 'SELECT "targetAccountId" AS "id" FROM "accountBlocklist" WHERE "accountId" IN (' + blockerIdsString + ')' +
    ' UNION ALL ' +
    'SELECT "account"."id" AS "id" FROM account INNER JOIN "actor" ON account."actorId" = actor.id ' +
    'INNER JOIN "serverBlocklist" ON "actor"."serverId" = "serverBlocklist"."targetServerId" ' +
    'WHERE "serverBlocklist"."accountId" IN (' + blockerIdsString + ')'
}

function buildServerIdsFollowedBy (actorId: any) {
  const actorIdNumber = parseInt(actorId + '', 10)

  return '(' +
    'SELECT "actor"."serverId" FROM "actorFollow" ' +
    'INNER JOIN "actor" ON actor.id = "actorFollow"."targetActorId" ' +
    'WHERE "actorFollow"."actorId" = ' + actorIdNumber +
  ')'
}

function buildWhereIdOrUUID (id: number | string) {
  return validator.isInt('' + id) ? { id } : { uuid: id }
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
  buildServerIdsFollowedBy,
  buildTrigramSearchIndex,
  buildWhereIdOrUUID,
  isOutdated
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
