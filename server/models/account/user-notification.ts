import { FindOptions, ModelIndexesOptions, Op, WhereOptions } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, Is, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
import { UserNotificationIncludes, UserNotificationModelForApi } from '@server/types/models/user'
import { UserNotification, UserNotificationType } from '../../../shared'
import { isBooleanValid } from '../../helpers/custom-validators/misc'
import { isUserNotificationTypeValid } from '../../helpers/custom-validators/user-notifications'
import { AbuseModel } from '../abuse/abuse'
import { VideoAbuseModel } from '../abuse/video-abuse'
import { VideoCommentAbuseModel } from '../abuse/video-comment-abuse'
import { ActorModel } from '../activitypub/actor'
import { ActorFollowModel } from '../activitypub/actor-follow'
import { AvatarModel } from '../avatar/avatar'
import { ServerModel } from '../server/server'
import { getSort, throwIfNotValid } from '../utils'
import { VideoModel } from '../video/video'
import { VideoBlacklistModel } from '../video/video-blacklist'
import { VideoChannelModel } from '../video/video-channel'
import { VideoCommentModel } from '../video/video-comment'
import { VideoImportModel } from '../video/video-import'
import { AccountModel } from './account'
import { UserModel } from './user'

enum ScopeNames {
  WITH_ALL = 'WITH_ALL'
}

function buildActorWithAvatarInclude () {
  return {
    attributes: [ 'preferredUsername' ],
    model: ActorModel.unscoped(),
    required: true,
    include: [
      {
        attributes: [ 'filename' ],
        model: AvatarModel.unscoped(),
        required: false
      },
      {
        attributes: [ 'host' ],
        model: ServerModel.unscoped(),
        required: false
      }
    ]
  }
}

function buildVideoInclude (required: boolean) {
  return {
    attributes: [ 'id', 'uuid', 'name' ],
    model: VideoModel.unscoped(),
    required
  }
}

function buildChannelInclude (required: boolean, withActor = false) {
  return {
    required,
    attributes: [ 'id', 'name' ],
    model: VideoChannelModel.unscoped(),
    include: withActor === true ? [ buildActorWithAvatarInclude() ] : []
  }
}

function buildAccountInclude (required: boolean, withActor = false) {
  return {
    required,
    attributes: [ 'id', 'name' ],
    model: AccountModel.unscoped(),
    include: withActor === true ? [ buildActorWithAvatarInclude() ] : []
  }
}

@Scopes(() => ({
  [ScopeNames.WITH_ALL]: {
    include: [
      Object.assign(buildVideoInclude(false), {
        include: [ buildChannelInclude(true, true) ]
      }),

      {
        attributes: [ 'id', 'originCommentId' ],
        model: VideoCommentModel.unscoped(),
        required: false,
        include: [
          buildAccountInclude(true, true),
          buildVideoInclude(true)
        ]
      },

      {
        attributes: [ 'id', 'state' ],
        model: AbuseModel.unscoped(),
        required: false,
        include: [
          {
            attributes: [ 'id' ],
            model: VideoAbuseModel.unscoped(),
            required: false,
            include: [ buildVideoInclude(true) ]
          },
          {
            attributes: [ 'id' ],
            model: VideoCommentAbuseModel.unscoped(),
            required: false,
            include: [
              {
                attributes: [ 'id', 'originCommentId' ],
                model: VideoCommentModel,
                required: true,
                include: [
                  {
                    attributes: [ 'id', 'name', 'uuid' ],
                    model: VideoModel.unscoped(),
                    required: true
                  }
                ]
              }
            ]
          },
          {
            model: AccountModel,
            as: 'FlaggedAccount',
            required: true,
            include: [ buildActorWithAvatarInclude() ]
          }
        ]
      },

      {
        attributes: [ 'id' ],
        model: VideoBlacklistModel.unscoped(),
        required: false,
        include: [ buildVideoInclude(true) ]
      },

      {
        attributes: [ 'id', 'magnetUri', 'targetUrl', 'torrentName' ],
        model: VideoImportModel.unscoped(),
        required: false,
        include: [ buildVideoInclude(false) ]
      },

      {
        attributes: [ 'id', 'state' ],
        model: ActorFollowModel.unscoped(),
        required: false,
        include: [
          {
            attributes: [ 'preferredUsername' ],
            model: ActorModel.unscoped(),
            required: true,
            as: 'ActorFollower',
            include: [
              {
                attributes: [ 'id', 'name' ],
                model: AccountModel.unscoped(),
                required: true
              },
              {
                attributes: [ 'filename' ],
                model: AvatarModel.unscoped(),
                required: false
              },
              {
                attributes: [ 'host' ],
                model: ServerModel.unscoped(),
                required: false
              }
            ]
          },
          {
            attributes: [ 'preferredUsername', 'type' ],
            model: ActorModel.unscoped(),
            required: true,
            as: 'ActorFollowing',
            include: [
              buildChannelInclude(false),
              buildAccountInclude(false),
              {
                attributes: [ 'host' ],
                model: ServerModel.unscoped(),
                required: false
              }
            ]
          }
        ]
      },

      buildAccountInclude(false, true)
    ]
  }
}))
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
    }
  ] as (ModelIndexesOptions & { where?: WhereOptions })[]
})
export class UserNotificationModel extends Model<UserNotificationModel> {

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
  Comment: VideoCommentModel

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

