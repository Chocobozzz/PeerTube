import { ActorImageType, VideoPrivacy } from '@peertube/peertube-models'
import { AbstractRunQuery, ModelBuilder } from '@server/models/shared/index.js'
import { Model, Sequelize, Transaction } from 'sequelize'
import { createSafeIn, getSort, parseRowCountResult } from '../../../shared/index.js'
import { VideoCommentTableAttributes } from './video-comment-table-attributes.js'

export interface ListVideoCommentsOptions {
  selectType: 'api' | 'feed' | 'comment-only'

  autoTagOfAccountId?: number

  start?: number
  count?: number
  sort?: string

  videoId?: number
  threadId?: number
  accountId?: number

  blockerAccountIds?: number[]

  isThread?: boolean
  notDeleted?: boolean

  isLocal?: boolean
  onLocalVideo?: boolean

  onPublicVideo?: boolean
  videoChannelOwnerId?: number
  videoAccountOwnerId?: number

  heldForReview: boolean
  heldForReviewAccountIdException?: number

  autoTagOneOf?: string[]

  search?: string
  searchAccount?: string
  searchVideo?: string

  includeReplyCounters?: boolean

  transaction?: Transaction
}

export class VideoCommentListQueryBuilder extends AbstractRunQuery {
  private readonly tableAttributes = new VideoCommentTableAttributes()

  private innerQuery: string

  private select = ''
  private joins = ''

  private innerSelect = ''
  private innerJoins = ''
  private innerLateralJoins = ''
  private innerWhere = ''

  private readonly built = {
    cte: false,
    accountJoin: false,
    videoJoin: false,
    videoChannelJoin: false,
    avatarJoin: false,
    automaticTagsJoin: false
  }

  constructor (
    protected readonly sequelize: Sequelize,
    private readonly options: ListVideoCommentsOptions
  ) {
    super(sequelize)

    if (this.options.includeReplyCounters && !this.options.videoId) {
      throw new Error('Cannot include reply counters without videoId')
    }
  }

  async listComments <T extends Model> () {
    this.buildListQuery()

    const results = await this.runQuery({ nest: true, transaction: this.options.transaction })
    const modelBuilder = new ModelBuilder<T>(this.sequelize)

    return modelBuilder.createModels(results, 'VideoComment')
  }

  async countComments () {
    this.buildCountQuery()

    const result = await this.runQuery({ transaction: this.options.transaction })

    return parseRowCountResult(result)
  }

  // ---------------------------------------------------------------------------

  private buildListQuery () {
    this.buildInnerListQuery()
    this.buildListSelect()

    this.query = `${this.select} ` +
      `FROM (${this.innerQuery}) AS "VideoCommentModel" ` +
      `${this.joins} ` +
      `${this.getOrder()}`
  }

  private buildInnerListQuery () {
    this.buildWhere()
    this.buildInnerListSelect()

    this.innerQuery = `${this.innerSelect} ` +
      `FROM "videoComment" AS "VideoCommentModel" ` +
      `${this.innerJoins} ` +
      `${this.innerLateralJoins} ` +
      `${this.innerWhere} ` +
      `${this.getOrder()} ` +
      `${this.getInnerLimit()}`
  }

  // ---------------------------------------------------------------------------

  private buildCountQuery () {
    this.buildWhere()

    this.query = `SELECT COUNT(*) AS "total" ` +
      `FROM "videoComment" AS "VideoCommentModel" ` +
      `${this.innerJoins} ` +
      `${this.innerWhere}`
  }

  // ---------------------------------------------------------------------------

