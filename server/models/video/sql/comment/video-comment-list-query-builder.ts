import { Model, Sequelize, Transaction } from 'sequelize'
import { AbstractRunQuery, ModelBuilder } from '@server/models/shared'
import { createSafeIn, getCommentSort, parseRowCountResult } from '@server/models/utils'
import { ActorImageType, VideoPrivacy } from '@shared/models'
import { VideoCommentTableAttributes } from './video-comment-table-attributes'

export interface ListVideoCommentsOptions {
  selectType: 'api' | 'feed' | 'comment-only'

  start?: number
  count?: number
  sort?: string

  videoId?: number
  threadId?: number
  accountId?: number
  videoChannelId?: number

  blockerAccountIds?: number[]

  isThread?: boolean
  notDeleted?: boolean
  isLocal?: boolean
  onLocalVideo?: boolean
  onPublicVideo?: boolean
  videoAccountOwnerId?: boolean

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
  private innerWhere = ''

  private readonly built = {
    cte: false,
    accountJoin: false,
    videoJoin: false,
    videoChannelJoin: false,
    avatarJoin: false
  }

  constructor (
    protected readonly sequelize: Sequelize,
    private readonly options: ListVideoCommentsOptions
  ) {
    super(sequelize)
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
      `${this.getOrder()} ` +
      `${this.getLimit()}`
  }

  private buildInnerListQuery () {
    this.buildWhere()
    this.buildInnerListSelect()

    this.innerQuery = `${this.innerSelect} ` +
      `FROM "videoComment" AS "VideoCommentModel" ` +
      `${this.innerJoins} ` +
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

    if (this.options.videoChannelId) {
      this.buildVideoChannelJoin()

      this.replacements.videoChannelId = this.options.videoChannelId

      where.push('"Account->VideoChannel"."id" = :videoChannelId')
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
    if (this.options.selectType !== 'api' && this.options.selectType !== 'feed') return ''
    if (this.built.avatarJoin) return

    this.joins += `LEFT JOIN "actorImage" "Account->Actor->Avatars" ` +
      `ON "VideoCommentModel"."Account.Actor.id" = "Account->Actor->Avatars"."actorId" ` +
        `AND "Account->Actor->Avatars"."type" = ${ActorImageType.AVATAR}`

    this.built.avatarJoin = true
  }

  // ---------------------------------------------------------------------------

  private buildListSelect () {
    const toSelect = [ '"VideoCommentModel".*' ]

    if (this.options.selectType === 'api' || this.options.selectType === 'feed') {
      this.buildAvatarsJoin()

      toSelect.push(this.tableAttributes.getAvatarAttributes())
    }

    if (this.options.includeReplyCounters === true) {
      toSelect.push(this.getTotalRepliesSelect())
      toSelect.push(this.getAuthorTotalRepliesSelect())
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

  private getTotalRepliesSelect () {
    const blockWhereString = this.getBlockWhere('replies', 'videoChannel').join(' AND ')

    return `(` +
      `SELECT COUNT("replies"."id") FROM "videoComment" AS "replies" ` +
      `LEFT JOIN "video" ON "video"."id" = "replies"."videoId" ` +
      `LEFT JOIN "videoChannel" ON "video"."channelId" = "videoChannel"."id" ` +
      `WHERE "replies"."originCommentId" = "VideoCommentModel"."id" ` +
        `AND "deletedAt" IS NULL ` +
        `AND ${blockWhereString} ` +
    `) AS "totalReplies"`
  }

  private getAuthorTotalRepliesSelect () {
    return `(` +
      `SELECT COUNT("replies"."id") FROM "videoComment" AS "replies" ` +
      `INNER JOIN "video" ON "video"."id" = "replies"."videoId" ` +
      `INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ` +
      `WHERE "replies"."originCommentId" = "VideoCommentModel"."id" AND "replies"."accountId" = "videoChannel"."accountId"` +
    `) AS "totalRepliesFromVideoAuthor"`
  }

  private getOrder () {
    if (!this.options.sort) return ''

    const orders = getCommentSort(this.options.sort)

    return 'ORDER BY ' + orders.map(o => `"${o[0]}" ${o[1]}`).join(', ')
  }

  private getLimit () {
    if (!this.options.count) return ''

    this.replacements.limit = this.options.count

    return `LIMIT :limit `
  }

  private getInnerLimit () {
    if (!this.options.count) return ''

    this.replacements.limit = this.options.count
    this.replacements.offset = this.options.start || 0

    return `LIMIT :limit OFFSET :offset `
  }
}
