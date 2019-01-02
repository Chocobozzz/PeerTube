import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  Default,
  ForeignKey,
  IFindOptions,
  Is,
  Model,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { UserNotification, UserNotificationType } from '../../../shared'
import { getSort, throwIfNotValid } from '../utils'
import { isBooleanValid } from '../../helpers/custom-validators/misc'
import { isUserNotificationTypeValid } from '../../helpers/custom-validators/user-notifications'
import { UserModel } from './user'
import { VideoModel } from '../video/video'
import { VideoCommentModel } from '../video/video-comment'
import { Op } from 'sequelize'
import { VideoChannelModel } from '../video/video-channel'
import { AccountModel } from './account'
import { VideoAbuseModel } from '../video/video-abuse'
import { VideoBlacklistModel } from '../video/video-blacklist'
import { VideoImportModel } from '../video/video-import'

enum ScopeNames {
  WITH_ALL = 'WITH_ALL'
}

function buildVideoInclude (required: boolean) {
  return {
    attributes: [ 'id', 'uuid', 'name' ],
    model: () => VideoModel.unscoped(),
    required
  }
}

function buildChannelInclude () {
  return {
    required: true,
    attributes: [ 'id', 'name' ],
    model: () => VideoChannelModel.unscoped()
  }
}

function buildAccountInclude () {
  return {
    required: true,
    attributes: [ 'id', 'name' ],
    model: () => AccountModel.unscoped()
  }
}

@Scopes({
  [ScopeNames.WITH_ALL]: {
    include: [
      Object.assign(buildVideoInclude(false), {
        include: [ buildChannelInclude() ]
      }),
      {
        attributes: [ 'id', 'originCommentId' ],
        model: () => VideoCommentModel.unscoped(),
        required: false,
        include: [
          buildAccountInclude(),
          buildVideoInclude(true)
        ]
      },
      {
        attributes: [ 'id' ],
        model: () => VideoAbuseModel.unscoped(),
        required: false,
        include: [ buildVideoInclude(true) ]
      },
      {
        attributes: [ 'id' ],
        model: () => VideoBlacklistModel.unscoped(),
        required: false,
        include: [ buildVideoInclude(true) ]
      },
      {
        attributes: [ 'id', 'magnetUri', 'targetUrl', 'torrentName' ],
        model: () => VideoImportModel.unscoped(),
        required: false,
        include: [ buildVideoInclude(false) ]
      }
    ]
  }
})
@Table({
  tableName: 'userNotification',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'commentId' ]
    }
  ]
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

  @ForeignKey(() => VideoAbuseModel)
  @Column
  videoAbuseId: number

  @BelongsTo(() => VideoAbuseModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'cascade'
  })
  VideoAbuse: VideoAbuseModel

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

  static listForApi (userId: number, start: number, count: number, sort: string, unread?: boolean) {
    const query: IFindOptions<UserNotificationModel> = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        userId
      }
    }

    if (unread !== undefined) query.where['read'] = !unread

    return UserNotificationModel.scope(ScopeNames.WITH_ALL)
                                .findAndCountAll(query)
                                .then(({ rows, count }) => {
                                  return {
                                    data: rows,
                                    total: count
                                  }
                                })
  }

  static markAsRead (userId: number, notificationIds: number[]) {
    const query = {
      where: {
        userId,
        id: {
          [Op.any]: notificationIds
        }
      }
    }

    return UserNotificationModel.update({ read: true }, query)
  }

  toFormattedJSON (): UserNotification {
    const video = this.Video ? Object.assign(this.formatVideo(this.Video), {
      channel: {
        id: this.Video.VideoChannel.id,
        displayName: this.Video.VideoChannel.getDisplayName()
      }
    }) : undefined

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
      account: {
        id: this.Comment.Account.id,
        displayName: this.Comment.Account.getDisplayName()
      },
      video: this.formatVideo(this.Comment.Video)
    } : undefined

    const videoAbuse = this.VideoAbuse ? {
      id: this.VideoAbuse.id,
      video: this.formatVideo(this.VideoAbuse.Video)
    } : undefined

    const videoBlacklist = this.VideoBlacklist ? {
      id: this.VideoBlacklist.id,
      video: this.formatVideo(this.VideoBlacklist.Video)
    } : undefined

    return {
      id: this.id,
      type: this.type,
      read: this.read,
      video,
      videoImport,
      comment,
      videoAbuse,
      videoBlacklist,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    }
  }

  private formatVideo (video: VideoModel) {
    return {
      id: video.id,
      uuid: video.uuid,
      name: video.name
    }
  }
}
