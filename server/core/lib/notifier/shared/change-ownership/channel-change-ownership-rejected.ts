import { UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { MUserWithNotificationSetting } from '@server/types/models/index.js'
import { AbstractChannelChangeOwnershipResponse } from './abstract-channel-change-ownership-response.js'

export class ChannelChangeOwnershipRejected extends AbstractChannelChangeOwnershipResponse {
  log () {
    logger.info(
      'Notifying source channel members that ownership change of channel %s was rejected.',
      this.payload.VideoChannel.Actor.preferredUsername
    )
  }

  protected getNotificationType () {
    return UserNotificationType.CHANNEL_OWNERSHIP_CHANGED_REJECTED
  }

  createEmail (user: MUserWithNotificationSetting) {
    const language = user.getLanguage()
    const to = { email: user.email, language }

    return {
      to,
      subject: t('A channel ownership change request has been rejected', language),
      text: t('{nextOwner} rejected the ownership change request for channel {channelName}.', language, {
        nextOwner: this.payload.NextOwner.getDisplayName(),
        channelName: this.payload.VideoChannel.name
      }),
      action: {
        text: t('View your notifications', language),
        url: WEBSERVER.URL + '/my-account/notifications'
      }
    }
  }
}
