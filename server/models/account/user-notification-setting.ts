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
import { MNotificationSettingFormattable } from '@server/types/models'
import { UserNotificationSetting, UserNotificationSettingValue } from '../../../shared/models/users/user-notification-setting.model'
import { isUserNotificationSettingValid } from '../../helpers/custom-validators/user-notifications'
import { clearCacheByUserId } from '../../lib/oauth-model'
import { throwIfNotValid } from '../utils'
import { UserModel } from './user'

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
    'UserNotificationSettingAbuseAsModerator',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'abuseAsModerator')
  )
  @Column
  abuseAsModerator: UserNotificationSettingValue

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

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingAbuseStateChange',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'abuseStateChange')
  )
  @Column
  abuseStateChange: UserNotificationSettingValue

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingAbuseNewMessage',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'abuseNewMessage')
  )
  @Column
  abuseNewMessage: UserNotificationSettingValue

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
      abuseAsModerator: this.abuseAsModerator,
      videoAutoBlacklistAsModerator: this.videoAutoBlacklistAsModerator,
      blacklistOnMyVideo: this.blacklistOnMyVideo,
      myVideoPublished: this.myVideoPublished,
      myVideoImportFinished: this.myVideoImportFinished,
      newUserRegistration: this.newUserRegistration,
      commentMention: this.commentMention,
      newFollow: this.newFollow,
      newInstanceFollower: this.newInstanceFollower,
      autoInstanceFollowing: this.autoInstanceFollowing,
      abuseNewMessage: this.abuseNewMessage,
      abuseStateChange: this.abuseStateChange
    }
  }
}
