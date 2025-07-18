import { UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserWithNotificationSetting, MVideoFullLight, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export class StudioEditionFinishedForOwner extends AbstractNotification<MVideoFullLight> {
  private user: MUserDefault

  async prepare () {
    this.user = await UserModel.loadByVideoId(this.payload.id)
  }

  log () {
    logger.info('Notifying user %s its video studio edition %s is finished.', this.user.username, this.payload.url)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.myVideoStudioEditionFinished
  }

  getTargetUsers () {
    if (!this.user) return []

    return [ this.user ]
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.MY_VIDEO_STUDIO_EDITION_FINISHED,
      userId: user.id,
      videoId: this.payload.id
    })
    notification.Video = this.payload

    return notification
  }

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }
    const videoUrl = WEBSERVER.URL + this.payload.getWatchStaticPath()

    return {
      to,
      subject: t('Edition of your video has finished', to.language),
      text: t('Edition of your video {videoName} has finished.', to.language, { videoName: this.payload.name }),
      locals: {
        title: t('Video edition has finished', to.language),
        action: {
          text: t('View video', to.language),
          url: videoUrl
        }
      }
    }
  }
}
