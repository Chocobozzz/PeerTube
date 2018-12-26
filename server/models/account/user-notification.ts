import { AllowNull, BelongsTo, Column, CreatedAt, Default, ForeignKey, Is, Model, Scopes, Table, UpdatedAt } from 'sequelize-typescript'
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

enum ScopeNames {
  WITH_ALL = 'WITH_ALL'
}

@Scopes({
  [ScopeNames.WITH_ALL]: {
    include: [
      {
        attributes: [ 'id', 'uuid', 'name' ],
        model: () => VideoModel.unscoped(),
        required: false,
        include: [
          {
            required: true,
            attributes: [ 'id', 'name' ],
            model: () => VideoChannelModel.unscoped()
          }
        ]
      },
      {
        attributes: [ 'id' ],
        model: () => VideoCommentModel.unscoped(),
        required: false,
        include: [
          {
            required: true,
            attributes: [ 'id', 'name' ],
            model: () => AccountModel.unscoped()
          },
          {
            required: true,
            attributes: [ 'id', 'uuid', 'name' ],
            model: () => VideoModel.unscoped()
          }
        ]
      },
      {
        attributes: [ 'id' ],
        model: () => VideoAbuseModel.unscoped(),
        required: false,
        include: [
          {
            required: true,
            attributes: [ 'id', 'uuid', 'name' ],
            model: () => VideoModel.unscoped()
          }
        ]
      },
      {
        attributes: [ 'id' ],
        model: () => VideoBlacklistModel.unscoped(),
        required: false,
        include: [
          {
            required: true,
            attributes: [ 'id', 'uuid', 'name' ],
            model: () => VideoModel.unscoped()
          }
        ]
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

  static listForApi (userId: number, start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        userId
      }
    }

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
    const video = this.Video ? {
      id: this.Video.id,
      uuid: this.Video.uuid,
      name: this.Video.name,
      channel: {
        id: this.Video.VideoChannel.id,
        displayName: this.Video.VideoChannel.getDisplayName()
      }
    } : undefined

    const comment = this.Comment ? {
      id: this.Comment.id,
      account: {
        id: this.Comment.Account.id,
        displayName: this.Comment.Account.getDisplayName()
      },
      video: {
        id: this.Comment.Video.id,
        uuid: this.Comment.Video.uuid,
        name: this.Comment.Video.name
      }
    } : undefined

    const videoAbuse = this.VideoAbuse ? {
      id: this.VideoAbuse.id,
      video: {
        id: this.VideoAbuse.Video.id,
        uuid: this.VideoAbuse.Video.uuid,
        name: this.VideoAbuse.Video.name
      }
    } : undefined

    const videoBlacklist = this.VideoBlacklist ? {
      id: this.VideoBlacklist.id,
      video: {
        id: this.VideoBlacklist.Video.id,
        uuid: this.VideoBlacklist.Video.uuid,
        name: this.VideoBlacklist.Video.name
      }
    } : undefined

    return {
      id: this.id,
      type: this.type,
      read: this.read,
      video,
      comment,
      videoAbuse,
      videoBlacklist,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    }
  }
}
