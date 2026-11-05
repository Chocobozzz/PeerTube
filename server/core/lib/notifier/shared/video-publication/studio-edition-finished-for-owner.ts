import { MailTo, UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { createLogger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserWithNotificationSetting, MVideoFull, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

const logger = createLogger()

export type StudioEditionFinishedForOwnerPayload = {
  video: MVideoFull
  success: boolean
}

export class StudioEditionFinishedForOwner extends AbstractNotification<StudioEditionFinishedForOwnerPayload> {
  private user: MUserDefault

  async prepare () {
    this.user = await UserModel.loadByVideoId(this.video.id)
  }

  log () {
    if (this.payload.success) {
      logger.info('Notifying user %s its video studio edition %s is finished.', this.user.username, this.video.url)
    } else {
      logger.info('Notifying user %s its video studio edition %s failed.', this.user.username, this.video.url)
    }
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
      type: this.payload.success
        ? UserNotificationType.MY_VIDEO_STUDIO_EDITION_FINISHED
        : UserNotificationType.MY_VIDEO_STUDIO_EDITION_ERROR,

      userId: user.id,
      videoId: this.video.id
    })
    notification.Video = this.video

    return notification
  }

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }

    if (this.payload.success) return this.createSuccessEmail(to)

    return this.createFailEmail(to)
  }

  private createSuccessEmail (to: MailTo) {
    const videoUrl = WEBSERVER.URL + this.video.getWatchStaticPath()

    return {
      to,
      subject: t('Edition of your video has finished', to.language),
      text: t('Edition of your video {videoName} has finished.', to.language, { videoName: this.video.name }),
      title: t('Video edition has finished', to.language),
      action: {
        text: t('View video', to.language),
        url: videoUrl
      }
    }
  }

  private createFailEmail (to: MailTo) {
    const videoUrl = WEBSERVER.URL + this.video.getWatchStaticPath()

    return {
      to,
      subject: t('Edition of your video has failed', to.language),
      text: t('Edition of your video {videoName} has failed.', to.language, { videoName: this.video.name }),
      title: t('Video edition failed', to.language),
      action: {
        text: t('View video', to.language),
        url: videoUrl
      }
    }
  }

  private get video () {
    return this.payload.video
  }
}
