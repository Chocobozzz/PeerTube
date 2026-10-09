import { UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { createLogger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserWithNotificationSetting, MVideoFull, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

const logger = createLogger()

export class StudioNewVideoCreatedForOwner extends AbstractNotification<MVideoFull> {
  private user: MUserDefault

  async prepare () {
    this.user = await UserModel.loadByVideoId(this.payload.id)
  }

  log () {
    logger.info('Notifying user %s its new video %s created by the studio is ready.', this.user.username, this.payload.url)
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
      type: UserNotificationType.MY_VIDEO_STUDIO_NEW_VIDEO_CREATED,
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
      subject: t('Your new video has been created', to.language),
      text: t('Your new video {videoName} has been created.', to.language, { videoName: this.payload.name }),
      title: t('New video created', to.language),
      action: {
        text: t('View video', to.language),
        url: videoUrl
      }
    }
  }
}
