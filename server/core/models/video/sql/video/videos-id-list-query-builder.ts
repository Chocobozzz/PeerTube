import { Sequelize, Transaction } from 'sequelize'
import validator from 'validator'
import { forceNumber } from '@peertube/peertube-core-utils'
import { VideoInclude, VideoIncludeType, VideoPrivacy, VideoPrivacyType, VideoState } from '@peertube/peertube-models'
import { exists } from '@server/helpers/custom-validators/misc.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { buildSortDirectionAndField } from '@server/models/shared/index.js'
import { MUserAccountId, MUserId } from '@server/types/models/index.js'
import { AbstractRunQuery } from '../../../shared/abstract-run-query.js'
import { createSafeIn, parseRowCountResult } from '../../../shared/index.js'

/**
 *
 * Build videos list SQL query to fetch rows
 *
 */

export type DisplayOnlyForFollowerOptions = {
  actorId: number
  orLocalVideos: boolean
}

export type BuildVideosListQueryOptions = {
  attributes?: string[]

  serverAccountIdForBlock: number

  displayOnlyForFollower: DisplayOnlyForFollowerOptions

  count: number
  start: number
  sort: string

  nsfw?: boolean
  host?: string
  isLive?: boolean
  isLocal?: boolean
  include?: VideoIncludeType

  categoryOneOf?: number[]
  licenceOneOf?: number[]
  languageOneOf?: string[]

  tagsOneOf?: string[]
  tagsAllOf?: string[]

  privacyOneOf?: VideoPrivacyType[]

  autoTagOneOf?: string[]

  uuids?: string[]

  hasFiles?: boolean
  hasHLSFiles?: boolean

  hasWebVideoFiles?: boolean
  hasWebtorrentFiles?: boolean // TODO: Remove in v7

  accountId?: number
  videoChannelId?: number

  videoPlaylistId?: number

  trendingAlgorithm?: string // best, hot, or any other algorithm implemented
  trendingDays?: number

  // Used to include user history information, exclude blocked videos, include internal videos, adapt hot algorithm...
  user?: MUserAccountId

  // Only list videos watched by this user
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

  transaction?: Transaction
  logging?: boolean

  excludeAlreadyWatched?: boolean
}

