import * as Sequelize from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  IFindOptions,
  Is,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { ActivityTagObject } from '../../../shared/models/activitypub/objects/common-objects'
import { VideoCommentObject } from '../../../shared/models/activitypub/objects/video-comment-object'
import { VideoComment } from '../../../shared/models/videos/video-comment.model'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { CONFIG, CONSTRAINTS_FIELDS } from '../../initializers'
import { sendDeleteVideoComment } from '../../lib/activitypub/send'
import { AccountModel } from '../account/account'
import { ActorModel } from '../activitypub/actor'
import { AvatarModel } from '../avatar/avatar'
import { ServerModel } from '../server/server'
import { buildBlockedAccountSQL, getSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { VideoChannelModel } from './video-channel'
import { getServerActor } from '../../helpers/utils'
import { UserModel } from '../account/user'
import { actorNameAlphabet } from '../../helpers/custom-validators/activitypub/actor'
import { regexpCapture } from '../../helpers/regexp'
import { uniq } from 'lodash'

enum ScopeNames {
  WITH_ACCOUNT = 'WITH_ACCOUNT',
  WITH_IN_REPLY_TO = 'WITH_IN_REPLY_TO',
  WITH_VIDEO = 'WITH_VIDEO',
  ATTRIBUTES_FOR_API = 'ATTRIBUTES_FOR_API'
}

@Scopes({
  [ScopeNames.ATTRIBUTES_FOR_API]: (serverAccountId: number, userAccountId?: number) => {
    return {
      attributes: {
        include: [
          [
            Sequelize.literal(
              '(' +
                'WITH "blocklist" AS (' + buildBlockedAccountSQL(serverAccountId, userAccountId) + ')' +
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
          ]
        ]
      }
    }
  },
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      {
        model: () => AccountModel,
        include: [
          {
            model: () => ActorModel,
            include: [
              {
                model: () => ServerModel,
                required: false
              },
              {
                model: () => AvatarModel,
                required: false
              }
            ]
          }
        ]
      }
    ]
  },
  [ScopeNames.WITH_IN_REPLY_TO]: {
    include: [
      {
        model: () => VideoCommentModel,
        as: 'InReplyToVideoComment'
      }
    ]
  },
  [ScopeNames.WITH_VIDEO]: {
    include: [
      {
        model: () => VideoModel,
        required: true,
        include: [
          {
            model: () => VideoChannelModel.unscoped(),
            required: true,
            include: [
              {
                model: () => AccountModel,
                required: true,
                include: [
                  {
                    model: () => ActorModel,
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
})
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
    }
  ]
})
export class VideoCommentModel extends Model<VideoCommentModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

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
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Account: AccountModel

  @BeforeDestroy
  static async sendDeleteIfOwned (instance: VideoCommentModel, options) {
    if (!instance.Account || !instance.Account.Actor) {
      instance.Account = await instance.$get('Account', {
        include: [ ActorModel ],
        transaction: options.transaction
      }) as AccountModel
    }

    if (!instance.Video) {
      instance.Video = await instance.$get('Video', {
        include: [
          {
            model: VideoChannelModel,
            include: [
              {
                model: AccountModel,
                include: [
                  {
                    model: ActorModel
                  }
                ]
              }
            ]
          }
        ],
        transaction: options.transaction
      }) as VideoModel
    }

    if (instance.isOwned()) {
      await sendDeleteVideoComment(instance, options.transaction)
    }
  }

  static loadById (id: number, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoCommentModel> = {
      where: {
        id
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoCommentModel.findOne(query)
  }

  static loadByIdAndPopulateVideoAndAccountAndReply (id: number, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoCommentModel> = {
      where: {
        id
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoCommentModel
      .scope([ ScopeNames.WITH_VIDEO, ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_IN_REPLY_TO ])
      .findOne(query)
  }

  static loadByUrlAndPopulateAccount (url: string, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoCommentModel> = {
      where: {
        url
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoCommentModel.scope([ ScopeNames.WITH_ACCOUNT ]).findOne(query)
  }

  static loadByUrlAndPopulateReplyAndVideo (url: string, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoCommentModel> = {
      where: {
        url
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoCommentModel.scope([ ScopeNames.WITH_IN_REPLY_TO, ScopeNames.WITH_VIDEO ]).findOne(query)
  }

  static async listThreadsForApi (videoId: number, start: number, count: number, sort: string, user?: UserModel) {
    const serverActor = await getServerActor()
    const serverAccountId = serverActor.Account.id
    const userAccountId = user ? user.Account.id : undefined

    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        videoId,
        inReplyToCommentId: null,
        accountId: {
          [Sequelize.Op.notIn]: Sequelize.literal(
            '(' + buildBlockedAccountSQL(serverAccountId, userAccountId) + ')'
          )
        }
      }
    }

    // FIXME: typings
    const scopes: any[] = [
      ScopeNames.WITH_ACCOUNT,
      {
        method: [ ScopeNames.ATTRIBUTES_FOR_API, serverAccountId, userAccountId ]
      }
    ]

    return VideoCommentModel
      .scope(scopes)
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static async listThreadCommentsForApi (videoId: number, threadId: number, user?: UserModel) {
    const serverActor = await getServerActor()
    const serverAccountId = serverActor.Account.id
    const userAccountId = user ? user.Account.id : undefined

    const query = {
      order: [ [ 'createdAt', 'ASC' ], [ 'updatedAt', 'ASC' ] ],
      where: {
        videoId,
        [ Sequelize.Op.or ]: [
          { id: threadId },
          { originCommentId: threadId }
        ],
        accountId: {
          [Sequelize.Op.notIn]: Sequelize.literal(
            '(' + buildBlockedAccountSQL(serverAccountId, userAccountId) + ')'
          )
        }
      }
    }

    const scopes: any[] = [
      ScopeNames.WITH_ACCOUNT,
      {
        method: [ ScopeNames.ATTRIBUTES_FOR_API, serverAccountId, userAccountId ]
      }
    ]

    return VideoCommentModel
      .scope(scopes)
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static listThreadParentComments (comment: VideoCommentModel, t: Sequelize.Transaction, order: 'ASC' | 'DESC' = 'ASC') {
    const query = {
      order: [ [ 'createdAt', order ] ],
      where: {
        id: {
          [ Sequelize.Op.in ]: Sequelize.literal('(' +
            'WITH RECURSIVE children (id, "inReplyToCommentId") AS ( ' +
              `SELECT id, "inReplyToCommentId" FROM "videoComment" WHERE id = ${comment.id} ` +
              'UNION ' +
              'SELECT "parent"."id", "parent"."inReplyToCommentId" FROM "videoComment" "parent" ' +
              'INNER JOIN "children" ON "children"."inReplyToCommentId" = "parent"."id"' +
            ') ' +
            'SELECT id FROM children' +
          ')'),
          [ Sequelize.Op.ne ]: comment.id
        }
      },
      transaction: t
    }

    return VideoCommentModel
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findAll(query)
  }

  static listAndCountByVideoId (videoId: number, start: number, count: number, t?: Sequelize.Transaction, order: 'ASC' | 'DESC' = 'ASC') {
    const query = {
      order: [ [ 'createdAt', order ] ],
      offset: start,
      limit: count,
      where: {
        videoId
      },
      transaction: t
    }

    return VideoCommentModel.findAndCountAll(query)
  }

  static listForFeed (start: number, count: number, videoId?: number) {
    const query = {
      order: [ [ 'createdAt', 'DESC' ] ],
      offset: start,
      limit: count,
      where: {},
      include: [
        {
          attributes: [ 'name', 'uuid' ],
          model: VideoModel.unscoped(),
          required: true
        }
      ]
    }

    if (videoId) query.where['videoId'] = videoId

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
          [Sequelize.Op.lt]: beforeUpdatedAt
        },
        videoId
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
    return this.Account.isOwned()
  }

  extractMentions () {
    let result: string[] = []

    const localMention = `@(${actorNameAlphabet}+)`
    const remoteMention = `${localMention}@${CONFIG.WEBSERVER.HOST}`

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

  toFormattedJSON () {
    return {
      id: this.id,
      url: this.url,
      text: this.text,
      threadId: this.originCommentId || this.id,
      inReplyToCommentId: this.inReplyToCommentId || null,
      videoId: this.videoId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      totalReplies: this.get('totalReplies') || 0,
      account: this.Account.toFormattedJSON()
    } as VideoComment
  }

  toActivityPubObject (threadParentComments: VideoCommentModel[]): VideoCommentObject {
    let inReplyTo: string
    // New thread, so in AS we reply to the video
    if (this.inReplyToCommentId === null) {
      inReplyTo = this.Video.url
    } else {
      inReplyTo = this.InReplyToVideoComment.url
    }

    const tag: ActivityTagObject[] = []
    for (const parentComment of threadParentComments) {
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
}
