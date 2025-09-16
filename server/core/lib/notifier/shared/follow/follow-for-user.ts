import { UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { isBlockedByServerOrAccount } from '@server/lib/blocklist.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MActorFollowFull, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export class FollowForUser extends AbstractNotification<MActorFollowFull> {
  private followType: 'account' | 'channel'
  private user: MUserDefault

  async prepare () {
    // Account follows one of our account?
    this.followType = 'channel'
    this.user = await UserModel.loadByChannelActorId(this.actorFollow.ActorFollowing.id)

    // Account follows one of our channel?
    if (!this.user) {
      this.user = await UserModel.loadByAccountActorId(this.actorFollow.ActorFollowing.id)
      this.followType = 'account'
    }
  }

  async isDisabled () {
    if (this.payload.ActorFollowing.isLocal() === false) return true

    const followerAccount = this.actorFollow.ActorFollower.Account
    const followerAccountWithActor = Object.assign(followerAccount, { Actor: this.actorFollow.ActorFollower })

    return isBlockedByServerOrAccount(followerAccountWithActor, this.user.Account)
  }

  log () {
    logger.info('Notifying user %s of new follower: %s.', this.user.username, this.actorFollow.ActorFollower.Account.getDisplayName())
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.newFollow
  }

  getTargetUsers () {
    if (!this.user) return []

    return [ this.user ]
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.NEW_FOLLOW,
      userId: user.id,
      actorFollowId: this.actorFollow.id
    })
    notification.ActorFollow = this.actorFollow

    return notification
  }

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }

    const following = this.actorFollow.ActorFollowing
    const follower = this.actorFollow.ActorFollower

    const followingAccountOrChannel = Object.assign(following.VideoChannel || following.Account, { Actor: following })
    const followerAccountOrChannel = Object.assign(follower.VideoChannel || follower.Account, { Actor: follower })
    const followingName = followingAccountOrChannel.getDisplayName()

    return {
      template: 'follower-on-channel',
      to,

      subject: this.followType === 'account'
        ? t('New follower on your account {followingName}', to.language, { followingName })
        : t('New follower on your channel {followingName}', to.language, { followingName }),

      locals: {
        followerName: follower.Account.getDisplayName(),
        followerUrl: followerAccountOrChannel.getClientUrl(),
        followingUrl: followingAccountOrChannel.getClientUrl(),
        followingName,
        accountFollowType: this.followType === 'account'
      }
    }
  }

  private get actorFollow () {
    return this.payload
  }
}
