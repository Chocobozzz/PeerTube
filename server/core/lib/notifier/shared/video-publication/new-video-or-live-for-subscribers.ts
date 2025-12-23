import { To, UserNotificationType, VideoPrivacy, VideoState } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserWithNotificationSetting, MVideoAccountLight, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'
import { t } from '@server/helpers/i18n.js'

export class NewVideoOrLiveForSubscribers extends AbstractNotification<MVideoAccountLight> {
  private users: MUserWithNotificationSetting[]

  async prepare () {
    // List all followers that are users
    this.users = await UserModel.listUserSubscribersOf(this.payload.VideoChannel.Actor.id)
  }

  log () {
    logger.info('Notifying %d users of new video %s.', this.users.length, this.payload.url)
  }

  isDisabled () {
    if (this.payload.privacy !== VideoPrivacy.PUBLIC && this.payload.privacy !== VideoPrivacy.INTERNAL) return true
    if (this.payload.state !== VideoState.PUBLISHED) return true
    if (this.payload.isBlacklisted()) return true

    return false
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.newVideoFromSubscription
  }

  getTargetUsers () {
    return this.users
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: this.payload.isLive
        ? UserNotificationType.NEW_LIVE_FROM_SUBSCRIPTION
        : UserNotificationType.NEW_VIDEO_FROM_SUBSCRIPTION,

      userId: user.id,
      videoId: this.payload.id
    })
    notification.Video = this.payload

    return notification
  }

  // ---------------------------------------------------------------------------

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }

    const channelName = this.payload.VideoChannel.getDisplayName()
    const videoUrl = WEBSERVER.URL + this.payload.getWatchStaticPath()

    if (this.payload.isLive) return this.createLiveEmail(to, channelName, videoUrl)

    return this.createVideoEmail(to, channelName, videoUrl)
  }

  private createVideoEmail (to: To, channelName: string, videoUrl: string) {
    return {
      to,
      subject: t('{channelName} just published a new video', to.language, { channelName }),
      text: t('Your subscription {channelName} just published a new video: {videoName}.', to.language, {
        channelName,
        videoName: this.payload.name
      }),
      locals: {
        title: t('{channelName} just published a new video', to.language, { channelName }),
        action: {
          text: t('View video', to.language),
          url: videoUrl
        }
      }
    }
  }

  private createLiveEmail (to: To, channelName: string, videoUrl: string) {
    return {
      to,
      subject: t('{channelName} is live streaming', to.language, { channelName }),
      text: t('Your subscription {channelName} is live streaming {videoName}', to.language, { channelName, videoName: this.payload.name }),
      locals: {
        action: {
          text: t('View video', to.language),
          url: videoUrl
        }
      }
    }
  }
}
