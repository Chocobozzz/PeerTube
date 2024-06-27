import { logger } from '@server/helpers/logger.js'
import { UserModel } from '@server/models/user/user.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { PluginManagePayload, PluginType, UserNotificationType } from '@peertube/peertube-models'
import { AbstractNotification } from '../common/abstract-notification.js'
import { PluginModel } from '@server/models/server/plugin.js'
import { WEBSERVER } from '@server/initializers/constants.js'

export type PluginManageFinishedPayload = {
  pluginManagePayload: PluginManagePayload
  hasError: boolean
  pluginId: number
}

export class PluginManageFinished extends AbstractNotification <PluginManageFinishedPayload> {
  private user: MUserDefault

  async prepare () {
    this.user = await UserModel.loadByIdFull(this.payload.pluginManagePayload.userId)
  }

  log () {
    logger.info('Notifying user %s its plugin %s is finished.', this.user.username, this.payload.pluginManagePayload.action)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.pluginManageFinished
  }

  getTargetUsers () {
    if (!this.user) return []

    return [ this.user ]
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.PLUGIN_MANAGE_FINISHED,
      pluginId: this.payload.pluginId,
      userId: user.id,
      hasOperationFailed: this.payload.hasError
    })

    return notification
  }

  createEmail (to: string) {
    const { hasError, pluginManagePayload } = this.payload
    const { action, npmName } = pluginManagePayload
    const pluginType = PluginModel.getTypeFromNpmName(npmName) === PluginType.PLUGIN ? 'plugin' : 'theme'
    const pluginName = PluginModel.normalizePluginName(npmName)
    const jobsUrl = WEBSERVER.URL + '/admin/system/jobs'

    if (hasError) {
      return {
        template: 'plugin-manage-failed',
        to,
        subject: `Failed to ${action} ${pluginType} ${pluginName}`,
        locals: {
          action,
          pluginName,
          pluginType,
          jobsUrl
        }
      }
    }
    const pluginUrl = WEBSERVER.URL + '/admin/plugins/list-installed?pluginType=' + pluginType
    const actionPerfect = action === 'update' ? 'updated' : action + 'ed'

    return {
      template: 'plugin-manage',
      to,
      subject: `The ${pluginType} ${pluginName} has been ${actionPerfect}`,
      locals: {
        actionPerfect,
        pluginName,
        pluginType,
        pluginUrl
      }
    }
  }
}
