import { logger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { UserModel } from '@server/models/user/user.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { MPlugin, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { UserNotificationType, UserRight } from '@peertube/peertube-models'
import { AbstractNotification } from '../common/abstract-notification.js'

export class NewPluginVersionForAdmins extends AbstractNotification <MPlugin> {
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

  createEmail (to: string) {
    const pluginUrl = WEBSERVER.URL + '/admin/settings/plugins/list-installed?pluginType=' + this.plugin.type

    return {
      to,
      template: 'plugin-version-new',
      subject: `A new plugin/theme version is available: ${this.plugin.name}@${this.plugin.latestVersion}`,
      locals: {
        pluginName: this.plugin.name,
        latestVersion: this.plugin.latestVersion,
        pluginUrl
      }
    }
  }

  private get plugin () {
    return this.payload
  }
}
