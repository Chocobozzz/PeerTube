import { logger } from '@server/helpers/logger'
import { WEBSERVER } from '@server/initializers/constants'
import { UserModel } from '@server/models/user/user'
import { UserNotificationModel } from '@server/models/user/user-notification'
import { MUserDefault, MUserWithNotificationSetting, MVideoImportVideo, UserNotificationModelForApi } from '@server/types/models'
import { UserNotificationType } from '@shared/models'
import { AbstractNotification } from '../common/abstract-notification'

export type ImportFinishedForOwnerPayload = {
  videoImport: MVideoImportVideo
  success: boolean
}

export class ImportFinishedForOwner extends AbstractNotification <ImportFinishedForOwnerPayload> {
  private user: MUserDefault

  async prepare () {
    this.user = await UserModel.loadByVideoImportId(this.videoImport.id)
  }

  log () {
    logger.info('Notifying user %s its video import %s is finished.', this.user.username, this.videoImport.getTargetIdentifier())
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.myVideoImportFinished
  }

  getTargetUsers () {
    if (!this.user) return []

    return [ this.user ]
  }

  async createNotification (user: MUserWithNotificationSetting) {
    const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
      type: this.payload.success
        ? UserNotificationType.MY_VIDEO_IMPORT_SUCCESS
        : UserNotificationType.MY_VIDEO_IMPORT_ERROR,

      userId: user.id,
      videoImportId: this.videoImport.id
    })
    notification.VideoImport = this.videoImport

    return notification
  }

  createEmail (to: string) {
    if (this.payload.success) return this.createSuccessEmail(to)

    return this.createFailEmail(to)
  }

  private createSuccessEmail (to: string) {
    const videoUrl = WEBSERVER.URL + this.videoImport.Video.getWatchStaticPath()

    return {
      to,
      subject: `Your video import ${this.videoImport.getTargetIdentifier()} is complete`,
      text: `Your video "${this.videoImport.getTargetIdentifier()}" just finished importing.`,
      locals: {
        title: 'Import complete',
        action: {
          text: 'View video',
          url: videoUrl
        }
      }
    }
  }

  private createFailEmail (to: string) {
    const importUrl = WEBSERVER.URL + '/my-library/video-imports'

    const text =
      `Your video import "${this.videoImport.getTargetIdentifier()}" encountered an error.` +
      '\n\n' +
      `See your videos import dashboard for more information: <a href="${importUrl}">${importUrl}</a>.`

    return {
      to,
      subject: `Your video import "${this.videoImport.getTargetIdentifier()}" encountered an error`,
      text,
      locals: {
        title: 'Import failed',
        action: {
          text: 'Review imports',
          url: importUrl
        }
      }
    }
  }

  private get videoImport () {
    return this.payload.videoImport
  }
}
