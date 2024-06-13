import { type UserNotificationSetting, type UserNotificationSettingValueType } from '@peertube/peertube-models'
import { TokensCache } from '@server/lib/auth/tokens-cache.js'
import { MNotificationSettingFormattable } from '@server/types/models/index.js'
import {
  AfterDestroy,
  AfterUpdate,
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  Default,
  ForeignKey,
  Is, Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isUserNotificationSettingValid } from '../../helpers/custom-validators/user-notifications.js'
import { SequelizeModel, throwIfNotValid } from '../shared/index.js'
import { UserModel } from './user.js'

@Table({
  tableName: 'userNotificationSetting',
  indexes: [
    {
      fields: [ 'userId' ],
      unique: true
    }
  ]
})
export class UserNotificationSettingModel extends SequelizeModel<UserNotificationSettingModel> {

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewVideoFromSubscription',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'newVideoFromSubscription')
  )
  @Column
  newVideoFromSubscription: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewCommentOnMyVideo',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'newCommentOnMyVideo')
  )
  @Column
  newCommentOnMyVideo: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingAbuseAsModerator',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'abuseAsModerator')
  )
  @Column
  abuseAsModerator: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingVideoAutoBlacklistAsModerator',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'videoAutoBlacklistAsModerator')
  )
  @Column
  videoAutoBlacklistAsModerator: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingBlacklistOnMyVideo',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'blacklistOnMyVideo')
  )
  @Column
  blacklistOnMyVideo: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingMyVideoPublished',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'myVideoPublished')
  )
  @Column
  myVideoPublished: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingMyVideoImportFinished',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'myVideoImportFinished')
  )
  @Column
  myVideoImportFinished: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewUserRegistration',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'newUserRegistration')
  )
  @Column
  newUserRegistration: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewInstanceFollower',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'newInstanceFollower')
  )
  @Column
  newInstanceFollower: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewInstanceFollower',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'autoInstanceFollowing')
  )
  @Column
  autoInstanceFollowing: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewFollow',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'newFollow')
  )
  @Column
  newFollow: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingCommentMention',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'commentMention')
  )
  @Column
  commentMention: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingAbuseStateChange',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'abuseStateChange')
  )
  @Column
  abuseStateChange: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingAbuseNewMessage',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'abuseNewMessage')
  )
  @Column
  abuseNewMessage: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewPeerTubeVersion',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'newPeerTubeVersion')
  )
  @Column
  newPeerTubeVersion: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingNewPeerPluginVersion',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'newPluginVersion')
  )
  @Column
  newPluginVersion: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingMyVideoStudioEditionFinished',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'myVideoStudioEditionFinished')
  )
  @Column
  myVideoStudioEditionFinished: UserNotificationSettingValueType

  @AllowNull(false)
  @Default(null)
  @Is(
    'UserNotificationSettingTranscriptionGeneratedForOwner',
    value => throwIfNotValid(value, isUserNotificationSettingValid, 'myVideoTranscriptionGenerated')
  )
  @Column
  myVideoTranscriptionGenerated: UserNotificationSettingValueType

  @ForeignKey(() => UserModel)
  @Column
  userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  User: Awaited<UserModel>

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AfterUpdate
  @AfterDestroy
  static removeTokenCache (instance: UserNotificationSettingModel) {
    return TokensCache.Instance.clearCacheByUserId(instance.userId)
  }

  static updateUserSettings (settings: UserNotificationSetting, userId: number) {
    const query = {
      where: {
        userId
      }
    }

    return UserNotificationSettingModel.update(settings, query)
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
      abuseStateChange: this.abuseStateChange,
      newPeerTubeVersion: this.newPeerTubeVersion,
      myVideoStudioEditionFinished: this.myVideoStudioEditionFinished,
      myVideoTranscriptionGenerated: this.myVideoTranscriptionGenerated,
      newPluginVersion: this.newPluginVersion
    }
  }
}
