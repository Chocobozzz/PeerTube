import { logger } from '@server/helpers/logger.js'
import { UserModel } from '@server/models/user/user.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { MRegistration, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { UserNotificationType, UserRight } from '@peertube/peertube-models'
import { AbstractNotification } from '../common/abstract-notification.js'

export class RegistrationRequestForModerators extends AbstractNotification <MRegistration> {
  private moderators: MUserDefault[]

  async prepare () {
    this.moderators = await UserModel.listWithRight(UserRight.MANAGE_REGISTRATIONS)
  }

  log () {
    logger.info('Notifying %s moderators of new user registration request of %s.', this.moderators.length, this.payload.username)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.newUserRegistration
  }

  getTargetUsers () {
    return this.moderators
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.NEW_USER_REGISTRATION_REQUEST,
      userId: user.id,
      userRegistrationId: this.payload.id
    })
    notification.UserRegistration = this.payload

    return notification
  }

  createEmail (to: string) {
    return {
      template: 'user-registration-request',
      to,
      subject: `A new user wants to register: ${this.payload.username}`,
      locals: {
        registration: this.payload
      }
    }
  }
}
