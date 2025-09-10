import { PluginType, UserNotificationType, UserRight } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { getPluginUrl } from '@server/lib/client-urls.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MPlugin, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export class NewPluginVersionForAdmins extends AbstractNotification<MPlugin> {
  private admins: MUserDefault[]

  async prepare () {
    // Use the debug right to know who is an administrator
    this.admins = await UserModel.listWithRight(UserRight.MANAGE_DEBUG)
  }

  log () {
    logger.info('Notifying %s admins of new PeerTube version %s.', this.admins.length, this.payload.latestVersion)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.newPluginVersion
  }

  getTargetUsers () {
    return this.admins
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.NEW_PLUGIN_VERSION,
      userId: user.id,
      pluginId: this.plugin.id
    })
    notification.Plugin = this.plugin

    return notification
  }

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }
    const language = user.getLanguage()

    const pluginUrl = getPluginUrl(this.plugin.type)
    const context = { pluginName: this.plugin.name, latestVersion: this.plugin.latestVersion }

    return {
      to,
      template: 'plugin-version-new',

      subject: this.plugin.type === PluginType.PLUGIN
        ? t('A new version of the plugin {pluginName} is available: {latestVersion}', language, context)
        : t('A new version of the theme {pluginName} is available: {latestVersion}', language, context),

      locals: {
        pluginName: this.plugin.name,
        latestVersion: this.plugin.latestVersion,
        isPlugin: this.plugin.type === PluginType.PLUGIN,
        pluginUrl
      }
    }
  }

  private get plugin () {
    return this.payload
  }
}
