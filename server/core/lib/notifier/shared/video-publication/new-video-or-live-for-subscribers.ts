import { UserNotificationType, VideoPrivacy, VideoState } from '@peertube/peertube-models'
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
    const channelUrl = WEBSERVER.URL + this.payload.VideoChannel.getClientUrl()
    const videoUrl = WEBSERVER.URL + this.payload.getWatchStaticPath()
    const videoName = this.payload.name
    const isLive = this.payload.isLive

    const subject = isLive
      ? t('{channelName} is live streaming', to.language, { channelName })
      : t('{channelName} just published a new video', to.language, { channelName })

    return {
      template: 'video-published-for-subscribers',
      to,
      subject,
      locals: {
        channelName,
        channelUrl,
        videoName,
        videoUrl,
        isLive,
        action: {
          text: t('View video', to.language),
          url: videoUrl
        }
      }
    }
  }
}
