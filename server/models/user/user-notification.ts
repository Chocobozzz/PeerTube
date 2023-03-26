import { ModelIndexesOptions, Op, WhereOptions } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { getBiggestActorImage } from '@server/lib/actor-image'
import { UserNotificationIncludes, UserNotificationModelForApi } from '@server/types/models/user'
import { forceNumber } from '@shared/core-utils'
import { uuidToShort } from '@shared/extra-utils'
import { UserNotification, UserNotificationType } from '@shared/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { isBooleanValid } from '../../helpers/custom-validators/misc'
import { isUserNotificationTypeValid } from '../../helpers/custom-validators/user-notifications'
import { AbuseModel } from '../abuse/abuse'
import { AccountModel } from '../account/account'
import { ActorFollowModel } from '../actor/actor-follow'
import { ApplicationModel } from '../application/application'
import { PluginModel } from '../server/plugin'
import { throwIfNotValid } from '../shared'
import { VideoModel } from '../video/video'
import { VideoBlacklistModel } from '../video/video-blacklist'
import { VideoCommentModel } from '../video/video-comment'
import { VideoImportModel } from '../video/video-import'
import { UserNotificationListQueryBuilder } from './sql/user-notitication-list-query-builder'
import { UserModel } from './user'
import { UserRegistrationModel } from './user-registration'

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
    }
  ] as (ModelIndexesOptions & { where?: WhereOptions })[]
})
export class UserNotificationModel extends Model<Partial<AttributesOnly<UserNotificationModel>>> {

  @AllowNull(false)
  @Default(null)
  @Is('UserNotificationType', value => throwIfNotValid(value, isUserNotificationTypeValid, 'type'))
  @Column
  type: UserNotificationType

  @AllowNull(false)
  @Default(false)
  @Is('UserNotificationRead', value => throwIfNotValid(value, isBooleanValid, 'read'))
  @Column
  read: boolean

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => UserModel)
  @Column
  userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  User: UserModel

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  Video: VideoModel

  @ForeignKey(() => VideoCommentModel)
  @Column
  commentId: number

  @BelongsTo(() => VideoCommentModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  VideoComment: VideoCommentModel

  @ForeignKey(() => AbuseModel)
  @Column
  abuseId: number

  @BelongsTo(() => AbuseModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  Abuse: AbuseModel

  @ForeignKey(() => VideoBlacklistModel)
  @Column
  videoBlacklistId: number

  @BelongsTo(() => VideoBlacklistModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  VideoBlacklist: VideoBlacklistModel

  @ForeignKey(() => VideoImportModel)
  @Column
  videoImportId: number

  @BelongsTo(() => VideoImportModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  VideoImport: VideoImportModel

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  Account: AccountModel

  @ForeignKey(() => ActorFollowModel)
  @Column
  actorFollowId: number

  @BelongsTo(() => ActorFollowModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  ActorFollow: ActorFollowModel

  @ForeignKey(() => PluginModel)
  @Column
  pluginId: number

  @BelongsTo(() => PluginModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  Plugin: PluginModel

  @ForeignKey(() => ApplicationModel)
  @Column
  applicationId: number

  @BelongsTo(() => ApplicationModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  Application: ApplicationModel

  @ForeignKey(() => UserRegistrationModel)
  @Column
  userRegistrationId: number

  @BelongsTo(() => UserRegistrationModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  UserRegistration: UserRegistrationModel

  static listForApi (userId: number, start: number, count: number, sort: string, unread?: boolean) {
    const where = { userId }

    const query = {
      userId,
      unread,
      offset: start,
      limit: count,
      sort,
      where
    }

    if (unread !== undefined) query.where['read'] = !unread

    return Promise.all([
      UserNotificationModel.count({ where })
        .then(count => count || 0),

      count === 0
        ? [] as UserNotificationModelForApi[]
        : new UserNotificationListQueryBuilder(this.sequelize, query).listNotifications()
    ]).then(([ total, data ]) => ({ total, data }))
  }

  static markAsRead (userId: number, notificationIds: number[]) {
    const query = {
      where: {
        userId,
        id: {
          [Op.in]: notificationIds
        }
      }
    }

    return UserNotificationModel.update({ read: true }, query)
  }

  static markAllAsRead (userId: number) {
    const query = { where: { userId } }

    return UserNotificationModel.update({ read: true }, query)
  }

  static removeNotificationsOf (options: { id: number, type: 'account' | 'server', forUserId?: number }) {
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
      buildAccountWhereQuery(
        `SELECT "userNotification"."id" FROM "userNotification" ` +
        `INNER JOIN "account" ON "userNotification"."accountId" = "account"."id" ` +
        `INNER JOIN actor ON "actor"."id" = "account"."actorId" `
      ),

      // Remove notifications from muted accounts that followed ours
      buildAccountWhereQuery(
        `SELECT "userNotification"."id" FROM "userNotification" ` +
        `INNER JOIN "actorFollow" ON "actorFollow".id = "userNotification"."actorFollowId" ` +
        `INNER JOIN actor ON actor.id = "actorFollow"."actorId" ` +
        `INNER JOIN account ON account."actorId" = actor.id `
      ),

      // Remove notifications from muted accounts that commented something
      buildAccountWhereQuery(
        `SELECT "userNotification"."id" FROM "userNotification" ` +
        `INNER JOIN "actorFollow" ON "actorFollow".id = "userNotification"."actorFollowId" ` +
        `INNER JOIN actor ON actor.id = "actorFollow"."actorId" ` +
        `INNER JOIN account ON account."actorId" = actor.id `
      ),

      buildAccountWhereQuery(
        `SELECT "userNotification"."id" FROM "userNotification" ` +
        `INNER JOIN "videoComment" ON "videoComment".id = "userNotification"."commentId" ` +
        `INNER JOIN account ON account.id = "videoComment"."accountId" ` +
        `INNER JOIN actor ON "actor"."id" = "account"."actorId" `
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
        video: this.formatVideo(this.VideoComment.Video)
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

    return {
      id: this.id,
      type: this.type,
      read: this.read,
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
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    }
  }

  formatVideo (video: UserNotificationIncludes.VideoInclude) {
    return {
      id: video.id,
      uuid: video.uuid,
      shortUUID: uuidToShort(video.uuid),
      name: video.name
    }
  }

  formatAbuse (abuse: UserNotificationIncludes.AbuseInclude) {
    const commentAbuse = abuse.VideoCommentAbuse?.VideoComment
      ? {
        threadId: abuse.VideoCommentAbuse.VideoComment.getThreadId(),

        video: abuse.VideoCommentAbuse.VideoComment.Video
          ? {
            id: abuse.VideoCommentAbuse.VideoComment.Video.id,
            name: abuse.VideoCommentAbuse.VideoComment.Video.name,
            shortUUID: uuidToShort(abuse.VideoCommentAbuse.VideoComment.Video.uuid),
            uuid: abuse.VideoCommentAbuse.VideoComment.Video.uuid
          }
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
      avatar: this.formatAvatar(getBiggestActorImage(avatars)),

      avatars: avatars.map(a => this.formatAvatar(a))
    }
  }

  formatAvatar (a: UserNotificationIncludes.ActorImageInclude) {
    return {
      path: a.getStaticPath(),
      width: a.width
    }
  }
}
