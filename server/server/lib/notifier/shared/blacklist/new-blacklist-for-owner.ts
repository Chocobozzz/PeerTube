import { UserNotificationType } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import {
  MUserDefault,
  MUserWithNotificationSetting,
  MVideoBlacklistVideo,
  UserNotificationModelForApi
} from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export class NewBlacklistForOwner extends AbstractNotification <MVideoBlacklistVideo> {
  private user: MUserDefault

  async prepare () {
    this.user = await UserModel.loadByVideoId(this.payload.videoId)
  }

  log () {
    logger.info('Notifying user %s that its video %s has been blacklisted.', this.user.username, this.payload.Video.url)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.blacklistOnMyVideo
  }

  getTargetUsers () {
    if (!this.user) return []

    return [ this.user ]
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.BLACKLIST_ON_MY_VIDEO,
      userId: user.id,
      videoBlacklistId: this.payload.id
    })
    notification.VideoBlacklist = this.payload

    return notification
  }

  createEmail (to: string) {
    const videoName = this.payload.Video.name
    const videoUrl = WEBSERVER.URL + this.payload.Video.getWatchStaticPath()

    const reasonString = this.payload.reason ? ` for the following reason: ${this.payload.reason}` : ''
    const blockedString = `Your video ${videoName} (${videoUrl} on ${CONFIG.INSTANCE.NAME} has been blacklisted${reasonString}.`

    return {
      to,
      subject: `Video ${videoName} blacklisted`,
      text: blockedString,
      locals: {
        title: 'Your video was blacklisted'
      }
    }
  }
}
