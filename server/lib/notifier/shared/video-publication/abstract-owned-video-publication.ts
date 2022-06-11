import { logger } from '@server/helpers/logger'
import { WEBSERVER } from '@server/initializers/constants'
import { UserModel } from '@server/models/user/user'
import { UserNotificationModel } from '@server/models/user/user-notification'
import { MUserDefault, MUserWithNotificationSetting, MVideoFullLight, UserNotificationModelForApi } from '@server/types/models'
import { UserNotificationType } from '@shared/models'
import { AbstractNotification } from '../common/abstract-notification'

export abstract class AbstractOwnedVideoPublication extends AbstractNotification <MVideoFullLight> {
  protected user: MUserDefault

  async prepare () {
    this.user = await UserModel.loadByVideoId(this.payload.id)
  }

  log () {
    logger.info('Notifying user %s of the publication of its video %s.', this.user.username, this.payload.url)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.myVideoPublished
  }

  getTargetUsers () {
    if (!this.user) return []

    return [ this.user ]
  }

  async createNotification (user: MUserWithNotificationSetting) {
    const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
      type: UserNotificationType.MY_VIDEO_PUBLISHED,
      userId: user.id,
      videoId: this.payload.id
    })
    notification.Video = this.payload

    return notification
  }

  createEmail (to: string) {
    const videoUrl = WEBSERVER.URL + this.payload.getWatchStaticPath()

    return {
      to,
      subject: `Your video ${this.payload.name} has been published`,
      text: `Your video "${this.payload.name}" has been published.`,
      locals: {
        title: 'You video is live',
        action: {
          text: 'View video',
          url: videoUrl
        }
      }
    }
  }
}
