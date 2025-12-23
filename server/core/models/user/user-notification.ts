import { forceNumber, maxBy } from '@peertube/peertube-core-utils'
import type { UserNotification, UserNotificationData, UserNotificationType_Type } from '@peertube/peertube-models'
import { uuidToShort } from '@peertube/peertube-node-utils'
import { UserNotificationIncludes, UserNotificationModelForApi } from '@server/types/models/user/index.js'
import { ModelIndexesOptions, Op, WhereOptions } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Is, Table, UpdatedAt } from 'sequelize-typescript'
import { isBooleanValid } from '../../helpers/custom-validators/misc.js'
import { isUserNotificationTypeValid } from '../../helpers/custom-validators/user-notifications.js'
import { AbuseModel } from '../abuse/abuse.js'
import { AccountModel } from '../account/account.js'
import { ActorFollowModel } from '../actor/actor-follow.js'
import { ActorImageModel } from '../actor/actor-image.js'
import { ApplicationModel } from '../application/application.js'
import { PluginModel } from '../server/plugin.js'
import { SequelizeModel, throwIfNotValid } from '../shared/index.js'
import { getStateLabel } from '../video/formatter/video-api-format.js'
import { VideoBlacklistModel } from '../video/video-blacklist.js'
import { VideoCaptionModel } from '../video/video-caption.js'
import { VideoChannelCollaboratorModel } from '../video/video-channel-collaborator.js'
import { VideoCommentModel } from '../video/video-comment.js'
import { VideoImportModel } from '../video/video-import.js'
import { VideoModel } from '../video/video.js'
import { UserNotificationListQueryBuilder } from './sql/user-notification/user-notification-list-query-builder.js'
import { UserRegistrationModel } from './user-registration.js'
import { UserModel } from './user.js'

@Table({
  tableName: 'userNotification',
  indexes: [
    {
      fields: [ 'userId' ]
    },
    {
      fields: [ 'videoId' ],
      where: {
        videoId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'commentId' ],
      where: {
        commentId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'abuseId' ],
      where: {
        abuseId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'videoBlacklistId' ],
      where: {
        videoBlacklistId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'videoImportId' ],
      where: {
        videoImportId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'accountId' ],
      where: {
        accountId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'actorFollowId' ],
      where: {
        actorFollowId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'pluginId' ],
      where: {
        pluginId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'applicationId' ],
      where: {
        applicationId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'userRegistrationId' ],
      where: {
        userRegistrationId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'channelCollaboratorId' ],
      where: {
        channelCollaboratorId: {
          [Op.ne]: null
        }
      }
    }
  ] as (ModelIndexesOptions & { where?: WhereOptions })[]
})
export class UserNotificationModel extends SequelizeModel<UserNotificationModel> {
  @AllowNull(false)
  @Default(null)
  @Is('UserNotificationType', value => throwIfNotValid(value, isUserNotificationTypeValid, 'type'))
  @Column
  declare type: UserNotificationType_Type

  @AllowNull(false)
  @Default(false)
  @Is('UserNotificationRead', value => throwIfNotValid(value, isBooleanValid, 'read'))
  @Column
  declare read: boolean

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare data: UserNotificationData

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @ForeignKey(() => UserModel)
  @Column
  declare userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  declare User: Awaited<UserModel>

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare Video: Awaited<VideoModel>

  @ForeignKey(() => VideoCommentModel)
  @Column
  declare commentId: number

