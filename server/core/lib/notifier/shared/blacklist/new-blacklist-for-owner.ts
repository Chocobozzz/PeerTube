import { UserNotificationType } from '@peertube/peertube-models'
import { tu } from '@server/helpers/i18n.js'
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

export class NewBlacklistForOwner extends AbstractNotification<MVideoBlacklistVideo> {
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

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }

    const videoName = this.payload.Video.name
    const videoUrl = WEBSERVER.URL + this.payload.Video.getWatchStaticPath()

    return {
      template: 'video-owner-blacklist-new',
      to,
      subject: tu('Your video has been blocked', user),
      locals: {
        instanceName: CONFIG.INSTANCE.NAME,
        videoName,
        reason: this.payload.reason,
        action: {
          text: tu('View video', user),
          url: videoUrl
        }
      }
    }
  }
}
