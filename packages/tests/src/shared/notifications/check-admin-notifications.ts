/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { PluginType_Type, UserNotification, UserNotificationType } from '@peertube/peertube-models'
import { expect } from 'chai'
import { CheckerBaseParams, CheckerType, checkNotification } from './shared/notification-checker.js'

export async function checkNewPeerTubeVersion (
  options: CheckerBaseParams & {
    latestVersion: string
    checkType: CheckerType
  }
) {
  const { latestVersion } = options
  const notificationType = UserNotificationType.NEW_PEERTUBE_VERSION

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.peertube).to.exist
      expect(notification.peertube.latestVersion).to.equal(latestVersion)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n?.peertube?.latestVersion !== latestVersion
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']

    return text.includes(latestVersion)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}

export async function checkNewPluginVersion (
  options: CheckerBaseParams & {
    pluginType: PluginType_Type
    pluginName: string
    checkType: CheckerType
  }
) {
  const { pluginName, pluginType } = options
  const notificationType = UserNotificationType.NEW_PLUGIN_VERSION

  function notificationChecker (notification: UserNotification, checkType: CheckerType) {
    if (checkType === 'presence') {
      expect(notification).to.not.be.undefined
      expect(notification.type).to.equal(notificationType)

      expect(notification.plugin.name).to.equal(pluginName)
      expect(notification.plugin.type).to.equal(pluginType)
    } else {
      expect(notification).to.satisfy((n: UserNotification) => {
        return n?.plugin?.name !== pluginName
      })
    }
  }

  function emailNotificationFinder (email: object) {
    const text = email['text']

    return text.includes(pluginName)
  }

  await checkNotification({ ...options, notificationChecker, emailNotificationFinder })
}
