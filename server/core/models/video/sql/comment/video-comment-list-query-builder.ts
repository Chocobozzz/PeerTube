import { VideoChannelCollaboratorState, VideoPrivacy } from '@peertube/peertube-models'
import { AbstractListQuery, AbstractListQueryOptions } from '@server/models/shared/abstract-list-query.js'
import { getAccountJoin, getActorJoin, getAvatarsJoin, getChannelJoin } from '@server/models/shared/sql/actor-helpers.js'
import { Sequelize } from 'sequelize'
import { createSafeIn } from '../../../shared/index.js'
import { VideoCommentTableAttributes } from './video-comment-table-attributes.js'

export interface ListVideoCommentsOptions extends AbstractListQueryOptions {
  selectType: 'api-list' | 'api-video' | 'feed' | 'comment-only'

  autoTagOfAccountId?: number

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
  videoAccountOwnerIncludeCollaborations?: boolean

  heldForReview: boolean
  heldForReviewAccountIdException?: number

  autoTagOneOf?: string[]

  search?: string
  searchAccount?: string
  searchVideo?: string

  includeReplyCounters?: boolean
}

export class VideoCommentListQueryBuilder extends AbstractListQuery {
  private readonly tableAttributes = new VideoCommentTableAttributes()

  private builtAccountJoin = false
  private builtAccountActorJoin = false
  private builtVideoJoin = false
  private builtVideoChannelJoin = false
  private builtVideoChannelActorJoin = false
  private builtVideoChannelCollaboratorsJoin = false
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
      this.buildVideoChannelJoin()

      this.replacements.videoAccountOwnerId = this.options.videoAccountOwnerId

      if (this.options.videoAccountOwnerIncludeCollaborations !== true) {
        where.push(`"Video->VideoChannel"."accountId" = :videoAccountOwnerId`)
      } else {
        this.buildVideoChannelCollaboratorsJoin()

        where.push(
          `(` +
            `"Video->VideoChannel"."accountId" = :videoAccountOwnerId OR ` +
            `"Video->VideoChannel->VideoChannelCollaborators"."accountId" = :videoAccountOwnerId` +
            `)`
        )
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

    this.subQueryJoin += ' INNER JOIN "video" "Video" ON "Video"."id" = "VideoCommentModel"."videoId" '

    this.builtVideoJoin = true
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

  private buildVideoChannelCollaboratorsJoin () {
    if (this.builtVideoChannelCollaboratorsJoin) return

    this.buildVideoChannelJoin()

    this.subQueryJoin += ' LEFT JOIN "videoChannelCollaborator" "Video->VideoChannel->VideoChannelCollaborators" ' +
      'ON "Video->VideoChannel->VideoChannelCollaborators"."channelId" = "Video->VideoChannel"."id" ' +
      'AND "Video->VideoChannel->VideoChannelCollaborators"."state" = :channelCollaboratorState ' +
      // Ensure we join with max 1 collaborator to not duplicate rows
      'AND "Video->VideoChannel->VideoChannelCollaborators"."accountId" = :videoAccountOwnerId '

    this.replacements.videoAccountOwnerId = this.options.videoAccountOwnerId
    this.replacements.channelCollaboratorState = VideoChannelCollaboratorState.ACCEPTED

    this.builtVideoChannelCollaboratorsJoin = true
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

    this.join += getAvatarsJoin({
      base: 'Account->Actor->',
      on: '"VideoCommentModel"."Account.Actor.id"'
    })

    this.builtAccountAvatarJoin = true
  }

  private buildChannelAvatarsJoin () {
    if (this.builtChannelAvatarJoin) return

    this.join += getAvatarsJoin({
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

    this.subQueryLateralJoin += `LEFT JOIN LATERAL (` +
      `SELECT COUNT("replies"."id") AS "count" FROM "videoComment" AS "replies" ` +
      `INNER JOIN "video" ON "video"."id" = "replies"."videoId" AND "replies"."videoId" = :videoId ` +
      `LEFT JOIN "videoChannel" ON "video"."channelId" = "videoChannel"."id" ` +
      `WHERE ("replies"."inReplyToCommentId" = "VideoCommentModel"."id" OR "replies"."originCommentId" = "VideoCommentModel"."id") ` +
      `AND "deletedAt" IS NULL ` +
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
