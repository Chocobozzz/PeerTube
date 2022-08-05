import { logger } from '@server/helpers/logger'
import { UserModel } from '@server/models/user/user'
import { UserNotificationModel } from '@server/models/user/user-notification'
import { MApplication, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models'
import { UserNotificationType, UserRight } from '@shared/models'
import { AbstractNotification } from '../common/abstract-notification'

export type NewPeerTubeVersionForAdminsPayload = {
  application: MApplication
  latestVersion: string
}

export class NewPeerTubeVersionForAdmins extends AbstractNotification <NewPeerTubeVersionForAdminsPayload> {
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

  createEmail (to: string) {
    return {
      to,
      template: 'peertube-version-new',
      subject: `A new PeerTube version is available: ${this.payload.latestVersion}`,
      locals: {
        latestVersion: this.payload.latestVersion
      }
    }
  }
}
