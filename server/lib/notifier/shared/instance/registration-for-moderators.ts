import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { UserModel } from '@server/models/user/user'
import { UserNotificationModel } from '@server/models/user/user-notification'
import { MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models'
import { UserNotificationType, UserRight } from '@shared/models'
import { AbstractNotification } from '../common/abstract-notification'

export class RegistrationForModerators extends AbstractNotification <MUserDefault> {
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
      subject: `a new user registered on ${CONFIG.INSTANCE.NAME}: ${this.payload.username}`,
      locals: {
        user: this.payload
      }
    }
  }
}
