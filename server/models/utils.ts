import { literal, Op, OrderItem } from 'sequelize'
import { Model, Sequelize } from 'sequelize-typescript'
import { Col } from 'sequelize/types/lib/utils'
import validator from 'validator'

type SortType = { sortModel: string, sortValue: string }

// Translate for example "-name" to [ [ 'name', 'DESC' ], [ 'id', 'ASC' ] ]
function getSort (value: string, lastSort: OrderItem = [ 'id', 'ASC' ]): OrderItem[] {
  const { direction, field } = buildDirectionAndField(value)

  let finalField: string | Col

  if (field.toLowerCase() === 'match') { // Search
    finalField = Sequelize.col('similarity')
  } else if (field === 'videoQuotaUsed') { // Users list
    finalField = Sequelize.col('videoQuotaUsed')
  } else {
    finalField = field
  }

  return [ [ finalField, direction ], lastSort ]
}

function getPlaylistSort (value: string, lastSort: OrderItem = [ 'id', 'ASC' ]): OrderItem[] {
  const { direction, field } = buildDirectionAndField(value)

  if (field.toLowerCase() === 'name') {
    return [ [ 'displayName', direction ], lastSort ]
  }

  return getSort(value, lastSort)
}

function getCommentSort (value: string, lastSort: OrderItem = [ 'id', 'ASC' ]): OrderItem[] {
  const { direction, field } = buildDirectionAndField(value)

  if (field === 'totalReplies') {
    return [
      [ Sequelize.literal('"totalReplies"'), direction ],
      lastSort
    ]
  }

  return getSort(value, lastSort)
}

function getVideoSort (value: string, lastSort: OrderItem = [ 'id', 'ASC' ]): OrderItem[] {
  const { direction, field } = buildDirectionAndField(value)

  if (field.toLowerCase() === 'trending') { // Sort by aggregation
    return [
      [ Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('VideoViews.views')), '0'), direction ],

      [ Sequelize.col('VideoModel.views'), direction ],

      lastSort
    ]
  }

  let finalField: string | Col

  // Alias
  if (field.toLowerCase() === 'match') { // Search
    finalField = Sequelize.col('similarity')
  } else {
    finalField = field
  }

  const firstSort = typeof finalField === 'string'
    ? finalField.split('.').concat([ direction ]) as any // FIXME: sequelize typings
    : [ finalField, direction ]

  return [ firstSort, lastSort ]
}

function getBlacklistSort (model: any, value: string, lastSort: OrderItem = [ 'id', 'ASC' ]): OrderItem[] {
  const [ firstSort ] = getSort(value)

  if (model) return [ [ literal(`"${model}.${firstSort[0]}" ${firstSort[1]}`) ], lastSort ] as any[] // FIXME: typings
  return [ firstSort, lastSort ]
}

function getFollowsSort (value: string, lastSort: OrderItem = [ 'id', 'ASC' ]): OrderItem[] {
  const { direction, field } = buildDirectionAndField(value)

  if (field === 'redundancyAllowed') {
    return [
      [ 'ActorFollowing', 'Server', 'redundancyAllowed', direction ],
      lastSort
    ]
  }

  return getSort(value, lastSort)
}

function isOutdated (model: { createdAt: Date, updatedAt: Date }, refreshInterval: number) {
  const now = Date.now()
  const createdAtTime = model.createdAt.getTime()
  const updatedAtTime = model.updatedAt.getTime()

  return (now - createdAtTime) > refreshInterval && (now - updatedAtTime) > refreshInterval
}

function throwIfNotValid (value: any, validator: (value: any) => boolean, fieldName = 'value', nullable = false) {
  if (nullable && (value === null || value === undefined)) return

  if (validator(value) === false) {
    throw new Error(`"${value}" is not a valid ${fieldName}.`)
  }
}

function buildTrigramSearchIndex (indexName: string, attribute: string) {
  return {
    name: indexName,
    // FIXME: gin_trgm_ops is not taken into account in Sequelize 6, so adding it ourselves in the literal function
    fields: [ Sequelize.literal('lower(immutable_unaccent(' + attribute + ')) gin_trgm_ops') as any ],
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

function buildBlockedAccountSQL (blockerIds: number[]) {
  const blockerIdsString = blockerIds.join(', ')

  return 'SELECT "targetAccountId" AS "id" FROM "accountBlocklist" WHERE "accountId" IN (' + blockerIdsString + ')' +
    ' UNION ALL ' +
    'SELECT "account"."id" AS "id" FROM account INNER JOIN "actor" ON account."actorId" = actor.id ' +
    'INNER JOIN "serverBlocklist" ON "actor"."serverId" = "serverBlocklist"."targetServerId" ' +
    'WHERE "serverBlocklist"."accountId" IN (' + blockerIdsString + ')'
}

function buildBlockedAccountSQLOptimized (columnNameJoin: string, blockerIds: number[]) {
  const blockerIdsString = blockerIds.join(', ')

  return [
    literal(
      `NOT EXISTS (` +
      `  SELECT 1 FROM "accountBlocklist" ` +
      `  WHERE "targetAccountId" = ${columnNameJoin} ` +
      `  AND "accountId" IN (${blockerIdsString})` +
      `)`
    ),

    literal(
      `NOT EXISTS (` +
      `  SELECT 1 FROM "account" ` +
      `  INNER JOIN "actor" ON account."actorId" = actor.id ` +
      `  INNER JOIN "serverBlocklist" ON "actor"."serverId" = "serverBlocklist"."targetServerId" ` +
      `  WHERE "account"."id" = ${columnNameJoin} ` +
      `  AND "serverBlocklist"."accountId" IN (${blockerIdsString})` +
      `)`
    )
  ]
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

function parseAggregateResult (result: any) {
  if (!result) return 0

  const total = parseInt(result + '', 10)
  if (isNaN(total)) return 0

  return total
}

const createSafeIn = (model: typeof Model, stringArr: (string | number)[]) => {
  return stringArr.map(t => {
    return t === null
      ? null
      : model.sequelize.escape('' + t)
  }).join(', ')
}

function buildLocalAccountIdsIn () {
  return literal(
    '(SELECT "account"."id" FROM "account" INNER JOIN "actor" ON "actor"."id" = "account"."actorId" AND "actor"."serverId" IS NULL)'
  )
}

function buildLocalActorIdsIn () {
  return literal(
    '(SELECT "actor"."id" FROM "actor" WHERE "actor"."serverId" IS NULL)'
  )
}

function buildDirectionAndField (value: string) {
  let field: string
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

function searchAttribute (sourceField?: string, targetField?: string) {
  if (!sourceField) return {}

  return {
    [targetField]: {
      [Op.iLike]: `%${sourceField}%`
    }
  }
}

// ---------------------------------------------------------------------------

export {
  buildBlockedAccountSQL,
  buildBlockedAccountSQLOptimized,
  buildLocalActorIdsIn,
  getPlaylistSort,
  SortType,
  buildLocalAccountIdsIn,
  getSort,
  getCommentSort,
  getVideoSort,
  getBlacklistSort,
  createSimilarityAttribute,
  throwIfNotValid,
  buildServerIdsFollowedBy,
  buildTrigramSearchIndex,
  buildWhereIdOrUUID,
  isOutdated,
  parseAggregateResult,
  getFollowsSort,
  buildDirectionAndField,
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
