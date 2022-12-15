import { logger } from '@server/helpers/logger'
import { WEBSERVER } from '@server/initializers/constants'
import { UserModel } from '@server/models/user/user'
import { UserNotificationModel } from '@server/models/user/user-notification'
import { MUserDefault, MUserWithNotificationSetting, MVideoFullLight, UserNotificationModelForApi } from '@server/types/models'
import { UserNotificationType } from '@shared/models'
import { AbstractNotification } from '../common/abstract-notification'

export class StudioEditionFinishedForOwner extends AbstractNotification <MVideoFullLight> {
  private user: MUserDefault

  async prepare () {
    this.user = await UserModel.loadByVideoId(this.payload.id)
  }

  log () {
    logger.info('Notifying user %s its video studio edition %s is finished.', this.user.username, this.payload.url)
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
      type: UserNotificationType.MY_VIDEO_STUDIO_EDITION_FINISHED,
      userId: user.id,
      videoId: this.payload.id
    })
    notification.Video = this.payload

    return notification
  }

  createEmail (to: string) {
    const videoUrl = WEBSERVER.URL + this.payload.getWatchStaticPath()

    return {
      to,
      subject: `Edition of your video ${this.payload.name} has finished`,
      text: `Edition of your video ${this.payload.name} has finished.`,
      locals: {
        title: 'Video edition has finished',
        action: {
          text: 'View video',
          url: videoUrl
        }
      }
    }
  }
}
