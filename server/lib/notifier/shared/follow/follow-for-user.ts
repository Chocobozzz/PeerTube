import { logger } from '@server/helpers/logger'
import { isBlockedByServerOrAccount } from '@server/lib/blocklist'
import { UserModel } from '@server/models/user/user'
import { UserNotificationModel } from '@server/models/user/user-notification'
import { MActorFollowFull, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models'
import { UserNotificationType } from '@shared/models'
import { AbstractNotification } from '../common/abstract-notification'

export class FollowForUser extends AbstractNotification <MActorFollowFull> {
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
    if (this.payload.ActorFollowing.isOwned() === false) return true

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

  async createNotification (user: MUserWithNotificationSetting) {
    const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
      type: UserNotificationType.NEW_FOLLOW,
      userId: user.id,
      actorFollowId: this.actorFollow.id
    })
    notification.ActorFollow = this.actorFollow

    return notification
  }

  createEmail (to: string) {
    const following = this.actorFollow.ActorFollowing
    const follower = this.actorFollow.ActorFollower

    const followingName = (following.VideoChannel || following.Account).getDisplayName()

    return {
      template: 'follower-on-channel',
      to,
      subject: `New follower on your channel ${followingName}`,
      locals: {
        followerName: follower.Account.getDisplayName(),
        followerUrl: follower.url,
        followingName,
        followingUrl: following.url,
        followType: this.followType
      }
    }
  }

  private get actorFollow () {
    return this.payload
  }
}
