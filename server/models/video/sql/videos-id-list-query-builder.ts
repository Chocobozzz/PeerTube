import { Sequelize } from 'sequelize'
import validator from 'validator'
import { exists } from '@server/helpers/custom-validators/misc'
import { buildDirectionAndField, createSafeIn } from '@server/models/utils'
import { MUserAccountId, MUserId } from '@server/types/models'
import { VideoFilter, VideoPrivacy, VideoState } from '@shared/models'
import { AbstractVideosQueryBuilder } from './shared/abstract-videos-query-builder'

/**
 *
 * Build videos list SQL query to fetch rows
 *
 */

export type BuildVideosListQueryOptions = {
  attributes?: string[]

  serverAccountId: number
  followerActorId: number
  includeLocalVideos: boolean

  count: number
  start: number
  sort: string

  nsfw?: boolean
  filter?: VideoFilter
  isLive?: boolean

  categoryOneOf?: number[]
  licenceOneOf?: number[]
  languageOneOf?: string[]
  tagsOneOf?: string[]
  tagsAllOf?: string[]

  withFiles?: boolean

  accountId?: number
  videoChannelId?: number

  videoPlaylistId?: number

  trendingAlgorithm?: string // best, hot, or any other algorithm implemented
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

export class VideosIdListQueryBuilder extends AbstractVideosQueryBuilder {
  protected replacements: any = {}

  private attributes: string[]
  private joins: string[] = []

  private readonly and: string[] = []

  private readonly cte: string[] = []

  private group = ''
  private having = ''

  private sort = ''
  private limit = ''
  private offset = ''

  constructor (protected readonly sequelize: Sequelize) {
    super()
  }

  queryVideoIds (options: BuildVideosListQueryOptions) {
    this.buildIdsListQuery(options)

    return this.runQuery()
  }

  countVideoIds (countOptions: BuildVideosListQueryOptions): Promise<number> {
    this.buildIdsListQuery(countOptions)

    return this.runQuery().then(rows => rows.length !== 0 ? rows[0].total : 0)
  }

  getIdsListQueryAndSort (options: BuildVideosListQueryOptions) {
    this.buildIdsListQuery(options)
    return { query: this.query, sort: this.sort, replacements: this.replacements }
  }

  private buildIdsListQuery (options: BuildVideosListQueryOptions) {
    this.attributes = options.attributes || [ '"video"."id"' ]

    if (options.group) this.group = options.group
    if (options.having) this.having = options.having

    this.joins = this.joins.concat([
      'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId"',
      'INNER JOIN "account" ON "account"."id" = "videoChannel"."accountId"',
      'INNER JOIN "actor" "accountActor" ON "account"."actorId" = "accountActor"."id"'
    ])

    this.whereNotBlacklisted()

    if (options.serverAccountId) {
      this.whereNotBlocked(options.serverAccountId, options.user)
    }

    // Only list public/published videos
    if (!options.filter || (options.filter !== 'all-local' && options.filter !== 'all')) {
      this.whereStateAndPrivacyAvailable(options.user)
    }

    if (options.videoPlaylistId) {
      this.joinPlaylist(options.videoPlaylistId)
    }

    if (options.filter && (options.filter === 'local' || options.filter === 'all-local')) {
      this.whereOnlyLocal()
    }

    if (options.accountId) {
      this.whereAccountId(options.accountId)
    }

    if (options.videoChannelId) {
      this.whereChannelId(options.videoChannelId)
    }

    if (options.followerActorId) {
      this.whereFollowerActorId(options.followerActorId, options.includeLocalVideos)
    }

    if (options.withFiles === true) {
      this.whereFileExists()
    }

    if (options.tagsOneOf) {
      this.whereTagsOneOf(options.tagsOneOf)
    }

    if (options.tagsAllOf) {
      this.whereTagsAllOf(options.tagsAllOf)
    }

    if (options.nsfw === true) {
      this.whereNSFW()
    } else if (options.nsfw === false) {
      this.whereSFW()
    }

    if (options.isLive === true) {
      this.whereLive()
    } else if (options.isLive === false) {
      this.whereVOD()
    }

    if (options.categoryOneOf) {
      this.whereCategoryOneOf(options.categoryOneOf)
    }

    if (options.licenceOneOf) {
      this.whereLicenceOneOf(options.licenceOneOf)
    }

    if (options.languageOneOf) {
      this.whereLanguageOneOf(options.languageOneOf)
    }

    // We don't exclude results in this so if we do a count we don't need to add this complex clause
    if (options.isCount !== true) {
      if (options.trendingDays) {
        this.groupForTrending(options.trendingDays)
      } else if ([ 'best', 'hot' ].includes(options.trendingAlgorithm)) {
        this.groupForHotOrBest(options.trendingAlgorithm, options.user)
      }
    }

    if (options.historyOfUser) {
      this.joinHistory(options.historyOfUser.id)
    }

    if (options.startDate) {
      this.whereStartDate(options.startDate)
    }

    if (options.endDate) {
      this.whereEndDate(options.endDate)
    }

    if (options.originallyPublishedStartDate) {
      this.whereOriginallyPublishedStartDate(options.originallyPublishedStartDate)
    }

    if (options.originallyPublishedEndDate) {
      this.whereOriginallyPublishedEndDate(options.originallyPublishedEndDate)
    }

    if (options.durationMin) {
      this.whereDurationMin(options.durationMin)
    }

    if (options.durationMax) {
      this.whereDurationMax(options.durationMax)
    }

    this.whereSearch(options.search)

    if (options.isCount === true) {
      this.setCountAttribute()
    } else {
      if (exists(options.sort)) {
        this.setSort(options.sort)
      }

      if (exists(options.count)) {
        this.setLimit(options.count)
      }

      if (exists(options.start)) {
        this.setOffset(options.start)
      }
    }

    const cteString = this.cte.length !== 0
      ? `WITH ${this.cte.join(', ')} `
      : ''

    this.query = cteString +
      'SELECT ' + this.attributes.join(', ') + ' ' +
      'FROM "video" ' + this.joins.join(' ') + ' ' +
      'WHERE ' + this.and.join(' AND ') + ' ' +
      this.group + ' ' +
      this.having + ' ' +
      this.sort + ' ' +
      this.limit + ' ' +
      this.offset
  }

  private setCountAttribute () {
    this.attributes = [ 'COUNT(*) as "total"' ]
  }

  private joinHistory (userId: number) {
    this.joins.push('INNER JOIN "userVideoHistory" ON "video"."id" = "userVideoHistory"."videoId"')

    this.and.push('"userVideoHistory"."userId" = :historyOfUser')

    this.replacements.historyOfUser = userId
  }

  private joinPlaylist (playlistId: number) {
    this.joins.push(
      'INNER JOIN "videoPlaylistElement" "video"."id" = "videoPlaylistElement"."videoId" ' +
      'AND "videoPlaylistElement"."videoPlaylistId" = :videoPlaylistId'
    )

    this.replacements.videoPlaylistId = playlistId
  }

  private whereStateAndPrivacyAvailable (user?: MUserAccountId) {
    this.and.push(
      `("video"."state" = ${VideoState.PUBLISHED} OR ` +
      `("video"."state" = ${VideoState.TO_TRANSCODE} AND "video"."waitTranscoding" IS false))`
    )

    if (user) {
      this.and.push(
        `("video"."privacy" = ${VideoPrivacy.PUBLIC} OR "video"."privacy" = ${VideoPrivacy.INTERNAL})`
      )
    } else { // Or only public videos
      this.and.push(
        `"video"."privacy" = ${VideoPrivacy.PUBLIC}`
      )
    }
  }

  private whereOnlyLocal () {
    this.and.push('"video"."remote" IS FALSE')
  }

  private whereAccountId (accountId: number) {
    this.and.push('"account"."id" = :accountId')
    this.replacements.accountId = accountId
  }

  private whereChannelId (channelId: number) {
    this.and.push('"videoChannel"."id" = :videoChannelId')
    this.replacements.videoChannelId = channelId
  }

  private whereFollowerActorId (followerActorId: number, includeLocalVideos: boolean) {
    let query =
    '(' +
    '  EXISTS (' +
    '    SELECT 1 FROM "videoShare" ' +
    '    INNER JOIN "actorFollow" "actorFollowShare" ON "actorFollowShare"."targetActorId" = "videoShare"."actorId" ' +
    '    AND "actorFollowShare"."actorId" = :followerActorId AND "actorFollowShare"."state" = \'accepted\' ' +
    '    WHERE "videoShare"."videoId" = "video"."id"' +
    '  )' +
    '  OR' +
    '  EXISTS (' +
    '    SELECT 1 from "actorFollow" ' +
    '    WHERE "actorFollow"."targetActorId" = "videoChannel"."actorId" AND "actorFollow"."actorId" = :followerActorId ' +
    '    AND "actorFollow"."state" = \'accepted\'' +
    '  )'

    if (includeLocalVideos) {
      query += '  OR "video"."remote" IS FALSE'
    }

    query += ')'

    this.and.push(query)
    this.replacements.followerActorId = followerActorId
  }

  private whereFileExists () {
    this.and.push(
      '(' +
      '  EXISTS (SELECT 1 FROM "videoFile" WHERE "videoFile"."videoId" = "video"."id") ' +
      '  OR EXISTS (' +
      '    SELECT 1 FROM "videoStreamingPlaylist" ' +
      '    INNER JOIN "videoFile" ON "videoFile"."videoStreamingPlaylistId" = "videoStreamingPlaylist"."id" ' +
      '    WHERE "videoStreamingPlaylist"."videoId" = "video"."id"' +
      '  )' +
      ')'
    )
  }

  private whereTagsOneOf (tagsOneOf: string[]) {
    const tagsOneOfLower = tagsOneOf.map(t => t.toLowerCase())

    this.and.push(
      'EXISTS (' +
      '  SELECT 1 FROM "videoTag" ' +
      '  INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
      '  WHERE lower("tag"."name") IN (' + createSafeIn(this.sequelize, tagsOneOfLower) + ') ' +
      '  AND "video"."id" = "videoTag"."videoId"' +
      ')'
    )
  }

  private whereTagsAllOf (tagsAllOf: string[]) {
    const tagsAllOfLower = tagsAllOf.map(t => t.toLowerCase())

    this.and.push(
      'EXISTS (' +
      '  SELECT 1 FROM "videoTag" ' +
      '  INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
      '  WHERE lower("tag"."name") IN (' + createSafeIn(this.sequelize, tagsAllOfLower) + ') ' +
      '  AND "video"."id" = "videoTag"."videoId" ' +
      '  GROUP BY "videoTag"."videoId" HAVING COUNT(*) = ' + tagsAllOfLower.length +
      ')'
    )
  }

  private whereCategoryOneOf (categoryOneOf: number[]) {
    this.and.push('"video"."category" IN (:categoryOneOf)')
    this.replacements.categoryOneOf = categoryOneOf
  }

  private whereLicenceOneOf (licenceOneOf: number[]) {
    this.and.push('"video"."licence" IN (:licenceOneOf)')
    this.replacements.licenceOneOf = licenceOneOf
  }

  private whereLanguageOneOf (languageOneOf: string[]) {
    const languages = languageOneOf.filter(l => l && l !== '_unknown')
    const languagesQueryParts: string[] = []

    if (languages.length !== 0) {
      languagesQueryParts.push('"video"."language" IN (:languageOneOf)')
      this.replacements.languageOneOf = languages

      languagesQueryParts.push(
        'EXISTS (' +
        '  SELECT 1 FROM "videoCaption" WHERE "videoCaption"."language" ' +
        '  IN (' + createSafeIn(this.sequelize, languages) + ') AND ' +
        '  "videoCaption"."videoId" = "video"."id"' +
        ')'
      )
    }

    if (languageOneOf.includes('_unknown')) {
      languagesQueryParts.push('"video"."language" IS NULL')
    }

    if (languagesQueryParts.length !== 0) {
      this.and.push('(' + languagesQueryParts.join(' OR ') + ')')
    }
  }

  private whereNSFW () {
    this.and.push('"video"."nsfw" IS TRUE')
  }

  private whereSFW () {
    this.and.push('"video"."nsfw" IS FALSE')
  }

  private whereLive () {
    this.and.push('"video"."isLive" IS TRUE')
  }

  private whereVOD () {
    this.and.push('"video"."isLive" IS FALSE')
  }

  private whereNotBlocked (serverAccountId: number, user?: MUserAccountId) {
    const blockerIds = [ serverAccountId ]
    if (user) blockerIds.push(user.Account.id)

    const inClause = createSafeIn(this.sequelize, blockerIds)

    this.and.push(
      'NOT EXISTS (' +
      '  SELECT 1 FROM "accountBlocklist" ' +
      '  WHERE "accountBlocklist"."accountId" IN (' + inClause + ') ' +
      '  AND "accountBlocklist"."targetAccountId" = "account"."id" ' +
      ')' +
      'AND NOT EXISTS (' +
      '  SELECT 1 FROM "serverBlocklist" WHERE "serverBlocklist"."accountId" IN (' + inClause + ') ' +
      '  AND "serverBlocklist"."targetServerId" = "accountActor"."serverId"' +
      ')'
    )
  }

  private whereSearch (search?: string) {
    if (!search) {
      this.attributes.push('0 as similarity')
      return
    }

    const escapedSearch = this.sequelize.escape(search)
    const escapedLikeSearch = this.sequelize.escape('%' + search + '%')

    this.cte.push(
      '"trigramSearch" AS (' +
      '  SELECT "video"."id", ' +
      `  similarity(lower(immutable_unaccent("video"."name")), lower(immutable_unaccent(${escapedSearch}))) as similarity ` +
      '  FROM "video" ' +
      '  WHERE lower(immutable_unaccent("video"."name")) % lower(immutable_unaccent(' + escapedSearch + ')) OR ' +
      '        lower(immutable_unaccent("video"."name")) LIKE lower(immutable_unaccent(' + escapedLikeSearch + '))' +
      ')'
    )

    this.joins.push('LEFT JOIN "trigramSearch" ON "video"."id" = "trigramSearch"."id"')

    let base = '(' +
    '  "trigramSearch"."id" IS NOT NULL OR ' +
    '  EXISTS (' +
    '    SELECT 1 FROM "videoTag" ' +
    '    INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
    `    WHERE lower("tag"."name") = ${escapedSearch} ` +
    '    AND "video"."id" = "videoTag"."videoId"' +
    '  )'

    if (validator.isUUID(search)) {
      base += ` OR "video"."uuid" = ${escapedSearch}`
    }

    base += ')'

    this.and.push(base)
    this.attributes.push(`COALESCE("trigramSearch"."similarity", 0) as similarity`)
  }

  private whereNotBlacklisted () {
    this.and.push('"video"."id" NOT IN (SELECT "videoBlacklist"."videoId" FROM "videoBlacklist")')
  }

  private whereStartDate (startDate: string) {
    this.and.push('"video"."publishedAt" >= :startDate')
    this.replacements.startDate = startDate
  }

  private whereEndDate (endDate: string) {
    this.and.push('"video"."publishedAt" <= :endDate')
    this.replacements.endDate = endDate
  }

  private whereOriginallyPublishedStartDate (startDate: string) {
    this.and.push('"video"."originallyPublishedAt" >= :originallyPublishedStartDate')
    this.replacements.originallyPublishedStartDate = startDate
  }

  private whereOriginallyPublishedEndDate (endDate: string) {
    this.and.push('"video"."originallyPublishedAt" <= :originallyPublishedEndDate')
    this.replacements.originallyPublishedEndDate = endDate
  }

  private whereDurationMin (durationMin: number) {
    this.and.push('"video"."duration" >= :durationMin')
    this.replacements.durationMin = durationMin
  }

  private whereDurationMax (durationMax: number) {
    this.and.push('"video"."duration" <= :durationMax')
    this.replacements.durationMax = durationMax
  }

  private groupForTrending (trendingDays: number) {
    const viewsGteDate = new Date(new Date().getTime() - (24 * 3600 * 1000) * trendingDays)

    this.joins.push('LEFT JOIN "videoView" ON "video"."id" = "videoView"."videoId" AND "videoView"."startDate" >= :viewsGteDate')
    this.replacements.viewsGteDate = viewsGteDate

    this.attributes.push('COALESCE(SUM("videoView"."views"), 0) AS "score"')

    this.group = 'GROUP BY "video"."id"'
  }

  private groupForHotOrBest (trendingAlgorithm: string, user?: MUserAccountId) {
    /**
     * "Hotness" is a measure based on absolute view/comment/like/dislike numbers,
     * with fixed weights only applied to their log values.
     *
     * This algorithm gives little chance for an old video to have a good score,
     * for which recent spikes in interactions could be a sign of "hotness" and
     * justify a better score. However there are multiple ways to achieve that
     * goal, which is left for later. Yes, this is a TODO :)
     *
     * notes:
     *  - weights and base score are in number of half-days.
     *  - all comments are counted, regardless of being written by the video author or not
     * see https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx#L47-L58
     *  - we have less interactions than on reddit, so multiply weights by an arbitrary factor
     */
    const weights = {
      like: 3 * 50,
      dislike: -3 * 50,
      view: Math.floor((1 / 3) * 50),
      comment: 2 * 50, // a comment takes more time than a like to do, but can be done multiple times
      history: -2 * 50
    }

    this.joins.push('LEFT JOIN "videoComment" ON "video"."id" = "videoComment"."videoId"')

    let attribute =
      `LOG(GREATEST(1, "video"."likes" - 1)) * ${weights.like} ` + // likes (+)
      `+ LOG(GREATEST(1, "video"."dislikes" - 1)) * ${weights.dislike} ` + // dislikes (-)
      `+ LOG("video"."views" + 1) * ${weights.view} ` + // views (+)
      `+ LOG(GREATEST(1, COUNT(DISTINCT "videoComment"."id"))) * ${weights.comment} ` + // comments (+)
      '+ (SELECT (EXTRACT(epoch FROM "video"."publishedAt") - 1446156582) / 47000) ' // base score (in number of half-days)

    if (trendingAlgorithm === 'best' && user) {
      this.joins.push(
        'LEFT JOIN "userVideoHistory" ON "video"."id" = "userVideoHistory"."videoId" AND "userVideoHistory"."userId" = :bestUser'
      )
      this.replacements.bestUser = user.id

      attribute += `+ POWER(COUNT(DISTINCT "userVideoHistory"."id"), 2.0) * ${weights.history} `
    }

    attribute += 'AS "score"'
    this.attributes.push(attribute)

    this.group = 'GROUP BY "video"."id"'
  }

  private setSort (sort: string) {
    if (sort === '-originallyPublishedAt' || sort === 'originallyPublishedAt') {
      this.attributes.push('COALESCE("video"."originallyPublishedAt", "video"."publishedAt") AS "publishedAtForOrder"')
    }

    this.sort = this.buildOrder(sort)
  }

  private buildOrder (value: string) {
    const { direction, field } = buildDirectionAndField(value)
    if (field.match(/^[a-zA-Z."]+$/) === null) throw new Error('Invalid sort column ' + field)

    if (field.toLowerCase() === 'random') return 'ORDER BY RANDOM()'

    if ([ 'trending', 'hot', 'best' ].includes(field.toLowerCase())) { // Sort by aggregation
      return `ORDER BY "score" ${direction}, "video"."views" ${direction}`
    }

    let firstSort: string

    if (field.toLowerCase() === 'match') { // Search
      firstSort = '"similarity"'
    } else if (field === 'originallyPublishedAt') {
      firstSort = '"publishedAtForOrder"'
    } else if (field.includes('.')) {
      firstSort = field
    } else {
      firstSort = `"video"."${field}"`
    }

    return `ORDER BY ${firstSort} ${direction}, "video"."id" ASC`
  }

  private setLimit (countArg: number) {
    const count = parseInt(countArg + '', 10)
    this.limit = `LIMIT ${count}`
  }

  private setOffset (startArg: number) {
    const start = parseInt(startArg + '', 10)
    this.offset = `OFFSET ${start}`
  }
}
