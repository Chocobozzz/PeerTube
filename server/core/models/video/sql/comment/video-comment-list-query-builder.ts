import { VideoChannelCollaboratorState, VideoPrivacy } from '@peertube/peertube-models'
import { AbstractListQuery, AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { buildSortDirectionAndField } from '@server/models/shared/sort.js'
import { getAccountJoin, getActorJoin, getAvatarsJSONJoin, getChannelJoin } from '@server/models/shared/sql/actor-helpers.js'
import { Sequelize } from 'sequelize'
import { createSafeIn } from '../../../shared/index.js'
import { VideoCommentTableAttributes } from './video-comment-table-attributes.js'

export interface ListVideoCommentsOptions extends AbstractListQueryOptions {
  selectType: 'api-list' | 'api-video' | 'feed' | 'comment-only'

  autoTagOfAccountId?: number

  videoId?: number
  threadId?: number
  accountId?: number

  // Filer on these comments
  commentIds?: number[]
  // Filter on comments that are in reply to these comments
  inReplyToCommentIds?: number[]

  // Select a truncated tree of the replies of a comment
  // First level is paginated using `start`/`count`
  // Deeper level only keeps the first `repliesPerLevel` replies of each of its parents
  replyTree?: {
    parentCommentId: number
    start: number
    count: number
    maxDepth: number
    repliesPerLevel: number
    maxComments: number
  }

  blockerAccountIds?: number[]

  isThread?: boolean
  notDeleted?: boolean

  isLocal?: boolean
  onLocalVideo?: boolean

  onPublicVideo?: boolean
  videoChannelOwnerId?: number
  videoAccountOwnerId?: number
  videoAccountOwnerIncludeCollaborations?: boolean

  heldForReview: boolean
  heldForReviewAccountIdException?: number

  autoTagOneOf?: string[]

  search?: string
  searchAccount?: string
  searchVideo?: string

  includeReplyCounters?: boolean

  // The reply tree keeps deleted comments as tombstones so their own children stay attached:
  // set this to also count them in `totalReplies`, or the count won't match what `replyTree`/`replies` actually return
  totalRepliesIncludeDeleted?: boolean
}

export class VideoCommentListQueryBuilder extends AbstractListQuery {
  private readonly tableAttributes = new VideoCommentTableAttributes()

  private builtAccountJoin = false
  private builtAccountActorJoin = false
  private builtVideoJoin = false
  private builtVideoChannelJoin = false
  private builtVideoChannelActorJoin = false
  private builtAccountAvatarJoin = false
  private builtChannelAvatarJoin = false
  private builtAutomaticTagsJoin = false

  constructor (
    protected readonly sequelize: Sequelize,
    protected readonly options: ListVideoCommentsOptions
  ) {
    super(sequelize, { modelName: 'VideoCommentModel', tableName: 'videoComment' }, options)

    if (this.options.includeReplyCounters && !this.options.videoId) {
      throw new Error('Cannot include reply counters without videoId')
    }

    if (this.options.replyTree && (this.options.start !== undefined || this.options.count !== undefined)) {
      throw new Error('Cannot use start/count with replyTree, it is paginated using replyTree.start/replyTree.count')
    }
  }

  // The reply tree needs a recursive CTE
  // PostgreSQL accepts non recursive CTE in a `WITH RECURSIVE`, so we can always use it as soon as one of our CTE is recursive
  protected buildCTE (cte: string[]) {
    if (cte.length === 0 || !this.options.replyTree) return super.buildCTE(cte)

    return `WITH RECURSIVE ${cte.join(', ')} `
  }
  // ---------------------------------------------------------------------------

  protected buildSubQueryWhere () {
    let where: string[] = []

    if (this.options.videoId) {
      this.replacements.videoId = this.options.videoId

      where.push('"VideoCommentModel"."videoId" = :videoId')
    }

    if (this.options.threadId) {
      this.replacements.threadId = this.options.threadId

      where.push('("VideoCommentModel"."id" = :threadId OR "VideoCommentModel"."originCommentId" = :threadId)')
    }

    if (this.options.commentIds) {
      where.push(`"VideoCommentModel"."id" IN (${createSafeIn(this.sequelize, this.options.commentIds)})`)
    }

    if (this.options.inReplyToCommentIds) {
      const idsString = createSafeIn(this.sequelize, this.options.inReplyToCommentIds)

      where.push(`"VideoCommentModel"."inReplyToCommentId" IN (${idsString})`)
    }

    if (this.options.replyTree) {
      this.buildReplyTreeCTE()
    }

    if (this.options.accountId) {
      this.replacements.accountId = this.options.accountId

      where.push('"VideoCommentModel"."accountId" = :accountId')
    }

    if (this.options.blockerAccountIds) {
      this.buildVideoChannelJoin()

      where = where.concat(this.getBlockWhere('VideoCommentModel', 'Video->VideoChannel'))
    }

    if (this.options.isThread === true) {
      where.push('"VideoCommentModel"."inReplyToCommentId" IS NULL')
    }

    if (this.options.notDeleted === true) {
      where.push('"VideoCommentModel"."deletedAt" IS NULL')
    }

    where = where.concat(this.getHeldForReviewWhere('VideoCommentModel'))

    if (this.options.autoTagOneOf) {
      const tags = this.options.autoTagOneOf.map(t => t.toLowerCase())
      this.buildAutomaticTagsJoin()

      where.push('lower("CommentAutomaticTags->AutomaticTag"."name") IN (' + createSafeIn(this.sequelize, tags) + ')')
    }

    if (this.options.isLocal === true) {
      this.buildAccountJoin()
      this.buildAccountActorJoin()

      where.push('"Account->Actor"."serverId" IS NULL')
    } else if (this.options.isLocal === false) {
      this.buildAccountJoin()
      this.buildAccountActorJoin()

      where.push('"Account->Actor"."serverId" IS NOT NULL')
    }

    if (this.options.onLocalVideo === true) {
      this.buildVideoJoin()

      where.push('"Video"."remote" IS FALSE')
    } else if (this.options.onLocalVideo === false) {
      this.buildVideoJoin()

      where.push('"Video"."remote" IS TRUE')
    }

    if (this.options.onPublicVideo === true) {
      this.buildVideoJoin()

      where.push(`"Video"."privacy" = ${VideoPrivacy.PUBLIC}`)
    }

    if (this.options.videoAccountOwnerId) {
      this.replacements.videoAccountOwnerId = this.options.videoAccountOwnerId

      if (this.options.videoAccountOwnerIncludeCollaborations !== true) {
        this.buildVideoChannelJoin()

        where.push(`"Video->VideoChannel"."accountId" = :videoAccountOwnerId`)
      } else {
        const base = 'SELECT "VideoCommentModel"."id"  FROM "videoComment" AS "VideoCommentModel" ' +
          this.getVideoJoin() +
          getChannelJoin({
            base: 'Video->',
            on: '"Video"."channelId"',
            includeAccount: false,
            includeAvatars: false,
            includeActors: false,
            required: true
          })

        this.subQueryCTE.push(
          '"candidates" AS (' +
            `${base} WHERE "Video->VideoChannel"."accountId" = :videoAccountOwnerId ` +
            `UNION ` +
            `${base} ` +
            'INNER JOIN "videoChannelCollaborator" "Video->VideoChannel->VideoChannelCollaborators" ' +
            'ON "Video->VideoChannel->VideoChannelCollaborators"."channelId" = "Video->VideoChannel"."id" ' +
            'AND "Video->VideoChannel->VideoChannelCollaborators"."state" = :channelCollaboratorState ' +
            'AND "Video->VideoChannel->VideoChannelCollaborators"."accountId" = :videoAccountOwnerId ' +
            ')'
        )

        this.replacements.videoAccountOwnerId = this.options.videoAccountOwnerId
        this.replacements.channelCollaboratorState = VideoChannelCollaboratorState.ACCEPTED

        this.subQueryJoin += ' INNER JOIN "candidates" ON "candidates"."id" = "VideoCommentModel"."id" '
      }
    }

    if (this.options.videoChannelOwnerId) {
      this.buildVideoChannelJoin()

      this.replacements.videoChannelOwnerId = this.options.videoChannelOwnerId

      where.push(`"Video->VideoChannel"."id" = :videoChannelOwnerId`)
    }

    if (this.options.search) {
      this.buildVideoJoin()
      this.buildAccountJoin()
      this.buildAccountActorJoin()

      const escapedLikeSearch = this.sequelize.escape('%' + this.options.search + '%')

      where.push(
        `(` +
          `"VideoCommentModel"."text" ILIKE ${escapedLikeSearch} OR ` +
          `"Account->Actor"."preferredUsername" ILIKE ${escapedLikeSearch} OR ` +
          `"Account"."name" ILIKE ${escapedLikeSearch} OR ` +
          `"Video"."name" ILIKE ${escapedLikeSearch} ` +
          `)`
      )
    }

    if (this.options.searchAccount) {
      this.buildAccountJoin()
      this.buildAccountActorJoin()

      const escapedLikeSearch = this.sequelize.escape('%' + this.options.searchAccount + '%')

      where.push(
        `(` +
          `"Account->Actor"."preferredUsername" ILIKE ${escapedLikeSearch} OR ` +
          `"Account"."name" ILIKE ${escapedLikeSearch} ` +
          `)`
      )
    }

    if (this.options.searchVideo) {
      this.buildVideoJoin()

      const escapedLikeSearch = this.sequelize.escape('%' + this.options.searchVideo + '%')

      where.push(`"Video"."name" ILIKE ${escapedLikeSearch}`)
    }

    if (where.length !== 0) {
      this.subQueryWhere = `WHERE ${where.join(' AND ')}`
    }
  }

  // ---------------------------------------------------------------------------

  private buildAccountJoin () {
    if (this.builtAccountJoin) return

    this.subQueryJoin += getAccountJoin({
      on: `"VideoCommentModel"."accountId"`,
      includeAvatars: false,
      includeActor: false,
      required: false
    })

    this.builtAccountJoin = true
  }

  private buildAccountActorJoin () {
    if (this.builtAccountActorJoin) return

    this.subQueryJoin += getActorJoin({
      base: 'Account->',
      on: `"Account"."id"`,
      type: 'account',
      includeAvatars: false,
      required: false
    })

    this.builtAccountActorJoin = true
  }

  private buildVideoJoin () {
    if (this.builtVideoJoin) return

    this.subQueryJoin += this.getVideoJoin()

    this.builtVideoJoin = true
  }

  private getVideoJoin () {
    return ' INNER JOIN "video" "Video" ON "Video"."id" = "VideoCommentModel"."videoId" '
  }

  private buildVideoChannelJoin () {
    if (this.builtVideoChannelJoin) return

    this.buildVideoJoin()

    this.subQueryJoin += getChannelJoin({
      base: 'Video->',
      on: '"Video"."channelId"',
      includeAccount: false,
      includeAvatars: false,
      includeActors: false,
      required: true
    })

    this.builtVideoChannelJoin = true
  }

  private buildVideoChannelActorJoin () {
    if (this.builtVideoChannelActorJoin) return

    this.subQueryJoin += getActorJoin({
      base: 'Video->VideoChannel->',
      on: '"Video->VideoChannel"."id"',
      type: 'channel',
      includeAvatars: false,
      required: true
    })

    this.builtVideoChannelActorJoin = true
  }

  private buildAutomaticTagsJoin () {
    if (this.builtAutomaticTagsJoin) return

    this.subQueryJoin += ' LEFT JOIN (' +
      '"commentAutomaticTag" AS "CommentAutomaticTags" INNER JOIN "automaticTag" AS "CommentAutomaticTags->AutomaticTag" ' +
      'ON "CommentAutomaticTags->AutomaticTag"."id" = "CommentAutomaticTags"."automaticTagId" ' +
      ') ON "VideoCommentModel"."id" = "CommentAutomaticTags"."commentId" AND "CommentAutomaticTags"."accountId" = :autoTagOfAccountId '

    this.replacements.autoTagOfAccountId = this.options.autoTagOfAccountId
    this.builtAutomaticTagsJoin = true
  }

  // ---------------------------------------------------------------------------

  private buildAccountAvatarsJoin () {
    if (this.builtAccountAvatarJoin) return

    this.join += getAvatarsJSONJoin({
      attributes: this.tableAttributes.getAvatarAttributesJSON(),
      base: 'Account->Actor->',
      on: '"VideoCommentModel"."Account.Actor.id"'
    })

    this.builtAccountAvatarJoin = true
  }

  private buildChannelAvatarsJoin () {
    if (this.builtChannelAvatarJoin) return

    this.join += getAvatarsJSONJoin({
      attributes: this.tableAttributes.getAvatarAttributesJSON(),
      base: 'Video->VideoChannel->Actor->',
      on: '"VideoCommentModel"."Video.VideoChannel.Actor.id"'
    })

    this.builtChannelAvatarJoin = true
  }

  // ---------------------------------------------------------------------------

  protected buildQueryJoin () {
    const selectType = this.options.selectType

    if (selectType === 'api-list' || selectType === 'api-video' || selectType === 'feed') {
      this.buildAccountAvatarsJoin()
    }

    if (selectType === 'api-list') {
      this.buildChannelAvatarsJoin()
    }
  }

  protected buildQueryAttributes () {
    const selectType = this.options.selectType

    if (selectType === 'api-list' || selectType === 'api-video' || selectType === 'feed') {
      this.attributes.push(this.tableAttributes.getAccountAvatarAttributes())
    }

    if (selectType === 'api-list') {
      this.attributes.push(this.tableAttributes.getChannelAvatarAttributes())
    }
  }

  protected buildSubQueryJoin () {
    const selectType = this.options.selectType

    if (selectType === 'api-list' || selectType === 'api-video' || selectType === 'feed') {
      this.buildAccountJoin()
      this.buildAccountActorJoin()
    }

    if (selectType === 'api-list') {
      this.buildVideoJoin()
      this.buildVideoChannelJoin()
      this.buildVideoChannelActorJoin()
    }

    if (this.options.autoTagOfAccountId && selectType === 'api-list') {
      this.buildAutomaticTagsJoin()
    }
  }

  protected buildSubQueryAttributes () {
    const selectType = this.options.selectType

    this.subQueryAttributes = [
      ...this.subQueryAttributes,

      this.tableAttributes.getVideoCommentAttributes()
    ]

    if (selectType === 'api-list' || selectType === 'api-video' || selectType === 'feed') {
      this.subQueryAttributes = [
        ...this.subQueryAttributes,

        this.tableAttributes.getVideoAttributes(),

        this.tableAttributes.getAccountAttributes(),
        this.tableAttributes.getAccountActorAttributes(),
        this.tableAttributes.getAccountServerAttributes()
      ]
    }

    if (selectType === 'api-list') {
      this.subQueryAttributes = [
        ...this.subQueryAttributes,

        this.tableAttributes.getChannelAttributes(),
        this.tableAttributes.getChannelActorAttributes(),
        this.tableAttributes.getChannelServerAttributes()
      ]
    }

    if (this.options.autoTagOfAccountId && this.options.selectType === 'api-list') {
      this.subQueryAttributes = [
        ...this.subQueryAttributes,

        this.tableAttributes.getCommentAutomaticTagAttributes(),
        this.tableAttributes.getAutomaticTagAttributes()
      ]
    }

    if (this.options.includeReplyCounters === true) {
      this.subQueryAttributes.push('"totalRepliesFromVideoAuthor"."count" AS "totalRepliesFromVideoAuthor"')
      this.subQueryAttributes.push('"totalReplies"."count" AS "totalReplies"')
    }
  }

  protected getCalculatedAttributes () {
    return [
      'totalRepliesFromVideoAuthor',
      'totalReplies'
    ]
  }

  // ---------------------------------------------------------------------------

  protected buildSubQueryLateralJoin () {
    if (this.options.includeReplyCounters === true) {
      this.buildTotalRepliesLateralJoin()
      this.buildAuthorTotalRepliesLateralJoin()
    }
  }

  private buildTotalRepliesLateralJoin () {
    const blockWhereString = this.getBlockWhere('replies', 'videoChannel').join(' AND ')

    // Help the planner by providing videoId that should filter out many comments
    this.replacements.videoId = this.options.videoId

    const deletedWhere = this.options.totalRepliesIncludeDeleted === true
      ? ''
      : 'AND "deletedAt" IS NULL '

    this.subQueryLateralJoin += `LEFT JOIN LATERAL (` +
      `SELECT COUNT("replies"."id") AS "count" FROM "videoComment" AS "replies" ` +
      `INNER JOIN "video" ON "video"."id" = "replies"."videoId" AND "replies"."videoId" = :videoId ` +
      `LEFT JOIN "videoChannel" ON "video"."channelId" = "videoChannel"."id" ` +
      `WHERE ("replies"."inReplyToCommentId" = "VideoCommentModel"."id" OR "replies"."originCommentId" = "VideoCommentModel"."id") ` +
      `${deletedWhere}` +
      `AND ${blockWhereString} ` +
      `) "totalReplies" ON TRUE `
  }

  private buildAuthorTotalRepliesLateralJoin () {
    // Help the planner by providing videoId that should filter out many comments
    this.replacements.videoId = this.options.videoId

    this.subQueryLateralJoin += `LEFT JOIN LATERAL (` +
      `SELECT COUNT("replies"."id") AS "count" FROM "videoComment" AS "replies" ` +
      `INNER JOIN "video" ON "video"."id" = "replies"."videoId" AND "replies"."videoId" = :videoId ` +
      `INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ` +
      `WHERE ("replies"."inReplyToCommentId" = "VideoCommentModel"."id" OR "replies"."originCommentId" = "VideoCommentModel"."id") ` +
      `AND "replies"."accountId" = "videoChannel"."accountId"` +
      `) "totalRepliesFromVideoAuthor" ON TRUE `
  }

  // ---------------------------------------------------------------------------

  private getHeldForReviewWhere (commentTableName: string) {
    if (this.options.heldForReview === true) {
      return [ `"${commentTableName}"."heldForReview" IS TRUE` ]
    }

    if (this.options.heldForReview === false) {
      const base = `"${commentTableName}"."heldForReview" IS FALSE`

      if (this.options.heldForReviewAccountIdException) {
        this.replacements.heldForReviewAccountIdException = this.options.heldForReviewAccountIdException

        return [ `(${base} OR "${commentTableName}"."accountId" = :heldForReviewAccountIdException)` ]
      }

      return [ base ]
    }

    return []
  }

  // Walk down the replies of a comment, keeping only `repliesPerLevel` of each parent
  // The LATERAL is applied on every iteration, so cutting a comment also cuts its own descendants
  private buildReplyTreeCTE () {
    const { parentCommentId, start, count, maxDepth, repliesPerLevel, maxComments } = this.options.replyTree

    Object.assign(this.replacements, {
      treeParentCommentId: parentCommentId,
      treeStart: start,
      treeCount: count,
      treeMaxDepth: maxDepth,
      treeRepliesPerLevel: repliesPerLevel,
      treeMaxComments: maxComments
    })

    const buildWhere = (on: string) => {
      const where = [ `"replyTree"."inReplyToCommentId" = ${on}`, ...this.getHeldForReviewWhere('replyTree') ]

      if (this.options.videoId) where.push('"replyTree"."videoId" = :videoId')

      return where.join(' AND ')
    }

    // The first level is the one the client paginates with start/count, so it must match the
    // sort order the outer query uses, and blocklists must be applied before LIMIT/OFFSET
    // or pagination would duplicate/skip replies
    const direction = this.options.sort
      ? buildSortDirectionAndField(this.options.sort).direction
      : 'ASC'

    const order = `ORDER BY "replyTree"."createdAt" ${direction}, "replyTree"."id" ASC`

    const firstLevelJoin = this.options.blockerAccountIds
      ? 'INNER JOIN "video" AS "replyTreeVideo" ON "replyTreeVideo"."id" = "replyTree"."videoId" ' +
        'INNER JOIN "videoChannel" AS "replyTreeChannel" ON "replyTreeChannel"."id" = "replyTreeVideo"."channelId" '
      : ''

    const firstLevelWhere = this.options.blockerAccountIds
      ? [ buildWhere(':treeParentCommentId'), ...this.getBlockWhere('replyTree', 'replyTreeChannel') ].join(' AND ')
      : buildWhere(':treeParentCommentId')

    this.subQueryCTE.push(
      '"replyTreeAll" AS (' +
        // The first level is the one the client paginates through
        `SELECT * FROM (` +
        `  SELECT "replyTree"."id", 0 AS "treeDepth" FROM "videoComment" AS "replyTree" ` +
        `  ${firstLevelJoin}` +
        `  WHERE ${firstLevelWhere} ${order} LIMIT :treeCount OFFSET :treeStart` +
        `) AS "replyTreeFirstLevel" ` +
        `UNION ALL ` +
        // Recursive query
        // Blocklists are not taken into account here to keep the query cheap
        // We accept a blocked comment may consume a slot and slightly reduce the number of replies of a parent
        `SELECT "replyTreeChild"."id", "replyTreeAll"."treeDepth" + 1 ` +
        `FROM "replyTreeAll", LATERAL (` +
        `  SELECT "replyTree"."id" FROM "videoComment" AS "replyTree" ` +
        `  WHERE ${buildWhere('"replyTreeAll"."id"')} ${order} LIMIT :treeRepliesPerLevel` +
        `) AS "replyTreeChild" ` +
        `WHERE "replyTreeAll"."treeDepth" + 1 < :treeMaxDepth` +
        ')',
      // Never send back more comments than this
      // Truncating the deepest levels first keeps the tree readable
      // The client can still unfold what we dropped with other HTTP requests
      '"replyTree" AS (SELECT "id" FROM "replyTreeAll" LIMIT :treeMaxComments)'
    )

    this.subQueryJoin += ' INNER JOIN "replyTree" ON "replyTree"."id" = "VideoCommentModel"."id" '
  }

  private getBlockWhere (commentTableName: string, channelTableName: string) {
    const where: string[] = []

    const blockerIdsString = createSafeIn(
      this.sequelize,
      this.options.blockerAccountIds,
      [ `"${channelTableName}"."accountId"` ]
    )

    where.push(
      `NOT EXISTS (` +
        `SELECT 1 FROM "accountBlocklist" ` +
        `WHERE "targetAccountId" = "${commentTableName}"."accountId" ` +
        `AND "accountId" IN (${blockerIdsString})` +
        `)`
    )

    where.push(
      `NOT EXISTS (` +
        `SELECT 1 FROM "account" ` +
        `INNER JOIN "actor" ON account."id" = actor."accountId" ` +
        `INNER JOIN "serverBlocklist" ON "actor"."serverId" = "serverBlocklist"."targetServerId" ` +
        `WHERE "account"."id" = "${commentTableName}"."accountId" ` +
        `AND "serverBlocklist"."accountId" IN (${blockerIdsString})` +
        `)`
    )

    return where
  }
}
