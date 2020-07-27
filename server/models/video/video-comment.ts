import * as Bluebird from 'bluebird'
import { uniq } from 'lodash'
import { FindOptions, Op, Order, ScopeOptions, Sequelize, Transaction } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  HasMany,
  Is,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { getServerActor } from '@server/models/application/application'
import { MAccount, MAccountId, MUserAccountId } from '@server/types/models'
import { VideoPrivacy } from '@shared/models'
import { ActivityTagObject, ActivityTombstoneObject } from '../../../shared/models/activitypub/objects/common-objects'
import { VideoCommentObject } from '../../../shared/models/activitypub/objects/video-comment-object'
import { VideoComment } from '../../../shared/models/videos/video-comment.model'
import { actorNameAlphabet } from '../../helpers/custom-validators/activitypub/actor'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { regexpCapture } from '../../helpers/regexp'
import { CONSTRAINTS_FIELDS, WEBSERVER } from '../../initializers/constants'
import {
  MComment,
  MCommentAP,
  MCommentFormattable,
  MCommentId,
  MCommentOwner,
  MCommentOwnerReplyVideoLight,
  MCommentOwnerVideo,
  MCommentOwnerVideoFeed,
  MCommentOwnerVideoReply,
  MVideoImmutable
} from '../../types/models/video'
import { VideoCommentAbuseModel } from '../abuse/video-comment-abuse'
import { AccountModel } from '../account/account'
import { ActorModel, unusedActorAttributesForAPI } from '../activitypub/actor'
import { buildBlockedAccountSQL, buildLocalAccountIdsIn, getCommentSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { VideoChannelModel } from './video-channel'

export enum ScopeNames {
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_ACCOUNT_FOR_API = 'WITH_ACCOUNT_FOR_API',
  WITH_IN_REPLY_TO = 'WITH_IN_REPLY_TO',
  WITH_VIDEO = 'WITH_VIDEO',
  ATTRIBUTES_FOR_API = 'ATTRIBUTES_FOR_API'
}

@Scopes(() => ({
  [ScopeNames.ATTRIBUTES_FOR_API]: (blockerAccountIds: number[]) => {
    return {
      attributes: {
        include: [
          [
            Sequelize.literal(
              '(' +
                'WITH "blocklist" AS (' + buildBlockedAccountSQL(blockerAccountIds) + ')' +
                'SELECT COUNT("replies"."id") - (' +
                  'SELECT COUNT("replies"."id") ' +
                  'FROM "videoComment" AS "replies" ' +
                  'WHERE "replies"."originCommentId" = "VideoCommentModel"."id" ' +
                  'AND "accountId" IN (SELECT "id" FROM "blocklist")' +
                ')' +
                'FROM "videoComment" AS "replies" ' +
                'WHERE "replies"."originCommentId" = "VideoCommentModel"."id" ' +
                'AND "accountId" NOT IN (SELECT "id" FROM "blocklist")' +
              ')'
            ),
            'totalReplies'
          ],
          [
            Sequelize.literal(
              '(' +
                'SELECT COUNT("replies"."id") ' +
                'FROM "videoComment" AS "replies" ' +
                'INNER JOIN "video" ON "video"."id" = "replies"."videoId" ' +
                'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
                'WHERE "replies"."originCommentId" = "VideoCommentModel"."id" ' +
                'AND "replies"."accountId" = "videoChannel"."accountId"' +
              ')'
            ),
            'totalRepliesFromVideoAuthor'
          ]
        ]
      }
    } as FindOptions
  },
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: AccountModel
      }
    ]
  },
  [ScopeNames.WITH_ACCOUNT_FOR_API]: {
    include: [
      {
        model: AccountModel.unscoped(),
        include: [
          {
            attributes: {
              exclude: unusedActorAttributesForAPI
            },
            model: ActorModel, // Default scope includes avatar and server
            required: true
          }
        ]
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
            model: VideoChannelModel,
            required: true,
            include: [
              {
                model: AccountModel,
                required: true
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
export class VideoCommentModel extends Model<VideoCommentModel> {
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
  OriginVideoComment: VideoCommentModel

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
  InReplyToVideoComment: VideoCommentModel | null

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Video: VideoModel

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  Account: AccountModel

  @HasMany(() => VideoCommentAbuseModel, {
    foreignKey: {
      name: 'videoCommentId',
      allowNull: true
    },
    onDelete: 'set null'
  })
  CommentAbuses: VideoCommentAbuseModel[]

  static loadById (id: number, t?: Transaction): Bluebird<MComment> {
    const query: FindOptions = {
      where: {
        id
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoCommentModel.findOne(query)
  }

  static loadByIdAndPopulateVideoAndAccountAndReply (id: number, t?: Transaction): Bluebird<MCommentOwnerVideoReply> {
    const query: FindOptions = {
      where: {
        id
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoCommentModel
      .scope([ ScopeNames.WITH_VIDEO, ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_IN_REPLY_TO ])
      .findOne(query)
  }

  static loadByUrlAndPopulateAccountAndVideo (url: string, t?: Transaction): Bluebird<MCommentOwnerVideo> {
    const query: FindOptions = {
      where: {
        url
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoCommentModel.scope([ ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_VIDEO ]).findOne(query)
  }

  static loadByUrlAndPopulateReplyAndVideoUrlAndAccount (url: string, t?: Transaction): Bluebird<MCommentOwnerReplyVideoLight> {
    const query: FindOptions = {
      where: {
        url
      },
      include: [
        {
          attributes: [ 'id', 'url' ],
          model: VideoModel.unscoped()
        }
      ]
    }

    if (t !== undefined) query.transaction = t

    return VideoCommentModel.scope([ ScopeNames.WITH_IN_REPLY_TO, ScopeNames.WITH_ACCOUNT ]).findOne(query)
  }

  static async listThreadsForApi (parameters: {
    videoId: number
    isVideoOwned: boolean
    start: number
    count: number
    sort: string
    user?: MUserAccountId
  }) {
    const { videoId, isVideoOwned, start, count, sort, user } = parameters

    const blockerAccountIds = await VideoCommentModel.buildBlockerAccountIds({ videoId, user, isVideoOwned })

    const query = {
      offset: start,
      limit: count,
      order: getCommentSort(sort),
      where: {
        [Op.and]: [
          {
            videoId
          },
          {
            inReplyToCommentId: null
          },
          {
            [Op.or]: [
              {
                accountId: {
                  [Op.notIn]: Sequelize.literal(
                    '(' + buildBlockedAccountSQL(blockerAccountIds) + ')'
                  )
                }
              },
              {
                accountId: null
              }
            ]
          }
        ]
      }
    }

    const scopes: (string | ScopeOptions)[] = [
      ScopeNames.WITH_ACCOUNT_FOR_API,
      {
        method: [ ScopeNames.ATTRIBUTES_FOR_API, blockerAccountIds ]
      }
    ]

    return VideoCommentModel
      .scope(scopes)
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static async listThreadCommentsForApi (parameters: {
    videoId: number
    isVideoOwned: boolean
    threadId: number
    user?: MUserAccountId
  }) {
    const { videoId, threadId, user, isVideoOwned } = parameters

    const blockerAccountIds = await VideoCommentModel.buildBlockerAccountIds({ videoId, user, isVideoOwned })

    const query = {
      order: [ [ 'createdAt', 'ASC' ], [ 'updatedAt', 'ASC' ] ] as Order,
      where: {
        videoId,
        [Op.or]: [
          { id: threadId },
          { originCommentId: threadId }
        ],
        accountId: {
          [Op.notIn]: Sequelize.literal(
            '(' + buildBlockedAccountSQL(blockerAccountIds) + ')'
          )
        }
      }
    }

    const scopes: any[] = [
      ScopeNames.WITH_ACCOUNT_FOR_API,
      {
        method: [ ScopeNames.ATTRIBUTES_FOR_API, blockerAccountIds ]
      }
    ]

    return VideoCommentModel
      .scope(scopes)
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static listThreadParentComments (comment: MCommentId, t: Transaction, order: 'ASC' | 'DESC' = 'ASC'): Bluebird<MCommentOwner[]> {
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
      transaction: t
    }

    return VideoCommentModel
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findAll(query)
  }

  static async listAndCountByVideoForAP (video: MVideoImmutable, start: number, count: number, t?: Transaction) {
    const blockerAccountIds = await VideoCommentModel.buildBlockerAccountIds({
      videoId: video.id,
      isVideoOwned: video.isOwned()
    })

    const query = {
      order: [ [ 'createdAt', 'ASC' ] ] as Order,
      offset: start,
      limit: count,
      where: {
        videoId: video.id,
        accountId: {
          [Op.notIn]: Sequelize.literal(
            '(' + buildBlockedAccountSQL(blockerAccountIds) + ')'
          )
        }
      },
      transaction: t
    }

    return VideoCommentModel.findAndCountAll<MComment>(query)
  }

  static async listForFeed (parameters: {
    start: number
    count: number
    videoId?: number
    accountId?: number
    videoChannelId?: number
  }): Promise<MCommentOwnerVideoFeed[]> {
    const serverActor = await getServerActor()
    const { start, count, videoId, accountId, videoChannelId } = parameters

    const accountExclusion = {
      [Op.notIn]: Sequelize.literal(
        '(' + buildBlockedAccountSQL([ serverActor.Account.id, '"Video->VideoChannel"."accountId"' ]) + ')'
      )
    }
    const accountWhere = accountId
      ? {
        [Op.and]: {
          ...accountExclusion,
          [Op.eq]: accountId
        }
      }
      : accountExclusion

    const videoChannelWhere = videoChannelId ? { id: videoChannelId } : undefined

    const query = {
      order: [ [ 'createdAt', 'DESC' ] ] as Order,
      offset: start,
      limit: count,
      where: {
        deletedAt: null,
        accountId: accountWhere
      },
      include: [
        {
          attributes: [ 'name', 'uuid' ],
          model: VideoModel.unscoped(),
          required: true,
          where: {
            privacy: VideoPrivacy.PUBLIC
          },
          include: [
            {
              attributes: [ 'accountId' ],
              model: VideoChannelModel.unscoped(),
              required: true,
              where: videoChannelWhere
            }
          ]
        }
      ]
    }

    if (videoId) query.where['videoId'] = videoId

    return VideoCommentModel
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findAll(query)
  }

  static listForBulkDelete (ofAccount: MAccount, filter: { onVideosOfAccount?: MAccountId } = {}) {
    const accountWhere = filter.onVideosOfAccount
      ? { id: filter.onVideosOfAccount.id }
      : {}

    const query = {
      limit: 1000,
      where: {
        deletedAt: null,
        accountId: ofAccount.id
      },
      include: [
        {
          model: VideoModel,
          required: true,
          include: [
            {
              model: VideoChannelModel,
              required: true,
              include: [
                {
                  model: AccountModel,
                  required: true,
                  where: accountWhere
                }
              ]
            }
          ]
        }
      ]
    }

    return VideoCommentModel
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findAll(query)
  }

  static async getStats () {
    const totalLocalVideoComments = await VideoCommentModel.count({
      include: [
        {
          model: AccountModel,
          required: true,
          include: [
            {
              model: ActorModel,
              required: true,
              where: {
                serverId: null
              }
            }
          ]
        }
      ]
    })
    const totalVideoComments = await VideoCommentModel.count()

    return {
      totalLocalVideoComments,
      totalVideoComments
    }
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

  getCommentStaticPath () {
    return this.Video.getWatchStaticPath() + ';threadId=' + this.getThreadId()
  }

  getThreadId (): number {
    return this.originCommentId || this.id
  }

  isOwned () {
    if (!this.Account) {
      return false
    }

    return this.Account.isOwned()
  }

  isDeleted () {
    return this.deletedAt !== null
  }

  extractMentions () {
    let result: string[] = []

    const localMention = `@(${actorNameAlphabet}+)`
    const remoteMention = `${localMention}@${WEBSERVER.HOST}`

    const mentionRegex = this.isOwned()
      ? '(?:(?:' + remoteMention + ')|(?:' + localMention + '))' // Include local mentions?
      : '(?:' + remoteMention + ')'

    const firstMentionRegex = new RegExp(`^${mentionRegex} `, 'g')
    const endMentionRegex = new RegExp(` ${mentionRegex}$`, 'g')
    const remoteMentionsRegex = new RegExp(' ' + remoteMention + ' ', 'g')

    result = result.concat(
      regexpCapture(this.text, firstMentionRegex)
        .map(([ , username1, username2 ]) => username1 || username2),

      regexpCapture(this.text, endMentionRegex)
        .map(([ , username1, username2 ]) => username1 || username2),

      regexpCapture(this.text, remoteMentionsRegex)
        .map(([ , username ]) => username)
    )

    // Include local mentions
    if (this.isOwned()) {
      const localMentionsRegex = new RegExp(' ' + localMention + ' ', 'g')

      result = result.concat(
        regexpCapture(this.text, localMentionsRegex)
          .map(([ , username ]) => username)
      )
    }

    return uniq(result)
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
      isDeleted: this.isDeleted(),
      totalRepliesFromVideoAuthor: this.get('totalRepliesFromVideoAuthor') || 0,
      totalReplies: this.get('totalReplies') || 0,
      account: this.Account ? this.Account.toFormattedJSON() : null
    } as VideoComment
  }

  toActivityPubObject (this: MCommentAP, threadParentComments: MCommentOwner[]): VideoCommentObject | ActivityTombstoneObject {
    let inReplyTo: string
    // New thread, so in AS we reply to the video
    if (this.inReplyToCommentId === null) {
      inReplyTo = this.Video.url
    } else {
      inReplyTo = this.InReplyToVideoComment.url
    }

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

    return {
      type: 'Note' as 'Note',
      id: this.url,
      content: this.text,
      inReplyTo,
      updated: this.updatedAt.toISOString(),
      published: this.createdAt.toISOString(),
      url: this.url,
      attributedTo: this.Account.Actor.url,
      tag
    }
  }

  private static async buildBlockerAccountIds (options: {
    videoId: number
    isVideoOwned: boolean
    user?: MUserAccountId
  }) {
    const { videoId, user, isVideoOwned } = options

    const serverActor = await getServerActor()
    const blockerAccountIds = [ serverActor.Account.id ]

    if (user) blockerAccountIds.push(user.Account.id)

    if (isVideoOwned) {
      const videoOwnerAccount = await AccountModel.loadAccountIdFromVideo(videoId)
      blockerAccountIds.push(videoOwnerAccount.id)
    }

    return blockerAccountIds
  }
}
