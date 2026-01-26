import { UserNotificationType, UserRight } from '@peertube/peertube-models'
import { tu } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { videoAutoBlacklistUrl } from '@server/lib/client-urls.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import {
  MUserDefault,
  MUserWithNotificationSetting,
  MVideoBlacklistLightVideo,
  UserNotificationModelForApi
} from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export class NewAutoBlacklistForModerators extends AbstractNotification<MVideoBlacklistLightVideo> {
  private moderators: MUserDefault[]

  async prepare () {
    this.moderators = await UserModel.listWithRight(UserRight.MANAGE_VIDEO_BLACKLIST)
  }

  log () {
    logger.info('Notifying %s moderators of video auto-blacklist %s.', this.moderators.length, this.payload.Video.url)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.videoAutoBlacklistAsModerator
  }

  getTargetUsers () {
    return this.moderators
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.VIDEO_AUTO_BLACKLIST_FOR_MODERATORS,
      userId: user.id,
      videoBlacklistId: this.payload.id
    })
    notification.VideoBlacklist = this.payload

    return notification
  }

  async createEmail (user: MUserWithNotificationSetting) {
    const video = this.payload.Video
    const channel = await VideoChannelModel.loadAndPopulateAccount(video.channelId)

    return {
      template: 'video-auto-blacklist-new',
      to: { email: user.email, language: user.getLanguage() },
      subject: tu('A new video is pending moderation', user),
      locals: {
        channelDisplayName: channel.getDisplayName(),
        channelUrl: channel.getClientUrl(),
        videoUrl: WEBSERVER.URL + video.getWatchStaticPath(),
        videoName: video.name,
        action: {
          text: tu('Review video', user),
          url: videoAutoBlacklistUrl
        }
      }
    }
  }
}