export class VideosIdListQueryBuilder extends AbstractRunQuery {
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
    super(sequelize)
  }

  queryVideoIds (options: BuildVideosListQueryOptions) {
    this.buildIdsListQuery(options)

    return this.runQuery()
  }

  countVideoIds (countOptions: BuildVideosListQueryOptions): Promise<number> {
    this.buildIdsListQuery(countOptions)

    return this.runQuery().then(rows => parseRowCountResult(rows))
  }

  getQuery (options: BuildVideosListQueryOptions) {
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

    if (!(options.include & VideoInclude.BLACKLISTED)) {
      this.whereNotBlacklisted()
    }

    if (options.serverAccountIdForBlock && !(options.include & VideoInclude.BLOCKED_OWNER)) {
      this.whereNotBlocked(options.serverAccountIdForBlock, options.user)
    }

    // Only list published videos
    if (!(options.include & VideoInclude.NOT_PUBLISHED_STATE)) {
      this.whereStateAvailable()
    }

    if (options.videoPlaylistId) {
      this.joinPlaylist(options.videoPlaylistId)
    }

    if (exists(options.isLocal)) {
      this.whereLocal(options.isLocal)
    }

    if (options.host) {
      this.whereHost(options.host)
    }

    if (options.accountId) {
      this.whereAccountId(options.accountId)
    }

    if (options.videoChannelId) {
      this.whereChannelId(options.videoChannelId)
    }

    if (options.displayOnlyForFollower) {
      this.whereFollowerActorId(options.displayOnlyForFollower)
    }

    if (options.hasFiles === true) {
      this.whereFileExists()
    }

    if (exists(options.hasWebtorrentFiles)) {
      this.whereWebVideoFileExists(options.hasWebtorrentFiles)
    } else if (exists(options.hasWebVideoFiles)) {
      this.whereWebVideoFileExists(options.hasWebVideoFiles)
    }

    if (exists(options.hasHLSFiles)) {
      this.whereHLSFileExists(options.hasHLSFiles)
    }

    if (options.tagsOneOf) {
      this.whereTagsOneOf(options.tagsOneOf)
    }

    if (options.tagsAllOf) {
      this.whereTagsAllOf(options.tagsAllOf)
    }

    if (options.autoTagOneOf) {
      this.whereAutoTagOneOf(options.autoTagOneOf)
    }

    if (options.privacyOneOf) {
      this.wherePrivacyOneOf(options.privacyOneOf)
    } else {
      // Only list videos with the appropriate privacy
      this.wherePrivacyAvailable(options.user)
    }

    if (options.uuids) {
      this.whereUUIDs(options.uuids)
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

    if (options.excludeAlreadyWatched) {
      if (exists(options.user.id)) {
        this.whereExcludeAlreadyWatched(options.user.id)
      } else {
        throw new Error('Cannot use excludeAlreadyWatched parameter when auth token is not provided')
      }
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

  private whereStateAvailable () {
    this.and.push(
      `("video"."state" = ${VideoState.PUBLISHED} OR ` +
      `("video"."state" = ${VideoState.TO_TRANSCODE} AND "video"."waitTranscoding" IS false))`
    )
  }

  private wherePrivacyAvailable (user?: MUserAccountId) {
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

  private whereLocal (isLocal: boolean) {
    const isRemote = isLocal ? 'FALSE' : 'TRUE'

    this.and.push('"video"."remote" IS ' + isRemote)
  }

  private whereHost (host: string) {
    // Local instance
    if (host === WEBSERVER.HOST) {
      this.and.push('"accountActor"."serverId" IS NULL')
      return
    }

    this.joins.push('INNER JOIN "server" ON "server"."id" = "accountActor"."serverId"')

    this.and.push('"server"."host" = :host')
    this.replacements.host = host
  }

  private whereAccountId (accountId: number) {
    this.and.push('"account"."id" = :accountId')
    this.replacements.accountId = accountId
  }

  private whereChannelId (channelId: number) {
    this.and.push('"videoChannel"."id" = :videoChannelId')
    this.replacements.videoChannelId = channelId
  }

  private whereFollowerActorId (options: { actorId: number, orLocalVideos: boolean }) {
    let query =
    '(' +
    '  EXISTS (' + // Videos shared by actors we follow
    '    SELECT 1 FROM "videoShare" ' +
    '    INNER JOIN "actorFollow" "actorFollowShare" ON "actorFollowShare"."targetActorId" = "videoShare"."actorId" ' +
    '    AND "actorFollowShare"."actorId" = :followerActorId AND "actorFollowShare"."state" = \'accepted\' ' +
    '    WHERE "videoShare"."videoId" = "video"."id"' +
    '  )' +
    '  OR' +
    '  EXISTS (' + // Videos published by channels or accounts we follow
    '    SELECT 1 from "actorFollow" ' +
    '    WHERE ("actorFollow"."targetActorId" = "account"."actorId" OR "actorFollow"."targetActorId" = "videoChannel"."actorId") ' +
    '    AND "actorFollow"."actorId" = :followerActorId ' +
    '    AND "actorFollow"."state" = \'accepted\'' +
    '  )'

    if (options.orLocalVideos) {
      query += '  OR "video"."remote" IS FALSE'
    }

    query += ')'

    this.and.push(query)
    this.replacements.followerActorId = options.actorId
  }

  private whereFileExists () {
    this.and.push(`(${this.buildWebVideoFileExistsQuery(true)} OR ${this.buildHLSFileExistsQuery(true)})`)
  }

  private whereWebVideoFileExists (exists: boolean) {
    this.and.push(this.buildWebVideoFileExistsQuery(exists))
  }

  private whereHLSFileExists (exists: boolean) {
    this.and.push(this.buildHLSFileExistsQuery(exists))
  }

  private buildWebVideoFileExistsQuery (exists: boolean) {
    const prefix = exists ? '' : 'NOT '

    return prefix + 'EXISTS (SELECT 1 FROM "videoFile" WHERE "videoFile"."videoId" = "video"."id")'
  }

  private buildHLSFileExistsQuery (exists: boolean) {
    const prefix = exists ? '' : 'NOT '

    return prefix + 'EXISTS (' +
    '  SELECT 1 FROM "videoStreamingPlaylist" ' +
    '  INNER JOIN "videoFile" ON "videoFile"."videoStreamingPlaylistId" = "videoStreamingPlaylist"."id" ' +
    '  WHERE "videoStreamingPlaylist"."videoId" = "video"."id"' +
    ')'
  }

  private whereTagsOneOf (tagsOneOf: string[]) {
    const tagsOneOfLower = tagsOneOf.map(t => t.toLowerCase())

    this.cte.push(
      '"tagsOneOf" AS (' +
      '  SELECT "videoTag"."videoId" AS "videoId" FROM "videoTag" ' +
      '  INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
      '  WHERE lower("tag"."name") IN (' + createSafeIn(this.sequelize, tagsOneOfLower) + ') ' +
      ')'
    )

    this.joins.push('INNER JOIN "tagsOneOf" ON "video"."id" = "tagsOneOf"."videoId"')
  }

  private whereAutoTagOneOf (autoTagOneOf: string[]) {
    const tags = autoTagOneOf.map(t => t.toLowerCase())

    this.cte.push(
      '"autoTagsOneOf" AS (' +
      '  SELECT "videoAutomaticTag"."videoId" AS "videoId" FROM "videoAutomaticTag" ' +
      '  INNER JOIN "automaticTag" ON "automaticTag"."id" = "videoAutomaticTag"."automaticTagId" ' +
      '  WHERE lower("automaticTag"."name") IN (' + createSafeIn(this.sequelize, tags) + ') ' +
      ')'
    )

    this.joins.push('INNER JOIN "autoTagsOneOf" ON "video"."id" = "autoTagsOneOf"."videoId"')
  }

  private whereTagsAllOf (tagsAllOf: string[]) {
    const tagsAllOfLower = tagsAllOf.map(t => t.toLowerCase())

    this.cte.push(
      '"tagsAllOf" AS (' +
      '  SELECT "videoTag"."videoId" AS "videoId" FROM "videoTag" ' +
      '  INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
      '  WHERE lower("tag"."name") IN (' + createSafeIn(this.sequelize, tagsAllOfLower) + ') ' +
      '  GROUP BY "videoTag"."videoId" HAVING COUNT(*) = ' + tagsAllOfLower.length +
      ')'
    )

    this.joins.push('INNER JOIN "tagsAllOf" ON "video"."id" = "tagsAllOf"."videoId"')
  }

  private wherePrivacyOneOf (privacyOneOf: VideoPrivacyType[]) {
    this.and.push('"video"."privacy" IN (:privacyOneOf)')
    this.replacements.privacyOneOf = privacyOneOf
  }

  private whereUUIDs (uuids: string[]) {
    this.and.push('"video"."uuid" IN (' + createSafeIn(this.sequelize, uuids) + ')')
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
    `    WHERE lower("tag"."name") = lower(${escapedSearch}) ` +
    '    AND "video"."id" = "videoTag"."videoId"' +
    '  )'

    if (validator.default.isUUID(search)) {
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

  private whereExcludeAlreadyWatched (userId: number) {
    this.and.push(
      'NOT EXISTS (' +
      '  SELECT 1' +
      '  FROM "userVideoHistory"' +
      '  WHERE "video"."id" = "userVideoHistory"."videoId"' +
      '  AND "userVideoHistory"."userId" = :excludeAlreadyWatchedUserId' +
      ')'
    )
    this.replacements.excludeAlreadyWatchedUserId = userId
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

    if (sort === '-localVideoFilesSize' || sort === 'localVideoFilesSize') {
      this.attributes.push(
        '(' +
          'CASE ' +
            'WHEN "video"."remote" IS TRUE THEN 0 ' + // Consider remote videos with size of 0
            'ELSE (' +
              '(SELECT COALESCE(SUM(size), 0) FROM "videoFile" WHERE "videoFile"."videoId" = "video"."id")' +
              ' + ' +
              '(' +
                'SELECT COALESCE(SUM(size), 0) FROM "videoFile" ' +
                'INNER JOIN "videoStreamingPlaylist" ON "videoStreamingPlaylist"."id" = "videoFile"."videoStreamingPlaylistId" ' +
                'AND "videoStreamingPlaylist"."videoId" = "video"."id"' +
              ')' +
              ' + ' +
              '(' +
                'SELECT COALESCE(SUM(size), 0) FROM "videoSource" ' +
                'WHERE "videoSource"."videoId" = "video"."id" AND "videoSource"."storage" IS NOT NULL' +
              ')' +
            ') END' +
        ') AS "localVideoFilesSize"'
      )
    }

    this.sort = this.buildOrder(sort)
  }

  private buildOrder (value: string) {
    const { direction, field } = buildSortDirectionAndField(value)
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
    } else if (field === 'localVideoFilesSize') {
      firstSort = '"localVideoFilesSize"'
    } else if (field.includes('.')) {
      firstSort = field
    } else {
      firstSort = `"video"."${field}"`
    }

    return `ORDER BY ${firstSort} ${direction}, "video"."id" ASC`
  }

  private setLimit (countArg: number) {
    const count = forceNumber(countArg)
    this.limit = `LIMIT ${count}`
  }

  private setOffset (startArg: number) {
    const start = forceNumber(startArg)
    this.offset = `OFFSET ${start}`
  }
}
