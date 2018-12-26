import {
  AfterDestroy,
  AfterUpdate,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  Default,
  ForeignKey,
  Is,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { throwIfNotValid } from '../utils'
import { UserModel } from './user'
import { isUserNotificationSettingValid } from '../../helpers/custom-validators/user-notifications'
import { UserNotificationSetting, UserNotificationSettingValue } from '../../../shared/models/users/user-notification-setting.model'
import { clearCacheByUserId } from '../../lib/oauth-model'

@Table({
  tableName: 'userNotificationSetting',
  indexes: [
    {
      fields: [ 'userId' ],
      unique: true
    }
  ]
})
export class UserNotificationSettingModel extends Model<UserNotificationSettingModel> {

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewVideoFromSubscription',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'newVideoFromSubscription')
  )
  @Column
  newVideoFromSubscription: UserNotificationSettingValue

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewCommentOnMyVideo',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'newCommentOnMyVideo')
  )
  @Column
  newCommentOnMyVideo: UserNotificationSettingValue

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingVideoAbuseAsModerator',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'videoAbuseAsModerator')
  )
  @Column
  videoAbuseAsModerator: UserNotificationSettingValue

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingBlacklistOnMyVideo',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'blacklistOnMyVideo')
  )
  @Column
  blacklistOnMyVideo: UserNotificationSettingValue

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

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AfterUpdate
  @AfterDestroy
  static removeTokenCache (instance: UserNotificationSettingModel) {
    return clearCacheByUserId(instance.userId)
  }

  toFormattedJSON (): UserNotificationSetting {
    return {
      newCommentOnMyVideo: this.newCommentOnMyVideo,
      newVideoFromSubscription: this.newVideoFromSubscription,
      videoAbuseAsModerator: this.videoAbuseAsModerator,
      blacklistOnMyVideo: this.blacklistOnMyVideo
    }
  }
}
