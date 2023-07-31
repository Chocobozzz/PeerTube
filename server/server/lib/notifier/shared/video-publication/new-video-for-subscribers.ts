import { logger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { UserModel } from '@server/models/user/user.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { MUserWithNotificationSetting, MVideoAccountLight, UserNotificationModelForApi } from '@server/types/models/index.js'
import { UserNotificationType, VideoPrivacy, VideoState } from '@peertube/peertube-models'
import { AbstractNotification } from '../common/abstract-notification.js'

export class NewVideoForSubscribers extends AbstractNotification <MVideoAccountLight> {
  private users: MUserWithNotificationSetting[]

  async prepare () {
    // List all followers that are users
    this.users = await UserModel.listUserSubscribersOf(this.payload.VideoChannel.actorId)
  }

  log () {
    logger.info('Notifying %d users of new video %s.', this.users.length, this.payload.url)
  }

  isDisabled () {
    return this.payload.privacy !== VideoPrivacy.PUBLIC || this.payload.state !== VideoState.PUBLISHED || this.payload.isBlacklisted()
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.newVideoFromSubscription
  }

  getTargetUsers () {
    return this.users
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.NEW_VIDEO_FROM_SUBSCRIPTION,
      userId: user.id,
      videoId: this.payload.id
    })
    notification.Video = this.payload

    return notification
  }

  createEmail (to: string) {
    const channelName = this.payload.VideoChannel.getDisplayName()
    const videoUrl = WEBSERVER.URL + this.payload.getWatchStaticPath()

    return {
      to,
      subject: channelName + ' just published a new video',
      text: `Your subscription ${channelName} just published a new video: "${this.payload.name}".`,
      locals: {
        title: 'New content ',
        action: {
          text: 'View video',
          url: videoUrl
        }
      }
    }
  }
}
