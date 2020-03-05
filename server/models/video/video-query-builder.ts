import { VideoFilter, VideoPrivacy, VideoState } from '@shared/models'
import { buildDirectionAndField, createSafeIn } from '@server/models/utils'
import { Model } from 'sequelize-typescript'
import { MUserAccountId, MUserId } from '@server/typings/models'
import validator from 'validator'

export type BuildVideosQueryOptions = {
  attributes?: string[]

  serverAccountId: number
  followerActorId: number
  includeLocalVideos: boolean

  count: number
  start: number
  sort: string

  filter?: VideoFilter
  categoryOneOf?: number[]
  nsfw?: boolean
  licenceOneOf?: number[]
  languageOneOf?: string[]
  tagsOneOf?: string[]
  tagsAllOf?: string[]

  withFiles?: boolean

  accountId?: number
  videoChannelId?: number

  videoPlaylistId?: number

  trendingDays?: number
  user?: MUserAccountId
  historyOfUser?: MUserId

  startDate?: string // ISO 8601
  endDate?: string // ISO 8601
  originallyPublishedStartDate?: string
  originallyPublishedEndDate?: string

  durationMin?: number // seconds
  durationMax?: number // seconds

  search?: string

  isCount?: boolean

  group?: string
  having?: string
}

function buildListQuery (model: typeof Model, options: BuildVideosQueryOptions) {
  const and: string[] = []
  const cte: string[] = []
  const joins: string[] = []
  const replacements: any = {}

  let attributes: string[] = options.attributes || [ '"video"."id"' ]
  let group = options.group || ''
  const having = options.having || ''

  joins.push(
    'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId"' +
    'INNER JOIN "account" ON "account"."id" = "videoChannel"."accountId"' +
    'INNER JOIN "actor" ON "account"."actorId" = "actor"."id"'
  )

  and.push('"video"."id" NOT IN (SELECT "videoBlacklist"."videoId" FROM "videoBlacklist")')

  if (options.serverAccountId) {
    const blockerIds = [ options.serverAccountId ]
    if (options.user) blockerIds.push(options.user.Account.id)

    cte.push(
      '"mutedAccount" AS (' +
      '    SELECT "targetAccountId" AS "id"' +
      '    FROM "accountBlocklist"' +
      '    WHERE "accountId" IN (' + createSafeIn(model, blockerIds) + ')' +
      '    UNION ALL' +
      '    SELECT "account"."id" AS "id"' +
      '    FROM account' +
      '             INNER JOIN "actor" ON account."actorId" = actor.id' +
      '             INNER JOIN "serverBlocklist" ON "actor"."serverId" = "serverBlocklist"."targetServerId"' +
      '    WHERE "serverBlocklist"."accountId" IN (' + createSafeIn(model, blockerIds) + ')' +
      ')'
    )

    cte.push(
      '"mutedChannel" AS (' +
      '        SELECT "videoChannel"."id"' +
      '      FROM "videoChannel"' +
      '      INNER JOIN "mutedAccount" ON "mutedAccount"."id" = "videoChannel"."accountId"' +
      '    )'
    )

    and.push(
      '"video"."channelId" NOT IN (SELECT "id" FROM "mutedChannel")'
    )

    replacements.videoChannelId = options.videoChannelId
  }

  // Only list public/published videos
  if (!options.filter || options.filter !== 'all-local') {
    and.push(
      `("video"."state" = ${VideoState.PUBLISHED} OR ` +
      `("video"."state" = ${VideoState.TO_TRANSCODE} AND "video"."waitTranscoding" IS false))`
    )

    if (options.user) {
      and.push(
        `("video"."privacy" = ${VideoPrivacy.PUBLIC} OR "video"."privacy" = ${VideoPrivacy.INTERNAL})`
      )
    } else { // Or only public videos
      and.push(
        `"video"."privacy" = ${VideoPrivacy.PUBLIC}`
      )
    }
  }

  if (options.videoPlaylistId) {
    joins.push(
      'INNER JOIN "videoPlaylistElement" "video"."id" = "videoPlaylistElement"."videoId" ' +
      'AND "videoPlaylistElement"."videoPlaylistId" = :videoPlaylistId'
    )

    replacements.videoPlaylistId = options.videoPlaylistId
  }

  if (options.filter && (options.filter === 'local' || options.filter === 'all-local')) {
    and.push('"video"."remote" IS FALSE')
  }

  if (options.accountId) {
    and.push('"account"."id" = :accountId')
    replacements.accountId = options.accountId
  }

  if (options.videoChannelId) {
    and.push('"videoChannel"."id" = :videoChannelId')
    replacements.videoChannelId = options.videoChannelId
  }

  if (options.followerActorId) {
    let query =
      '(' +
      '  EXISTS (' +
      '    SELECT 1 FROM "videoShare" ' +
      '    INNER JOIN "actorFollow" "actorFollowShare" ON "actorFollowShare"."targetActorId" = "videoShare"."actorId" ' +
      '    AND "actorFollowShare"."actorId" = :followerActorId WHERE "videoShare"."videoId" = "video"."id"' +
      '  )' +
      '  OR' +
      '  EXISTS (' +
      '    SELECT 1 from "actorFollow" ' +
      '    WHERE "actorFollow"."targetActorId" = "actor"."id" AND "actorFollow"."actorId" = :followerActorId' +
      '  )'

    if (options.includeLocalVideos) {
      query += '  OR "video"."remote" IS FALSE'
    }

    query += ')'

    and.push(query)
    replacements.followerActorId = options.followerActorId
  }

  if (options.withFiles === true) {
    and.push('EXISTS (SELECT 1 FROM "videoFile" WHERE "videoFile"."videoId" = "video"."id")')
  }

  if (options.tagsOneOf) {
    const tagsOneOfLower = options.tagsOneOf.map(t => t.toLowerCase())

    and.push(
      'EXISTS (' +
      '  SELECT 1 FROM "videoTag" ' +
      '  INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
      '  WHERE lower("tag"."name") IN (' + createSafeIn(model, tagsOneOfLower) + ') ' +
      '  AND "video"."id" = "videoTag"."videoId"' +
      ')'
    )
  }

  if (options.tagsAllOf) {
    const tagsAllOfLower = options.tagsAllOf.map(t => t.toLowerCase())

    and.push(
      'EXISTS (' +
      '  SELECT 1 FROM "videoTag" ' +
      '  INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
      '  WHERE lower("tag"."name") IN (' + createSafeIn(model, tagsAllOfLower) + ') ' +
      '  AND "video"."id" = "videoTag"."videoId" ' +
      '  GROUP BY "videoTag"."videoId" HAVING COUNT(*) = ' + tagsAllOfLower.length +
      ')'
    )
  }

  if (options.nsfw === true) {
    and.push('"video"."nsfw" IS TRUE')
  }

  if (options.nsfw === false) {
    and.push('"video"."nsfw" IS FALSE')
  }

  if (options.categoryOneOf) {
    and.push('"video"."category" IN (:categoryOneOf)')
    replacements.categoryOneOf = options.categoryOneOf
  }

  if (options.licenceOneOf) {
    and.push('"video"."licence" IN (:licenceOneOf)')
    replacements.licenceOneOf = options.licenceOneOf
  }

  if (options.languageOneOf) {
    replacements.languageOneOf = options.languageOneOf.filter(l => l && l !== '_unknown')

    let languagesQuery = '("video"."language" IN (:languageOneOf) OR '

    if (options.languageOneOf.includes('_unknown')) {
      languagesQuery += '"video"."language" IS NULL OR '
    }

    and.push(
      languagesQuery +
      '  EXISTS (' +
      '    SELECT 1 FROM "videoCaption" WHERE "videoCaption"."language" ' +
      '    IN (' + createSafeIn(model, options.languageOneOf) + ') AND ' +
      '    "videoCaption"."videoId" = "video"."id"' +
      '  )' +
      ')'
    )
  }

  // We don't exclude results in this if so if we do a count we don't need to add this complex clauses
  if (options.trendingDays && options.isCount !== true) {
    const viewsGteDate = new Date(new Date().getTime() - (24 * 3600 * 1000) * options.trendingDays)

    joins.push('LEFT JOIN "videoView" ON "video"."id" = "videoView"."videoId" AND "videoView"."startDate" >= :viewsGteDate')
    replacements.viewsGteDate = viewsGteDate

    group = 'GROUP BY "video"."id"'
  }

  if (options.historyOfUser) {
    joins.push('INNER JOIN "userVideoHistory" on "video"."id" = "userVideoHistory"."videoId"')

    and.push('"userVideoHistory"."userId" = :historyOfUser')
    replacements.historyOfUser = options.historyOfUser
  }

  if (options.startDate) {
    and.push('"video"."publishedAt" >= :startDate')
    replacements.startDate = options.startDate
  }

  if (options.endDate) {
    and.push('"video"."publishedAt" <= :endDate')
    replacements.endDate = options.endDate
  }

  if (options.originallyPublishedStartDate) {
    and.push('"video"."originallyPublishedAt" >= :originallyPublishedStartDate')
    replacements.originallyPublishedStartDate = options.originallyPublishedStartDate
  }

  if (options.originallyPublishedEndDate) {
    and.push('"video"."originallyPublishedAt" <= :originallyPublishedEndDate')
    replacements.originallyPublishedEndDate = options.originallyPublishedEndDate
  }

  if (options.durationMin) {
    and.push('"video"."duration" >= :durationMin')
    replacements.durationMin = options.durationMin
  }

  if (options.durationMax) {
    and.push('"video"."duration" <= :durationMax')
    replacements.durationMax = options.durationMax
  }

  if (options.search) {
    const escapedSearch = model.sequelize.escape(options.search)
    const escapedLikeSearch = model.sequelize.escape('%' + options.search + '%')

    let base = '(' +
    '  lower(immutable_unaccent("video"."name")) % lower(immutable_unaccent(' + escapedSearch + ')) OR ' +
    '  lower(immutable_unaccent("video"."name")) LIKE lower(immutable_unaccent(' + escapedLikeSearch + ')) OR ' +
    '  EXISTS (' +
    '    SELECT 1 FROM "videoTag" ' +
    '    INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
    `    WHERE lower("tag"."name") = ${escapedSearch} ` +
    '    AND "video"."id" = "videoTag"."videoId"' +
    '  )'

    if (validator.isUUID(options.search)) {
      base += ` OR "video"."uuid" = ${escapedSearch}`
    }

    base += ')'
    and.push(base)

    attributes.push(`similarity(lower(immutable_unaccent("video"."name")), lower(immutable_unaccent(${escapedSearch}))) as similarity`)
  } else {
    attributes.push('0 as similarity')
  }

  if (options.isCount === true) attributes = [ 'COUNT(*) as "total"' ]

  const cteString = cte.length !== 0
    ? 'WITH ' + cte.join(', ') + ' '
    : ''

  let query = cteString +
    'SELECT ' + attributes.join(', ') + ' ' +
    'FROM "video" ' + joins.join(' ') + ' ' +
    'WHERE ' + and.join(' AND ') + ' ' +
    group + ' ' +
    having + ' '

  if (options.isCount !== true) {
    const count = parseInt(options.count + '', 10)
    const start = parseInt(options.start + '', 10)

    query += buildOrder(model, options.sort) + ' ' +
      'LIMIT ' + count + ' ' +
      'OFFSET ' + start
  }

  return { query, replacements }
}

function buildOrder (model: typeof Model, value: string) {
  const { direction, field } = buildDirectionAndField(value)
  if (field.match(/^[a-zA-Z]+$/) === null) throw new Error('Invalid sort column ' + field)

  if (field.toLowerCase() === 'random') return 'ORDER BY RANDOM()'

  if (field.toLowerCase() === 'trending') { // Sort by aggregation
    return `ORDER BY COALESCE(SUM("videoView"."views"), 0) ${direction}, "video"."views" ${direction}`
  }

  let firstSort: string

  if (field.toLowerCase() === 'match') { // Search
    firstSort = '"similarity"'
  } else {
    firstSort = `"video"."${field}"`
  }

  return `ORDER BY ${firstSort} ${direction}, "video"."id" ASC`
}

export {
  buildListQuery
}
