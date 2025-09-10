import { UserNotificationType, UserRight } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { adminUsersListUrl } from '@server/lib/client-urls.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export class DirectRegistrationForModerators extends AbstractNotification<MUserDefault> {
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

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }

    return {
      template: 'user-registered',
      to,
      subject: t('A new user registered on {instanceName}', to.language, { instanceName: CONFIG.INSTANCE.NAME }),
      locals: {
        userUsername: this.payload.username,
        userEmail: this.payload.email,
        userPendingEmail: this.payload.pendingEmail,
        accountUrl: this.payload.Account.getClientUrl(),
        action: {
          type: t('View users', to.language),
          url: adminUsersListUrl
        }
      }
    }
  }
}
