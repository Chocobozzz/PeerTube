import { UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { MUserWithNotificationSetting } from '@server/types/models/index.js'
import { AbstractVideoChangeOwnershipResponse } from './abstract-video-change-ownership-response.js'

export class VideoChangeOwnershipRejected extends AbstractVideoChangeOwnershipResponse {
  log () {
    logger.info('Notifying source channel members that ownership change of %s was rejected.', this.payload.Video.url)
  }

  protected getNotificationType () {
    return UserNotificationType.VIDEO_OWNERSHIP_CHANGED_REJECTED
  }

  createEmail (user: MUserWithNotificationSetting) {
    const language = user.getLanguage()
    const to = { email: user.email, language }

    return {
      to,
      subject: t('A video ownership change request has been rejected', language),
      text: t('{nextOwner} rejected the ownership change request for {videoName}.', language, {
        nextOwner: this.payload.NextOwner.getDisplayName(),
        videoName: this.payload.Video.name
      }),
      locals: {
        action: {
          text: t('Review ownership changes', language),
          url: WEBSERVER.URL + '/my-library/ownership'
        }
      }
    }
  }
}
