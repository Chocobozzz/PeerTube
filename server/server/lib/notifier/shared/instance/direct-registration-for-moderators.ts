import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { UserModel } from '@server/models/user/user.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { UserNotificationType, UserRight } from '@peertube/peertube-models'
import { AbstractNotification } from '../common/abstract-notification.js'

export class DirectRegistrationForModerators extends AbstractNotification <MUserDefault> {
  private moderators: MUserDefault[]

  async prepare () {
    this.moderators = await UserModel.listWithRight(UserRight.MANAGE_USERS)
  }

  log () {
    logger.info('Notifying %s moderators of new user registration of %s.', this.moderators.length, this.payload.username)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.newUserRegistration
  }

  getTargetUsers () {
    return this.moderators
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.NEW_USER_REGISTRATION,
      userId: user.id,
      accountId: this.payload.Account.id
    })
    notification.Account = this.payload.Account

    return notification
  }

  createEmail (to: string) {
    return {
      template: 'user-registered',
      to,
      subject: `A new user registered on ${CONFIG.INSTANCE.NAME}: ${this.payload.username}`,
      locals: {
        user: this.payload
      }
    }
  }
}
