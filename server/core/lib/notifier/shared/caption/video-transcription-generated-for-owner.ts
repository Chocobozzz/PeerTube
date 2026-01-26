import { UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { VIDEO_LANGUAGES, WEBSERVER } from '@server/initializers/constants.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserWithNotificationSetting, MVideoCaptionVideo, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export class VideoTranscriptionGeneratedForOwner extends AbstractNotification<MVideoCaptionVideo> {
  private user: MUserDefault

  async prepare () {
    this.user = await UserModel.loadByVideoId(this.payload.videoId)
  }

  log () {
    logger.info(
      'Notifying user %s the transcription %s of video %s is generated.',
      this.user.username,
      this.payload.language,
      this.payload.Video.url
    )
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.myVideoTranscriptionGenerated
  }

  getTargetUsers () {
    if (!this.user) return []

    return [ this.user ]
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.MY_VIDEO_TRANSCRIPTION_GENERATED,
      userId: user.id,
      videoCaptionId: this.payload.id
    })
    notification.VideoCaption = this.payload

    return notification
  }

  createEmail (user: MUserWithNotificationSetting) {
    const userLanguage = user.getLanguage()
    const to = { email: user.email, language: userLanguage }

    const video = this.payload.Video
    const videoUrl = WEBSERVER.URL + video.getWatchStaticPath()

    const language = VIDEO_LANGUAGES[this.payload.language]

    return {
      to,
      subject: t('Transcription of your video has been generated', userLanguage),
      text: t('Transcription in {language} of your video {videoName} has been generated.', userLanguage, {
        language,
        videoName: video.name
      }),
      locals: {
        action: {
          text: t('View video', userLanguage),
          url: videoUrl
        }
      }
    }
  }
}
