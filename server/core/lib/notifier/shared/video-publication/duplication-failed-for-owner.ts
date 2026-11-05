import { UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { createLogger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserWithNotificationSetting, MVideoFull, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

const logger = createLogger()

// The payload is the duplicate, that could not receive the files of its source video
export class DuplicationFailedForOwner extends AbstractNotification<MVideoFull> {
  private user: MUserDefault

  async prepare () {
    this.user = await UserModel.loadByVideoId(this.payload.id)
  }

  log () {
    logger.info('Notifying user %s the duplication of its video in %s failed.', this.user.username, this.payload.url)
  }

  // Share the setting of the studio to not have too many notification settings
  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.myVideoStudioEditionFinished
  }

  getTargetUsers () {
    if (!this.user) return []

    return [ this.user ]
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.MY_VIDEO_DUPLICATION_ERROR,
      userId: user.id,
      videoId: this.payload.id
    })
    notification.Video = this.payload

    return notification
  }

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }

    return {
      to,
      subject: t('Duplication of your video has failed', to.language),
      text: t('The copy {videoName} of your video could not be created.', to.language, { videoName: this.payload.name }),
      title: t('Video duplication failed', to.language),
      action: {
        text: t('View video', to.language),
        url: WEBSERVER.URL + this.payload.getWatchStaticPath()
      }
    }
  }
}
