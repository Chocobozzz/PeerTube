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
import { MNotificationSettingFormattable } from '@server/types/models'

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
    'UserNotificationSettingVideoAutoBlacklistAsModerator',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'videoAutoBlacklistAsModerator')
  )
  @Column
  videoAutoBlacklistAsModerator: UserNotificationSettingValue

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingBlacklistOnMyVideo',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'blacklistOnMyVideo')
  )
  @Column
  blacklistOnMyVideo: UserNotificationSettingValue

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingMyVideoPublished',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'myVideoPublished')
  )
  @Column
  myVideoPublished: UserNotificationSettingValue

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingMyVideoImportFinished',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'myVideoImportFinished')
  )
  @Column
  myVideoImportFinished: UserNotificationSettingValue

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewUserRegistration',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'newUserRegistration')
  )
  @Column
  newUserRegistration: UserNotificationSettingValue

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewInstanceFollower',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'newInstanceFollower')
  )
  @Column
  newInstanceFollower: UserNotificationSettingValue

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewInstanceFollower',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'autoInstanceFollowing')
  )
  @Column
  autoInstanceFollowing: UserNotificationSettingValue

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewFollow',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'newFollow')
  )
  @Column
  newFollow: UserNotificationSettingValue

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingCommentMention',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'commentMention')
  )
  @Column
  commentMention: UserNotificationSettingValue

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

  toFormattedJSON (this: MNotificationSettingFormattable): UserNotificationSetting {
    return {
      newCommentOnMyVideo: this.newCommentOnMyVideo,
      newVideoFromSubscription: this.newVideoFromSubscription,
      videoAbuseAsModerator: this.videoAbuseAsModerator,
      videoAutoBlacklistAsModerator: this.videoAutoBlacklistAsModerator,
      blacklistOnMyVideo: this.blacklistOnMyVideo,
      myVideoPublished: this.myVideoPublished,
      myVideoImportFinished: this.myVideoImportFinished,
      newUserRegistration: this.newUserRegistration,
      commentMention: this.commentMention,
      newFollow: this.newFollow,
      newInstanceFollower: this.newInstanceFollower,
      autoInstanceFollowing: this.autoInstanceFollowing
    }
  }
}
