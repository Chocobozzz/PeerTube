import { logger } from '@server/helpers/logger'
import { WEBSERVER } from '@server/initializers/constants'
import { isBlockedByServerOrAccount } from '@server/lib/blocklist'
import { UserModel } from '@server/models/user/user'
import { UserNotificationModel } from '@server/models/user/user-notification'
import { MActorFollowFull, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models'
import { UserNotificationType, UserRight } from '@shared/models'
import { AbstractNotification } from '../common/abstract-notification'

export class FollowForInstance extends AbstractNotification <MActorFollowFull> {
  private admins: MUserDefault[]

  async prepare () {
    this.admins = await UserModel.listWithRight(UserRight.MANAGE_SERVER_FOLLOW)
  }

  isDisabled () {
    const follower = Object.assign(this.actorFollow.ActorFollower.Account, { Actor: this.actorFollow.ActorFollower })

    return isBlockedByServerOrAccount(follower)
  }

  log () {
    logger.info('Notifying %d administrators of new instance follower: %s.', this.admins.length, this.actorFollow.ActorFollower.url)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.newInstanceFollower
  }

  getTargetUsers () {
    return this.admins
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.NEW_INSTANCE_FOLLOWER,
      userId: user.id,
      actorFollowId: this.actorFollow.id
    })
    notification.ActorFollow = this.actorFollow

    return notification
  }

  createEmail (to: string) {
    const awaitingApproval = this.actorFollow.state === 'pending'
      ? ' awaiting manual approval.'
      : ''

    return {
      to,
      subject: 'New instance follower',
      text: `Your instance has a new follower: ${this.actorFollow.ActorFollower.url}${awaitingApproval}.`,
      locals: {
        title: 'New instance follower',
        action: {
          text: 'Review followers',
          url: WEBSERVER.URL + '/admin/follows/followers-list'
        }
      }
    }
  }

  private get actorFollow () {
    return this.payload
  }
}
