import { logger } from '@server/helpers/logger.js'
import { t } from '@server/helpers/i18n.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { UserModel } from '@server/models/user/user.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { MUserDefault, MUserWithNotificationSetting, MVideoFullLight, UserNotificationModelForApi } from '@server/types/models/index.js'
import { UserNotificationType } from '@peertube/peertube-models'
import { AbstractNotification } from '../common/abstract-notification.js'

export abstract class AbstractOwnedVideoPublication extends AbstractNotification<MVideoFullLight> {
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

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.MY_VIDEO_PUBLISHED,
      userId: user.id,
      videoId: this.payload.id
    })
    notification.Video = this.payload

    return notification
  }

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }
    const language = user.getLanguage()

    const videoUrl = WEBSERVER.URL + this.payload.getWatchStaticPath()

    return {
      to,
      subject: t('Your video has been published', language),
      text: t('Your video {videoName} has been published.', language, { videoName: this.payload.name }),
      locals: {
        title: t('Your video is live', language),
        action: {
          text: t('View video', language),
          url: videoUrl
        }
      }
    }
  }
}
