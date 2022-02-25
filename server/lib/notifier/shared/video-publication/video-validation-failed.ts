import { logger } from '@server/helpers/logger'
import { UserModel } from '@server/models/user/user'
import { UserNotificationModel } from '@server/models/user/user-notification'
import { MUserWithNotificationSetting, MVideoAccountLight, UserNotificationModelForApi } from '@server/types/models'
import { UserNotificationType, VideoState } from '@shared/models'
import { AbstractNotification } from '../common/abstract-notification'

export class VideoValidationFailed extends AbstractNotification <MVideoAccountLight> {
  private user: MUserWithNotificationSetting

  async prepare () {
    this.user = await UserModel.loadByVideoId(this.payload.id)
  }

  log () {
    logger.info('Notifying user %d about failed transcoding for video %d.', this.user.id, this.payload.id)
  }

  isDisabled () {
    return this.payload.state === VideoState.TRANSCODING_FAILED
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.newVideoFromSubscription
  }

  getTargetUsers () {
    return [ this.user ]
  }

  async createNotification (user: MUserWithNotificationSetting) {
    const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
      type: UserNotificationType.NEW_VIDEO_FROM_SUBSCRIPTION,
      userId: user.id,
      videoId: this.payload.id
    })
    notification.Video = this.payload

    return notification
  }

  createEmail (to: string) {
    return {
      to,
      subject: 'Failed to transcode video ' + this.payload.name,
      text: `The video ${this.payload.name} failed to transcode, try to upload it again.`
    }
  }
}