  private buildWhere () {
    let where: string[] = []

    if (this.options.videoId) {
      this.replacements.videoId = this.options.videoId

      where.push('"VideoCommentModel"."videoId" = :videoId')
    }

    if (this.options.threadId) {
      this.replacements.threadId = this.options.threadId

      where.push('("VideoCommentModel"."id" = :threadId OR "VideoCommentModel"."originCommentId" = :threadId)')
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

    if (this.options.heldForReview === true) {
      where.push('"VideoCommentModel"."heldForReview" IS TRUE')
    } else if (this.options.heldForReview === false) {
      const base = '"VideoCommentModel"."heldForReview" IS FALSE'

      if (this.options.heldForReviewAccountIdException) {
        this.replacements.heldForReviewAccountIdException = this.options.heldForReviewAccountIdException

        where.push(`(${base} OR "VideoCommentModel"."accountId" = :heldForReviewAccountIdException)`)
      } else {
        where.push(base)
      }
    }

    if (this.options.autoTagOneOf) {
      const tags = this.options.autoTagOneOf.map(t => t.toLowerCase())
      this.buildAutomaticTagsJoin()

      where.push('lower("CommentAutomaticTags->AutomaticTag"."name") IN (' + createSafeIn(this.sequelize, tags) + ')')
    }

    if (this.options.isLocal === true) {
      this.buildAccountJoin()

      where.push('"Account->Actor"."serverId" IS NULL')
    } else if (this.options.isLocal === false) {
      this.buildAccountJoin()

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
      this.buildVideoChannelJoin()

      this.replacements.videoAccountOwnerId = this.options.videoAccountOwnerId

      where.push(`"Video->VideoChannel"."accountId" = :videoAccountOwnerId`)
    }

    if (this.options.videoChannelOwnerId) {
      this.buildVideoChannelJoin()

      this.replacements.videoChannelOwnerId = this.options.videoChannelOwnerId

      where.push(`"Video->VideoChannel"."id" = :videoChannelOwnerId`)
    }

    if (this.options.search) {
      this.buildVideoJoin()
      this.buildAccountJoin()

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
      this.innerWhere = `WHERE ${where.join(' AND ')}`
    }
  }

  private buildAccountJoin () {
    if (this.built.accountJoin) return

    this.innerJoins += ' LEFT JOIN "account" "Account" ON "Account"."id" = "VideoCommentModel"."accountId" ' +
      'LEFT JOIN "actor" "Account->Actor" ON "Account->Actor"."id" = "Account"."actorId" ' +
      'LEFT JOIN "server" "Account->Actor->Server" ON "Account->Actor"."serverId" = "Account->Actor->Server"."id" '

    this.built.accountJoin = true
  }

  private buildVideoJoin () {
    if (this.built.videoJoin) return

    this.innerJoins += ' LEFT JOIN "video" "Video" ON "Video"."id" = "VideoCommentModel"."videoId" '

    this.built.videoJoin = true
  }

  private buildVideoChannelJoin () {
    if (this.built.videoChannelJoin) return

    this.buildVideoJoin()

    this.innerJoins += ' LEFT JOIN "videoChannel" "Video->VideoChannel" ON "Video"."channelId" = "Video->VideoChannel"."id" '

    this.built.videoChannelJoin = true
  }

  private buildAvatarsJoin () {
    if (this.built.avatarJoin) return

    this.joins += `LEFT JOIN "actorImage" "Account->Actor->Avatars" ` +
      `ON "VideoCommentModel"."Account.Actor.id" = "Account->Actor->Avatars"."actorId" ` +
        `AND "Account->Actor->Avatars"."type" = ${ActorImageType.AVATAR}`

    this.built.avatarJoin = true
  }

  private buildAutomaticTagsJoin () {
    if (this.built.automaticTagsJoin) return

    this.innerJoins += 'LEFT JOIN (' +
      '"commentAutomaticTag" AS "CommentAutomaticTags" INNER JOIN "automaticTag" AS "CommentAutomaticTags->AutomaticTag" ' +
        'ON "CommentAutomaticTags->AutomaticTag"."id" = "CommentAutomaticTags"."automaticTagId" ' +
    ') ON "VideoCommentModel"."id" = "CommentAutomaticTags"."commentId" AND "CommentAutomaticTags"."accountId" = :autoTagOfAccountId'

    this.replacements.autoTagOfAccountId = this.options.autoTagOfAccountId
    this.built.automaticTagsJoin = true
  }

  // ---------------------------------------------------------------------------

  private buildListSelect () {
    const toSelect = [ '"VideoCommentModel".*' ]

    if (this.options.selectType === 'api' || this.options.selectType === 'feed') {
      this.buildAvatarsJoin()

      toSelect.push(this.tableAttributes.getAvatarAttributes())
    }

    this.select = this.buildSelect(toSelect)
  }

  private buildInnerListSelect () {
    let toSelect = [ this.tableAttributes.getVideoCommentAttributes() ]

    if (this.options.selectType === 'api' || this.options.selectType === 'feed') {
      this.buildAccountJoin()
      this.buildVideoJoin()

      toSelect = toSelect.concat([
        this.tableAttributes.getVideoAttributes(),
        this.tableAttributes.getAccountAttributes(),
        this.tableAttributes.getActorAttributes(),
        this.tableAttributes.getServerAttributes()
      ])
    }

    if (this.options.autoTagOfAccountId && this.options.selectType === 'api') {
      this.buildAutomaticTagsJoin()

      toSelect = toSelect.concat([
        this.tableAttributes.getCommentAutomaticTagAttributes(),
        this.tableAttributes.getAutomaticTagAttributes()
      ])
    }

    if (this.options.includeReplyCounters === true) {
      this.buildTotalRepliesSelect()
      this.buildAuthorTotalRepliesSelect()

      toSelect.push('"totalRepliesFromVideoAuthor"."count" AS "totalRepliesFromVideoAuthor"')
      toSelect.push('"totalReplies"."count" AS "totalReplies"')
    }

    this.innerSelect = this.buildSelect(toSelect)
  }

  // ---------------------------------------------------------------------------

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
        `INNER JOIN "actor" ON account."actorId" = actor.id ` +
        `INNER JOIN "serverBlocklist" ON "actor"."serverId" = "serverBlocklist"."targetServerId" ` +
        `WHERE "account"."id" = "${commentTableName}"."accountId" ` +
        `AND "serverBlocklist"."accountId" IN (${blockerIdsString})` +
      `)`
    )

