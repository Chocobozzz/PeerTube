import { UserNotificationType, UserRight } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MApplication, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export type NewPeerTubeVersionForAdminsPayload = {
  application: MApplication
  latestVersion: string
}

export class NewPeerTubeVersionForAdmins extends AbstractNotification<NewPeerTubeVersionForAdminsPayload> {
  private admins: MUserDefault[]

  async prepare () {
    // Use the debug right to know who is an administrator
    this.admins = await UserModel.listWithRight(UserRight.MANAGE_DEBUG)
  }

  log () {
    logger.info('Notifying %s admins of new PeerTube version %s.', this.admins.length, this.payload.latestVersion)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.newPeerTubeVersion
  }

  getTargetUsers () {
    return this.admins
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.NEW_PEERTUBE_VERSION,
      userId: user.id,
      applicationId: this.payload.application.id
    })
    notification.Application = this.payload.application

    return notification
  }

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }

    return {
      to,
      template: 'peertube-version-new',
      subject: t('A new PeerTube version is available: {latestVersion}', to.language, { latestVersion: this.payload.latestVersion }),
      locals: {
        latestVersion: this.payload.latestVersion
      }
    }
  }
}
