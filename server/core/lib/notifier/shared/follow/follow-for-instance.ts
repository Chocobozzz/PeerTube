import { UserNotificationType, UserRight } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { isBlockedByServerOrAccount } from '@server/lib/blocklist.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MActorFollowFull, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export class FollowForInstance extends AbstractNotification<MActorFollowFull> {
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

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }
    const language = user.getLanguage()

    const context = { instanceName: CONFIG.INSTANCE.NAME, handle: this.actorFollow.ActorFollower.getIdentifier() }

    const text = this.actorFollow.state === 'pending'
      ? t('{instanceName} has a new follower, {handle}, awaiting manual approval.', language, context)
      : t('{instanceName} has a new follower: {handle}.', language, context)

    return {
      to,
      subject: t('New follower for {instanceName}', language, { instanceName: CONFIG.INSTANCE.NAME }),
      text,
      locals: {
        action: {
          text: t('Review followers', language),
          url: WEBSERVER.URL + '/admin/follows/followers-list'
        }
      }
    }
  }

  private get actorFollow () {
    return this.payload
  }
}