    return where
  }

  // ---------------------------------------------------------------------------

  private buildTotalRepliesSelect () {
    const blockWhereString = this.getBlockWhere('replies', 'videoChannel').join(' AND ')

    // Help the planner by providing videoId that should filter out many comments
    this.replacements.videoId = this.options.videoId

    this.innerLateralJoins += `LEFT JOIN LATERAL (` +
      `SELECT COUNT("replies"."id") AS "count" FROM "videoComment" AS "replies" ` +
      `INNER JOIN "video" ON "video"."id" = "replies"."videoId" AND "replies"."videoId" = :videoId ` +
      `LEFT JOIN "videoChannel" ON "video"."channelId" = "videoChannel"."id" ` +
      `WHERE ("replies"."inReplyToCommentId" = "VideoCommentModel"."id" OR "replies"."originCommentId" = "VideoCommentModel"."id") ` +
        `AND "deletedAt" IS NULL ` +
        `AND ${blockWhereString} ` +
    `) "totalReplies" ON TRUE `
  }

  private buildAuthorTotalRepliesSelect () {
    // Help the planner by providing videoId that should filter out many comments
    this.replacements.videoId = this.options.videoId

    this.innerLateralJoins += `LEFT JOIN LATERAL (` +
      `SELECT COUNT("replies"."id") AS "count" FROM "videoComment" AS "replies" ` +
      `INNER JOIN "video" ON "video"."id" = "replies"."videoId" AND "replies"."videoId" = :videoId ` +
      `INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ` +
      `WHERE ("replies"."inReplyToCommentId" = "VideoCommentModel"."id" OR "replies"."originCommentId" = "VideoCommentModel"."id") ` +
        `AND "replies"."accountId" = "videoChannel"."accountId"` +
    `) "totalRepliesFromVideoAuthor" ON TRUE `
  }

  private getOrder () {
    if (!this.options.sort) return ''

    const orders = getSort(this.options.sort)

    return 'ORDER BY ' + orders.map(o => `"${o[0]}" ${o[1]}`).join(', ')
  }

  private getInnerLimit () {
    if (!this.options.count) return ''

    this.replacements.limit = this.options.count
    this.replacements.offset = this.options.start || 0

    return `LIMIT :limit OFFSET :offset `
  }
}