  @BelongsTo(() => VideoCommentModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare VideoComment: Awaited<VideoCommentModel>

  @ForeignKey(() => AbuseModel)
  @Column
  declare abuseId: number

  @BelongsTo(() => AbuseModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare Abuse: Awaited<AbuseModel>

  @ForeignKey(() => VideoBlacklistModel)
  @Column
  declare videoBlacklistId: number

  @BelongsTo(() => VideoBlacklistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare VideoBlacklist: Awaited<VideoBlacklistModel>

  @ForeignKey(() => VideoImportModel)
  @Column
  declare videoImportId: number

  @BelongsTo(() => VideoImportModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare VideoImport: Awaited<VideoImportModel>

  @ForeignKey(() => AccountModel)
  @Column
  declare accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare Account: Awaited<AccountModel>

  @ForeignKey(() => ActorFollowModel)
  @Column
  declare actorFollowId: number

  @BelongsTo(() => ActorFollowModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare ActorFollow: Awaited<ActorFollowModel>

  @ForeignKey(() => PluginModel)
  @Column
  declare pluginId: number

  @BelongsTo(() => PluginModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare Plugin: Awaited<PluginModel>

  @ForeignKey(() => ApplicationModel)
  @Column
  declare applicationId: number

  @BelongsTo(() => ApplicationModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare Application: Awaited<ApplicationModel>

  @ForeignKey(() => UserRegistrationModel)
  @Column
  declare userRegistrationId: number

  @BelongsTo(() => UserRegistrationModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare UserRegistration: Awaited<UserRegistrationModel>

  @ForeignKey(() => VideoCaptionModel)
  @Column
  declare videoCaptionId: number

  @BelongsTo(() => VideoCaptionModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare VideoCaption: Awaited<VideoCaptionModel>

  @ForeignKey(() => VideoChannelCollaboratorModel)
  @Column
  declare channelCollaboratorId: number

  @BelongsTo(() => VideoChannelCollaboratorModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  declare VideoChannelCollaborator: Awaited<VideoChannelCollaboratorModel>

  static listForApi (options: {
    userId: number
    start: number
    count: number
    sort: string
    unread?: boolean
    typeOneOf?: UserNotificationType_Type[]
  }) {
    const { userId, start, count, sort, unread, typeOneOf } = options

    const countWhere = { userId }

    const query = {
      start,
      count,
      sort,

      userId,
      unread,
      typeOneOf
    }

    if (unread !== undefined) countWhere['read'] = !unread
    if (typeOneOf !== undefined) countWhere['type'] = { [Op.in]: typeOneOf }

    return Promise.all([
      UserNotificationModel.count({ where: countWhere })
        .then(count => count || 0),

      count === 0
        ? [] as UserNotificationModelForApi[]
        : new UserNotificationListQueryBuilder(this.sequelize, query).list<UserNotificationModelForApi>()
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static markAsRead (userId: number, notificationIds: number[]) {
    const query = {
      where: {
        userId,
        id: {
          [Op.in]: notificationIds
        },
        read: false
      }
    }

    return UserNotificationModel.update({ read: true }, query)
  }

  static markAllAsRead (userId: number) {
    const query = { where: { userId, read: false } }

    return UserNotificationModel.update({ read: true }, query)
  }

  static removeNotificationsOf (options: {
    id: number
    type: 'account' | 'server'
    forUserId?: number
  }) {
    const id = forceNumber(options.id)

    function buildAccountWhereQuery (base: string) {
      const whereSuffix = options.forUserId
        ? ` AND "userNotification"."userId" = ${options.forUserId}`
        : ''

      if (options.type === 'account') {
        return base +
          ` WHERE "account"."id" = ${id} ${whereSuffix}`
      }

      return base +
        ` WHERE "actor"."serverId" = ${id} ${whereSuffix}`
    }

    const queries = [
      // Remove notifications from muted accounts
      buildAccountWhereQuery(
        `SELECT "userNotification"."id" FROM "userNotification" ` +
          `INNER JOIN "account" ON "userNotification"."accountId" = "account"."id" ` +
          `INNER JOIN actor ON "actor"."accountId" = "account"."id" `
      ),

      // Remove notifications from muted accounts that followed ours
      buildAccountWhereQuery(
        `SELECT "userNotification"."id" FROM "userNotification" ` +
          `INNER JOIN "actorFollow" ON "actorFollow".id = "userNotification"."actorFollowId" ` +
          `INNER JOIN actor ON actor.id = "actorFollow"."actorId" ` +
          `INNER JOIN account ON account."id" = actor."accountId" `
      ),

      // Remove notifications from muted accounts that commented something
      buildAccountWhereQuery(
        `SELECT "userNotification"."id" FROM "userNotification" ` +
          `INNER JOIN "actorFollow" ON "actorFollow".id = "userNotification"."actorFollowId" ` +
          `INNER JOIN actor ON actor.id = "actorFollow"."actorId" ` +
          `INNER JOIN account ON account."id" = actor."accountId" `
      ),

      // Remove notifications of comments from muted accounts
      buildAccountWhereQuery(
        `SELECT "userNotification"."id" FROM "userNotification" ` +
          `INNER JOIN "videoComment" ON "videoComment".id = "userNotification"."commentId" ` +
          `INNER JOIN account ON account.id = "videoComment"."accountId" ` +
          `INNER JOIN actor ON "actor"."accountId" = "account"."id" `
      ),

      // Remove notifications from muted accounts that invited us to collaborate to a channel
      buildAccountWhereQuery(
        `SELECT "userNotification"."id" FROM "userNotification" ` +
          `INNER JOIN "videoChannelCollaborator" ON "videoChannelCollaborator".id = "userNotification"."channelCollaboratorId" ` +
          `INNER JOIN "videoChannel" ON "videoChannel".id = "videoChannelCollaborator"."channelId" ` +
          `INNER JOIN "account" ON "videoChannel"."accountId" = "account"."id" ` +
          `INNER JOIN actor ON "actor"."accountId" = "account"."id" `
      )
    ]

    const query = `DELETE FROM "userNotification" WHERE id IN (${queries.join(' UNION ')})`

    return UserNotificationModel.sequelize.query(query)
  }

  toFormattedJSON (this: UserNotificationModelForApi): UserNotification {
    const video = this.Video
      ? {
        ...this.formatVideo(this.Video),

        channel: this.formatActor(this.Video.VideoChannel)
      }
      : undefined

    const videoImport = this.VideoImport
      ? {
        id: this.VideoImport.id,
        video: this.VideoImport.Video
          ? this.formatVideo(this.VideoImport.Video)
          : undefined,
        torrentName: this.VideoImport.torrentName,
        magnetUri: this.VideoImport.magnetUri,
        targetUrl: this.VideoImport.targetUrl
      }
      : undefined

    const comment = this.VideoComment
      ? {
        id: this.VideoComment.id,
        threadId: this.VideoComment.getThreadId(),
        account: this.formatActor(this.VideoComment.Account),
        video: this.formatVideo(this.VideoComment.Video),
        heldForReview: this.VideoComment.heldForReview
      }
      : undefined

    const abuse = this.Abuse ? this.formatAbuse(this.Abuse) : undefined

    const videoBlacklist = this.VideoBlacklist
      ? {
        id: this.VideoBlacklist.id,
        video: this.formatVideo(this.VideoBlacklist.Video)
      }
      : undefined

    const account = this.Account ? this.formatActor(this.Account) : undefined

    const actorFollowingType = {
      Application: 'instance' as 'instance',
      Group: 'channel' as 'channel',
      Person: 'account' as 'account'
    }
    const actorFollow = this.ActorFollow
      ? {
        id: this.ActorFollow.id,
        state: this.ActorFollow.state,
        follower: {
          id: this.ActorFollow.ActorFollower.Account.id,
          displayName: this.ActorFollow.ActorFollower.Account.getDisplayName(),
          name: this.ActorFollow.ActorFollower.preferredUsername,
          host: this.ActorFollow.ActorFollower.getHost(),

          ...this.formatAvatars(this.ActorFollow.ActorFollower.Avatars)
        },
        following: {
          type: actorFollowingType[this.ActorFollow.ActorFollowing.type],
          displayName: (this.ActorFollow.ActorFollowing.VideoChannel || this.ActorFollow.ActorFollowing.Account).getDisplayName(),
          name: this.ActorFollow.ActorFollowing.preferredUsername,
          host: this.ActorFollow.ActorFollowing.getHost()
        }
      }
      : undefined

    const plugin = this.Plugin
      ? {
        name: this.Plugin.name,
        type: this.Plugin.type,
        latestVersion: this.Plugin.latestVersion
      }
      : undefined

    const peertube = this.Application
      ? { latestVersion: this.Application.latestPeerTubeVersion }
      : undefined

    const registration = this.UserRegistration
      ? { id: this.UserRegistration.id, username: this.UserRegistration.username }
      : undefined

    const videoCaption = this.VideoCaption
      ? {
        id: this.VideoCaption.id,
        language: {
          id: this.VideoCaption.language,
          label: VideoCaptionModel.getLanguageLabel(this.VideoCaption.language)
        },
        video: this.formatVideo(this.VideoCaption.Video)
      }
      : undefined

    const videoChannelCollaborator = this.VideoChannelCollaborator
      ? {
        id: this.VideoChannelCollaborator.id,
        channelOwner: this.formatActor(this.VideoChannelCollaborator.Channel.Account),
        channel: this.formatActor(this.VideoChannelCollaborator.Channel),
        account: this.formatActor(this.VideoChannelCollaborator.Account),
        state: {
          id: this.VideoChannelCollaborator.state,
          label: VideoChannelCollaboratorModel.getStateLabel(this.VideoChannelCollaborator.state)
        }
      }
      : undefined

    return {
      id: this.id,
      type: this.type,
      read: this.read,
      data: this.data,
      video,
      videoImport,
      comment,
      abuse,
      videoBlacklist,
      account,
      actorFollow,
      plugin,
      peertube,
      registration,
      videoCaption,
      videoChannelCollaborator,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    }
  }

  formatVideo (video: UserNotificationIncludes.VideoInclude) {
    return {
      id: video.id,
      uuid: video.uuid,
      shortUUID: uuidToShort(video.uuid),
      name: video.name,
      state: {
        id: video.state,
        label: getStateLabel(video.state)
      }
    }
  }

  formatAbuse (abuse: UserNotificationIncludes.AbuseInclude) {
    const commentAbuse = abuse.VideoCommentAbuse?.VideoComment
      ? {
        threadId: abuse.VideoCommentAbuse.VideoComment.getThreadId(),

        video: abuse.VideoCommentAbuse.VideoComment.Video
          ? this.formatVideo(abuse.VideoCommentAbuse.VideoComment.Video)
          : undefined
      }
      : undefined

    const videoAbuse = abuse.VideoAbuse?.Video
      ? this.formatVideo(abuse.VideoAbuse.Video)
      : undefined

    const accountAbuse = (!commentAbuse && !videoAbuse && abuse.FlaggedAccount)
      ? this.formatActor(abuse.FlaggedAccount)
      : undefined

    return {
      id: abuse.id,
      state: abuse.state,
      video: videoAbuse,
      comment: commentAbuse,
      account: accountAbuse
    }
  }

  formatActor (
    accountOrChannel: UserNotificationIncludes.AccountIncludeActor | UserNotificationIncludes.VideoChannelIncludeActor
  ) {
    return {
      id: accountOrChannel.id,
      displayName: accountOrChannel.getDisplayName(),
      name: accountOrChannel.Actor.preferredUsername,
      host: accountOrChannel.Actor.getHost(),

      ...this.formatAvatars(accountOrChannel.Actor.Avatars)
    }
  }

  formatAvatars (avatars: UserNotificationIncludes.ActorImageInclude[]) {
    if (!avatars || avatars.length === 0) return { avatar: undefined, avatars: [] }

    return {
      avatar: this.formatAvatar(maxBy(avatars, 'width')),

      avatars: avatars.map(a => this.formatAvatar(a))
    }
  }

  formatAvatar (a: UserNotificationIncludes.ActorImageInclude) {
    return {
      fileUrl: ActorImageModel.getImageUrl(a),
      path: a.getStaticPath(),
      width: a.width
    }
  }
}