  static listForApi (userId: number, start: number, count: number, sort: string, unread?: boolean) {
    const where = { userId }

    const query: FindOptions = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where
    }

    if (unread !== undefined) query.where['read'] = !unread

    return Promise.all([
      UserNotificationModel.count({ where })
        .then(count => count || 0),

      count === 0
        ? []
        : UserNotificationModel.scope(ScopeNames.WITH_ALL).findAll(query)
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

  toFormattedJSON (this: UserNotificationModelForApi): UserNotification {
    const video = this.Video
      ? Object.assign(this.formatVideo(this.Video), { channel: this.formatActor(this.Video.VideoChannel) })
      : undefined

    const videoImport = this.VideoImport ? {
      id: this.VideoImport.id,
      video: this.VideoImport.Video ? this.formatVideo(this.VideoImport.Video) : undefined,
      torrentName: this.VideoImport.torrentName,
      magnetUri: this.VideoImport.magnetUri,
      targetUrl: this.VideoImport.targetUrl
    } : undefined

    const comment = this.Comment ? {
      id: this.Comment.id,
      threadId: this.Comment.getThreadId(),
      account: this.formatActor(this.Comment.Account),
      video: this.formatVideo(this.Comment.Video)
    } : undefined

    const abuse = this.Abuse ? this.formatAbuse(this.Abuse) : undefined

    const videoBlacklist = this.VideoBlacklist ? {
      id: this.VideoBlacklist.id,
      video: this.formatVideo(this.VideoBlacklist.Video)
    } : undefined

    const account = this.Account ? this.formatActor(this.Account) : undefined

    const actorFollowingType = {
      Application: 'instance' as 'instance',
      Group: 'channel' as 'channel',
      Person: 'account' as 'account'
    }
    const actorFollow = this.ActorFollow ? {
      id: this.ActorFollow.id,
      state: this.ActorFollow.state,
      follower: {
        id: this.ActorFollow.ActorFollower.Account.id,
        displayName: this.ActorFollow.ActorFollower.Account.getDisplayName(),
        name: this.ActorFollow.ActorFollower.preferredUsername,
        avatar: this.ActorFollow.ActorFollower.Avatar ? { path: this.ActorFollow.ActorFollower.Avatar.getStaticPath() } : undefined,
        host: this.ActorFollow.ActorFollower.getHost()
      },
      following: {
        type: actorFollowingType[this.ActorFollow.ActorFollowing.type],
        displayName: (this.ActorFollow.ActorFollowing.VideoChannel || this.ActorFollow.ActorFollowing.Account).getDisplayName(),
        name: this.ActorFollow.ActorFollowing.preferredUsername,
        host: this.ActorFollow.ActorFollowing.getHost()
      }
    } : undefined

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
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    }
  }

  formatVideo (this: UserNotificationModelForApi, video: UserNotificationIncludes.VideoInclude) {
    return {
      id: video.id,
      uuid: video.uuid,
      name: video.name
    }
  }

  formatAbuse (this: UserNotificationModelForApi, abuse: UserNotificationIncludes.AbuseInclude) {
    const commentAbuse = abuse.VideoCommentAbuse?.VideoComment ? {
      threadId: abuse.VideoCommentAbuse.VideoComment.getThreadId(),

      video: {
        id: abuse.VideoCommentAbuse.VideoComment.Video.id,
        name: abuse.VideoCommentAbuse.VideoComment.Video.name,
        uuid: abuse.VideoCommentAbuse.VideoComment.Video.uuid
      }
    } : undefined

    const videoAbuse = abuse.VideoAbuse?.Video ? this.formatVideo(abuse.VideoAbuse.Video) : undefined

    const accountAbuse = (!commentAbuse && !videoAbuse) ? this.formatActor(abuse.FlaggedAccount) : undefined

    return {
      id: abuse.id,
      state: abuse.state,
      video: videoAbuse,
      comment: commentAbuse,
      account: accountAbuse
    }
  }

  formatActor (
    this: UserNotificationModelForApi,
    accountOrChannel: UserNotificationIncludes.AccountIncludeActor | UserNotificationIncludes.VideoChannelIncludeActor
  ) {
    const avatar = accountOrChannel.Actor.Avatar
      ? { path: accountOrChannel.Actor.Avatar.getStaticPath() }
      : undefined

    return {
      id: accountOrChannel.id,
      displayName: accountOrChannel.getDisplayName(),
      name: accountOrChannel.Actor.preferredUsername,
      host: accountOrChannel.Actor.getHost(),
      avatar
    }
  }
}
