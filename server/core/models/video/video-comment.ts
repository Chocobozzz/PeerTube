import { pick } from '@peertube/peertube-core-utils'
import {
  ActivityTagObject,
  ActivityTombstoneObject,
  UserRight,
  VideoComment,
  VideoCommentForAdminOrUser,
  VideoCommentObject
} from '@peertube/peertube-models'
import { extractMentions } from '@server/helpers/mentions.js'
import { getLocalApproveReplyActivityPubUrl } from '@server/lib/activitypub/url.js'
import { getServerActor } from '@server/models/application/application.js'
import { MAccount, MAccountId, MUserAccountId } from '@server/types/models/index.js'
import { Op, Order, QueryTypes, Sequelize, Transaction } from 'sequelize'
import {
  AllowNull,
  BelongsTo, Column,
  CreatedAt,
  DataType,
  ForeignKey,
  HasMany,
  Is, Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc.js'
import { CONSTRAINTS_FIELDS, USER_EXPORT_MAX_ITEMS } from '../../initializers/constants.js'
import {
  MComment,
  MCommentAP,
  MCommentAdminOrUserFormattable,
  MCommentExport,
  MCommentFormattable,
  MCommentId,
  MCommentOwner,
  MCommentOwnerReplyVideoImmutable, MCommentOwnerVideoFeed,
  MCommentOwnerVideoReply,
  MVideo,
  MVideoImmutable
} from '../../types/models/video/index.js'
import { VideoCommentAbuseModel } from '../abuse/video-comment-abuse.js'
import { AccountModel } from '../account/account.js'
import { ActorModel } from '../actor/actor.js'
import { CommentAutomaticTagModel } from '../automatic-tag/comment-automatic-tag.js'
import { SequelizeModel, buildLocalAccountIdsIn, buildSQLAttributes, throwIfNotValid } from '../shared/index.js'
import { ListVideoCommentsOptions, VideoCommentListQueryBuilder } from './sql/comment/video-comment-list-query-builder.js'
import { VideoChannelModel } from './video-channel.js'
import { VideoModel } from './video.js'

export enum ScopeNames {
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_IN_REPLY_TO = 'WITH_IN_REPLY_TO',
  WITH_VIDEO = 'WITH_VIDEO'
}

@Scopes(() => ({
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: AccountModel
      }
    ]
  },
  [ScopeNames.WITH_IN_REPLY_TO]: {
    include: [
      {
        model: VideoCommentModel,
        as: 'InReplyToVideoComment'
      }
    ]
  },
  [ScopeNames.WITH_VIDEO]: {
    include: [
      {
        model: VideoModel,
        required: true,
        include: [
          {
            model: VideoChannelModel.unscoped(),
            attributes: [ 'id', 'accountId' ],
            required: true,
            include: [
              {
                attributes: [ 'id', 'url' ],
                model: ActorModel.unscoped(),
                required: true
              },
              {
                attributes: [ 'id' ],
                model: AccountModel.unscoped(),
                required: true,
                include: [
                  {
                    attributes: [ 'id', 'url' ],
                    model: ActorModel.unscoped(),
                    required: true
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}))
@Table({
  tableName: 'videoComment',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'videoId', 'originCommentId' ]
    },
    {
      fields: [ 'url' ],
      unique: true
    },
    {
      fields: [ 'accountId' ]
    },
    {
      fields: [
        { name: 'createdAt', order: 'DESC' }
      ]
    }
  ]
})
export class VideoCommentModel extends SequelizeModel<VideoCommentModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(true)
  @Column(DataType.DATE)
  deletedAt: Date

  @AllowNull(false)
  @Is('VideoCommentUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS.URL.max))
  url: string

  @AllowNull(false)
  @Column(DataType.TEXT)
  text: string

  @AllowNull(false)
  @Column
  heldForReview: boolean

  @AllowNull(true)
  @Column
  replyApproval: string

  @ForeignKey(() => VideoCommentModel)
  @Column
  originCommentId: number

  @BelongsTo(() => VideoCommentModel, {
    foreignKey: {
      name: 'originCommentId',
      allowNull: true
    },
    as: 'OriginVideoComment',
    onDelete: 'CASCADE'
  })
  OriginVideoComment: Awaited<VideoCommentModel>

  @ForeignKey(() => VideoCommentModel)
  @Column
  inReplyToCommentId: number

  @BelongsTo(() => VideoCommentModel, {
    foreignKey: {
      name: 'inReplyToCommentId',
      allowNull: true
    },
    as: 'InReplyToVideoComment',
    onDelete: 'CASCADE'
  })
  InReplyToVideoComment: Awaited<VideoCommentModel> | null

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Video: Awaited<VideoModel>

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  Account: Awaited<AccountModel>

  @HasMany(() => VideoCommentAbuseModel, {
    foreignKey: {
      name: 'videoCommentId',
      allowNull: true
    },
    onDelete: 'set null'
  })
  CommentAbuses: Awaited<VideoCommentAbuseModel>[]

  @HasMany(() => CommentAutomaticTagModel, {
    foreignKey: 'commentId',
    onDelete: 'CASCADE'
  })
  CommentAutomaticTags: Awaited<CommentAutomaticTagModel>[]

  // ---------------------------------------------------------------------------

  static getSQLAttributes (tableName: string, aliasPrefix = '') {
    return buildSQLAttributes({
      model: this,
      tableName,
      aliasPrefix
    })
  }

  // ---------------------------------------------------------------------------

  static loadById (id: number, transaction?: Transaction): Promise<MComment> {
    const query = {
      where: {
        id
      },
      transaction
    }

    return VideoCommentModel.findOne(query)
  }

  static loadByIdAndPopulateVideoAndAccountAndReply (id: number, transaction?: Transaction): Promise<MCommentOwnerVideoReply> {
    const query = {
      where: {
        id
      },
      transaction
    }

    return VideoCommentModel
      .scope([ ScopeNames.WITH_VIDEO, ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_IN_REPLY_TO ])
      .findOne(query)
  }

  // ---------------------------------------------------------------------------

  static loadByUrlAndPopulateAccountAndVideoAndReply (url: string, transaction?: Transaction): Promise<MCommentOwnerVideoReply> {
    const query = {
      where: {
        url
      },
      transaction
    }

    return VideoCommentModel.scope([ ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_VIDEO, ScopeNames.WITH_IN_REPLY_TO ]).findOne(query)
  }

  static loadByUrlAndPopulateReplyAndVideoImmutableAndAccount (
    url: string,
    transaction?: Transaction
  ): Promise<MCommentOwnerReplyVideoImmutable> {
    const query = {
      where: {
        url
      },
      include: [
        {
          attributes: [ 'id', 'uuid', 'url', 'remote' ],
          model: VideoModel.unscoped()
        }
      ],
      transaction
    }

    return VideoCommentModel.scope([ ScopeNames.WITH_IN_REPLY_TO, ScopeNames.WITH_ACCOUNT ]).findOne(query)
  }

  // ---------------------------------------------------------------------------

  static listCommentsForApi (parameters: {
    start: number
    count: number
    sort: string

    autoTagOfAccountId: number

    videoAccountOwnerId?: number
    videoChannelOwnerId?: number

    onLocalVideo?: boolean
    isLocal?: boolean

    search?: string
    searchAccount?: string
    searchVideo?: string

    heldForReview: boolean

    videoId?: number
    videoChannelId?: number
    autoTagOneOf?: string[]
  }) {
    const queryOptions: ListVideoCommentsOptions = {
      ...pick(parameters, [
        'start',
        'count',
        'sort',
        'isLocal',
        'search',
        'searchVideo',
        'searchAccount',
        'onLocalVideo',
        'videoId',
        'videoChannelId',
        'autoTagOneOf',
        'autoTagOfAccountId',
        'videoAccountOwnerId',
        'videoChannelOwnerId',
        'heldForReview'
      ]),

      selectType: 'api',
      notDeleted: true
    }

    return Promise.all([
      new VideoCommentListQueryBuilder(VideoCommentModel.sequelize, queryOptions).listComments<MCommentAdminOrUserFormattable>(),
      new VideoCommentListQueryBuilder(VideoCommentModel.sequelize, queryOptions).countComments()
    ]).then(([ rows, count ]) => {
      return { total: count, data: rows }
    })
  }

  static async listThreadsForApi (parameters: {
    video: MVideo
    start: number
    count: number
    sort: string
    user?: MUserAccountId
  }) {
    const { video, user } = parameters

    const { blockerAccountIds, canSeeHeldForReview } = await VideoCommentModel.buildBlockerAccountIdsAndCanSeeHeldForReview({ user, video })

    const commonOptions: ListVideoCommentsOptions = {
      selectType: 'api',
      videoId: video.id,
      blockerAccountIds,

      heldForReview: canSeeHeldForReview
        ? undefined // Display all comments for video owner or moderator
        : false,
      heldForReviewAccountIdException: user?.Account?.id
    }

    const listOptions: ListVideoCommentsOptions = {
      ...commonOptions,
      ...pick(parameters, [ 'sort', 'start', 'count' ]),

      isThread: true,
      includeReplyCounters: true
    }

    const countOptions: ListVideoCommentsOptions = {
      ...commonOptions,

      isThread: true
    }

    const notDeletedCountOptions: ListVideoCommentsOptions = {
      ...commonOptions,

      notDeleted: true
    }

    return Promise.all([
      new VideoCommentListQueryBuilder(VideoCommentModel.sequelize, listOptions).listComments<MCommentAdminOrUserFormattable>(),
      new VideoCommentListQueryBuilder(VideoCommentModel.sequelize, countOptions).countComments(),
      new VideoCommentListQueryBuilder(VideoCommentModel.sequelize, notDeletedCountOptions).countComments()
    ]).then(([ rows, count, totalNotDeletedComments ]) => {
      return { total: count, data: rows, totalNotDeletedComments }
    })
  }

  static async listThreadCommentsForApi (parameters: {
    video: MVideo
    threadId: number
    user?: MUserAccountId
  }) {
    const { user, video, threadId } = parameters

    const { blockerAccountIds, canSeeHeldForReview } = await VideoCommentModel.buildBlockerAccountIdsAndCanSeeHeldForReview({ user, video })

    const queryOptions: ListVideoCommentsOptions = {
      threadId,

      videoId: video.id,
      selectType: 'api',
      sort: 'createdAt',

      blockerAccountIds,
      includeReplyCounters: true,

      heldForReview: canSeeHeldForReview
        ? undefined // Display all comments for video owner or moderator
        : false,
      heldForReviewAccountIdException: user?.Account?.id
    }

    return Promise.all([
      new VideoCommentListQueryBuilder(VideoCommentModel.sequelize, queryOptions).listComments<MCommentAdminOrUserFormattable>(),
      new VideoCommentListQueryBuilder(VideoCommentModel.sequelize, queryOptions).countComments()
    ]).then(([ rows, count ]) => {
      return { total: count, data: rows }
    })
  }

  static listThreadParentComments (options: {
    comment: MCommentId
    transaction?: Transaction
    order?: 'ASC' | 'DESC'
  }): Promise<MCommentOwner[]> {
    const { comment, transaction, order = 'ASC' } = options

    const query = {
      order: [ [ 'createdAt', order ] ] as Order,
      where: {
        id: {
          [Op.in]: Sequelize.literal('(' +
            'WITH RECURSIVE children (id, "inReplyToCommentId") AS ( ' +
              `SELECT id, "inReplyToCommentId" FROM "videoComment" WHERE id = ${comment.id} ` +
              'UNION ' +
              'SELECT "parent"."id", "parent"."inReplyToCommentId" FROM "videoComment" "parent" ' +
              'INNER JOIN "children" ON "children"."inReplyToCommentId" = "parent"."id"' +
            ') ' +
            'SELECT id FROM children' +
          ')'),
          [Op.ne]: comment.id
        }
      },
      transaction
    }

    return VideoCommentModel
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findAll(query)
  }

  static async listAndCountByVideoForAP (parameters: {
    video: MVideoImmutable
    start: number
    count: number
  }) {
    const { video } = parameters

    const blockerAccountIds = await VideoCommentModel.buildBlockerAccountIds({ user: null })

    const queryOptions: ListVideoCommentsOptions = {
      ...pick(parameters, [ 'start', 'count' ]),

      selectType: 'comment-only',
      videoId: video.id,
      sort: 'createdAt',

      heldForReview: false,

      blockerAccountIds
    }

    return Promise.all([
      new VideoCommentListQueryBuilder(VideoCommentModel.sequelize, queryOptions).listComments<MComment>(),
      new VideoCommentListQueryBuilder(VideoCommentModel.sequelize, queryOptions).countComments()
    ]).then(([ rows, count ]) => {
      return { total: count, data: rows }
    })
  }

  static async listForFeed (parameters: {
    start: number
    count: number
    videoId?: number
    videoAccountOwnerId?: number
    videoChannelOwnerId?: number
  }) {
    const blockerAccountIds = await VideoCommentModel.buildBlockerAccountIds({ user: null })

    const queryOptions: ListVideoCommentsOptions = {
      ...pick(parameters, [ 'start', 'count', 'videoAccountOwnerId', 'videoId', 'videoChannelOwnerId' ]),

      selectType: 'feed',

      sort: '-createdAt',
      onPublicVideo: true,

      notDeleted: true,
      heldForReview: false,

      blockerAccountIds
    }

    return new VideoCommentListQueryBuilder(VideoCommentModel.sequelize, queryOptions).listComments<MCommentOwnerVideoFeed>()
  }

  static listForBulkDelete (ofAccount: MAccount, filter: { onVideosOfAccount?: MAccountId } = {}) {
    const queryOptions: ListVideoCommentsOptions = {
      selectType: 'comment-only',

      accountId: ofAccount.id,
      videoAccountOwnerId: filter.onVideosOfAccount?.id,

      heldForReview: undefined,

      notDeleted: true,
      count: 5000
    }

    return new VideoCommentListQueryBuilder(VideoCommentModel.sequelize, queryOptions).listComments<MComment>()
  }

  static listForExport (ofAccountId: number): Promise<MCommentExport[]> {
    return VideoCommentModel.findAll({
      attributes: [ 'id', 'url', 'text', 'createdAt' ],
      where: {
        accountId: ofAccountId,
        deletedAt: null
      },
      include: [
        {
          attributes: [ 'id', 'uuid', 'url' ],
          required: true,
          model: VideoModel.unscoped()
        },
        {
          attributes: [ 'url' ],
          required: false,
          model: VideoCommentModel,
          as: 'InReplyToVideoComment'
        }
      ],
      limit: USER_EXPORT_MAX_ITEMS
    })
  }

  // ---------------------------------------------------------------------------

  static async getStats () {
    const where = {
      deletedAt: null,
      heldForReview: false
    }

    const totalLocalVideoComments = await VideoCommentModel.count({
      where,
      include: [
        {
          model: AccountModel.unscoped(),
          required: true,
          include: [
            {
              model: ActorModel.unscoped(),
              required: true,
              where: {
                serverId: null
              }
            }
          ]
        }
      ]
    })
    const totalVideoComments = await VideoCommentModel.count({ where })

    return {
      totalLocalVideoComments,
      totalVideoComments
    }
  }

  // ---------------------------------------------------------------------------

  static listRemoteCommentUrlsOfLocalVideos () {
    const query = `SELECT "videoComment".url FROM "videoComment" ` +
      `INNER JOIN account ON account.id = "videoComment"."accountId" ` +
      `INNER JOIN actor ON actor.id = "account"."actorId" AND actor."serverId" IS NOT NULL ` +
      `INNER JOIN video ON video.id = "videoComment"."videoId" AND video.remote IS FALSE`

    return VideoCommentModel.sequelize.query<{ url: string }>(query, {
      type: QueryTypes.SELECT,
      raw: true
    }).then(rows => rows.map(r => r.url))
  }

  static cleanOldCommentsOf (videoId: number, beforeUpdatedAt: Date) {
    const query = {
      where: {
        updatedAt: {
          [Op.lt]: beforeUpdatedAt
        },
        videoId,
        accountId: {
          [Op.notIn]: buildLocalAccountIdsIn()
        },
        // Do not delete Tombstones
        deletedAt: null
      }
    }

    return VideoCommentModel.destroy(query)
  }

  // ---------------------------------------------------------------------------

  getCommentStaticPath () {
    return this.Video.getWatchStaticPath() + ';threadId=' + this.getThreadId()
  }

  getCommentUserReviewPath () {
    return '/my-account/videos/comments?search=heldForReview:true'
  }

  getThreadId (): number {
    return this.originCommentId || this.id
  }

  isOwned () {
    if (!this.Account) return false

    return this.Account.isOwned()
  }

  markAsDeleted () {
    this.text = ''
    this.deletedAt = new Date()
    this.accountId = null
  }

  isDeleted () {
    return this.deletedAt !== null
  }

  extractMentions () {
    return extractMentions(this.text, this.isOwned())
  }

  toFormattedJSON (this: MCommentFormattable) {
    return {
      id: this.id,
      url: this.url,
      text: this.text,

      threadId: this.getThreadId(),
      inReplyToCommentId: this.inReplyToCommentId || null,
      videoId: this.videoId,

      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,

      heldForReview: this.heldForReview,

      isDeleted: this.isDeleted(),

      totalRepliesFromVideoAuthor: this.get('totalRepliesFromVideoAuthor') || 0,
      totalReplies: this.get('totalReplies') || 0,

      account: this.Account
        ? this.Account.toFormattedJSON()
        : null
    } as VideoComment
  }

  toFormattedForAdminOrUserJSON (this: MCommentAdminOrUserFormattable) {
    return {
      id: this.id,
      url: this.url,
      text: this.text,

      threadId: this.getThreadId(),
      inReplyToCommentId: this.inReplyToCommentId || null,
      videoId: this.videoId,

      createdAt: this.createdAt,
      updatedAt: this.updatedAt,

      heldForReview: this.heldForReview,
      automaticTags: (this.CommentAutomaticTags || []).map(m => m.AutomaticTag.name),

      video: {
        id: this.Video.id,
        uuid: this.Video.uuid,
        name: this.Video.name
      },

      account: this.Account
        ? this.Account.toFormattedJSON()
        : null
    } as VideoCommentForAdminOrUser
  }

  toActivityPubObject (this: MCommentAP, threadParentComments: MCommentOwner[]): VideoCommentObject | ActivityTombstoneObject {
    const inReplyTo = this.inReplyToCommentId === null
      ? this.Video.url // New thread, so we reply to the video
      : this.InReplyToVideoComment.url

    if (this.isDeleted()) {
      return {
        id: this.url,
        type: 'Tombstone',
        formerType: 'Note',
        inReplyTo,
        published: this.createdAt.toISOString(),
        updated: this.updatedAt.toISOString(),
        deleted: this.deletedAt.toISOString()
      }
    }

    const tag: ActivityTagObject[] = []
    for (const parentComment of threadParentComments) {
      if (!parentComment.Account) continue

      const actor = parentComment.Account.Actor

      tag.push({
        type: 'Mention',
        href: actor.url,
        name: `@${actor.preferredUsername}@${actor.getHost()}`
      })
    }

    let replyApproval = this.replyApproval
    if (this.Video.isOwned() && !this.heldForReview) {
      replyApproval = getLocalApproveReplyActivityPubUrl(this.Video, this)
    }

    return {
      type: 'Note' as 'Note',
      id: this.url,

      content: this.text,
      mediaType: 'text/markdown',

      inReplyTo,
      updated: this.updatedAt.toISOString(),
      published: this.createdAt.toISOString(),
      url: this.url,
      attributedTo: this.Account.Actor.url,
      replyApproval,
      tag
    }
  }

  private static async buildBlockerAccountIds (options: {
    user: MUserAccountId
  }): Promise<number[]> {
    const { user } = options

    const serverActor = await getServerActor()
    const blockerAccountIds = [ serverActor.Account.id ]

    if (user) blockerAccountIds.push(user.Account.id)

    return blockerAccountIds
  }

  private static buildBlockerAccountIdsAndCanSeeHeldForReview (options: {
    video: MVideo
    user: MUserAccountId
  }) {
    const { video, user } = options
    const blockerAccountIdsPromise = this.buildBlockerAccountIds(options)

    let canSeeHeldForReviewPromise: Promise<boolean>
    if (user) {
      if (user.hasRight(UserRight.SEE_ALL_COMMENTS)) {
        canSeeHeldForReviewPromise = Promise.resolve(true)
      } else {
        canSeeHeldForReviewPromise = VideoChannelModel.loadAndPopulateAccount(video.channelId)
          .then(c => c.accountId === user.Account.id)
      }
    } else {
      canSeeHeldForReviewPromise = Promise.resolve(false)
    }

    return Promise.all([ blockerAccountIdsPromise, canSeeHeldForReviewPromise ])
      .then(([ blockerAccountIds, canSeeHeldForReview ]) => ({ blockerAccountIds, canSeeHeldForReview }))
  }
}
