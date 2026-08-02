import { pick } from '@peertube/peertube-core-utils'
import { UserNotificationType, UserRight } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export class AutomaticBlocklistForModerators extends AbstractNotification<{
  blockedAccountsCount: number
  blockedHostsCount: number
  unblockedAccountsCount: number
  unblockedHostsCount: number
}> {
  private moderators: MUserDefault[]

  async prepare () {
    this.moderators = await UserModel.listWithRight(UserRight.MANAGE_SERVER_BLOCKLIST_SUBSCRIPTIONS)
  }

  log () {
    logger.info(`Notifying ${this.moderators.length} moderators of automatic blocklist update`, this.payload)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.automaticBlocklist
  }

  getTargetUsers () {
    return this.moderators
  }

  createNotification (user: MUserWithNotificationSetting) {
    return UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.AUTOMATIC_BLOCKLIST_UPDATE,

      userId: user.id,

      data: pick(this.payload, [ 'blockedAccountsCount', 'blockedHostsCount', 'unblockedAccountsCount', 'unblockedHostsCount' ])
    })
  }

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }
    const language = user.getLanguage()

    const data = pick(this.payload, [ 'blockedAccountsCount', 'blockedHostsCount', 'unblockedAccountsCount', 'unblockedHostsCount' ])

    const text = t(
      'Automatic blocklist update: {blockedAccountsCount} account(s) and {blockedHostsCount} server(s) were blocked. {unblockedAccountsCount} account(s) and {unblockedHostsCount} server(s) were unblocked.',
      language,
      data
    )

    return {
      to,
      subject: t('Automatic blocklist update on {instanceName}', language, { instanceName: CONFIG.INSTANCE.NAME }),
      text
    }
  }
}
