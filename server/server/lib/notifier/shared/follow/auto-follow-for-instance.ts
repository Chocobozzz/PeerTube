import { logger } from '@server/helpers/logger.js'
import { UserModel } from '@server/models/user/user.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { MActorFollowFull, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { UserNotificationType, UserRight } from '@peertube/peertube-models'
import { AbstractNotification } from '../common/abstract-notification.js'

export class AutoFollowForInstance extends AbstractNotification <MActorFollowFull> {
  private admins: MUserDefault[]

  async prepare () {
    this.admins = await UserModel.listWithRight(UserRight.MANAGE_SERVER_FOLLOW)
  }

  log () {
    logger.info('Notifying %d administrators of auto instance following: %s.', this.admins.length, this.actorFollow.ActorFollowing.url)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.autoInstanceFollowing
  }

  getTargetUsers () {
    return this.admins
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.AUTO_INSTANCE_FOLLOWING,
      userId: user.id,
      actorFollowId: this.actorFollow.id
    })
    notification.ActorFollow = this.actorFollow

    return notification
  }

  createEmail (to: string) {
    const instanceUrl = this.actorFollow.ActorFollowing.url

    return {
      to,
      subject: 'Auto instance following',
      text: `Your instance automatically followed a new instance: <a href="${instanceUrl}">${instanceUrl}</a>.`
    }
  }

  private get actorFollow () {
    return this.payload
  }
}
