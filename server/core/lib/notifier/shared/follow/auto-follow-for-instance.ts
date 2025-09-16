import { UserNotificationType, UserRight } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { instanceFollowingUrl } from '@server/lib/client-urls.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MActorFollowFull, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export class AutoFollowForInstance extends AbstractNotification<MActorFollowFull> {
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

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }

    const subscription = this.actorFollow.ActorFollowing

    return {
      to,
      subject: t('Auto platform follow', to.language),
      text: t('Your platform automatically followed {identifier}', to.language, { identifier: subscription.getIdentifier() }),
      locals: {
        action: {
          text: t('View subscription', to.language),
          url: instanceFollowingUrl
        }
      }
    }
  }

  private get actorFollow () {
    return this.payload
  }
}
