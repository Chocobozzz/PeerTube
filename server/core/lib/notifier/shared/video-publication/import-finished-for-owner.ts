import { To, UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { myVideoImportsUrl } from '@server/lib/client-urls.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserWithNotificationSetting, MVideoImportVideo, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export type ImportFinishedForOwnerPayload = {
  videoImport: MVideoImportVideo
  success: boolean
}

export class ImportFinishedForOwner extends AbstractNotification<ImportFinishedForOwnerPayload> {
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

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: this.payload.success
        ? UserNotificationType.MY_VIDEO_IMPORT_SUCCESS
        : UserNotificationType.MY_VIDEO_IMPORT_ERROR,

      userId: user.id,
      videoImportId: this.videoImport.id
    })
    notification.VideoImport = this.videoImport

    return notification
  }

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }

    if (this.payload.success) return this.createSuccessEmail(to)

    return this.createFailEmail(to)
  }

  private createSuccessEmail (to: To) {
    const videoUrl = WEBSERVER.URL + this.videoImport.Video.getWatchStaticPath()
    const language = to.language
    const targetId = this.videoImport.getTargetIdentifier()

    return {
      to,
      subject: t('Your video import is complete', language),
      text: t('Your video {targetId} has just finished importing.', language, { targetId }),
      locals: {
        action: {
          text: t('View video', language),
          url: videoUrl
        }
      }
    }
  }

  private createFailEmail (to: To) {
    const language = to.language
    const targetId = this.videoImport.getTargetIdentifier()

    const text = t('Your video import {targetId} encountered an error.', language, { targetId })

    return {
      to,
      subject: t('Your video import encountered an error', language),
      text,
      locals: {
        title: t('Import failed', language),
        action: {
          text: t('Review imports', language),
          url: myVideoImportsUrl
        }
      }
    }
  }

  private get videoImport () {
    return this.payload.videoImport
  }
}
