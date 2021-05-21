/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import { MockJoinPeerTubeVersions } from '@shared/extra-utils/mock-servers/joinpeertube-versions'
import { PluginType } from '@shared/models'
import { cleanupTests, installPlugin, setPluginLatestVersion, setPluginVersion, wait } from '../../../../shared/extra-utils'
import { ServerInfo } from '../../../../shared/extra-utils/index'
import { MockSmtpServer } from '../../../../shared/extra-utils/miscs/email'
import {
  CheckerBaseParams,
  checkNewPeerTubeVersion,
  checkNewPluginVersion,
  prepareNotificationsTest
} from '../../../../shared/extra-utils/users/user-notifications'
import { UserNotification, UserNotificationType } from '../../../../shared/models/users'

describe('Test admin notifications', function () {
  let server: ServerInfo
  let userNotifications: UserNotification[] = []
  let adminNotifications: UserNotification[] = []
  let emails: object[] = []
  let baseParams: CheckerBaseParams
  let joinPeerTubeServer: MockJoinPeerTubeVersions

  before(async function () {
    this.timeout(120000)

    joinPeerTubeServer = new MockJoinPeerTubeVersions()
    const port = await joinPeerTubeServer.initialize()

    const config = {
      peertube: {
        check_latest_version: {
          enabled: true,
          url: `http://localhost:${port}/versions.json`
        }
      },
      plugins: {
        index: {
          enabled: true,
          check_latest_versions_interval: '5 seconds'
        }
      }
    }

    const res = await prepareNotificationsTest(1, config)
    emails = res.emails
    server = res.servers[0]

    userNotifications = res.userNotifications
    adminNotifications = res.adminNotifications

    baseParams = {
      server: server,
      emails,
      socketNotifications: adminNotifications,
      token: server.accessToken
    }

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-plugin-hello-world'
    })

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-theme-background-red'
    })
  })

  describe('Latest PeerTube version notification', function () {

    it('Should not send a notification to admins if there is not a new version', async function () {
      this.timeout(30000)

      joinPeerTubeServer.setLatestVersion('1.4.2')

      await wait(3000)
      await checkNewPeerTubeVersion(baseParams, '1.4.2', 'absence')
    })

    it('Should send a notification to admins on new plugin version', async function () {
      this.timeout(30000)

      joinPeerTubeServer.setLatestVersion('15.4.2')

      await wait(3000)
      await checkNewPeerTubeVersion(baseParams, '15.4.2', 'presence')
    })

    it('Should not send the same notification to admins', async function () {
      this.timeout(30000)

      await wait(3000)
      expect(adminNotifications.filter(n => n.type === UserNotificationType.NEW_PEERTUBE_VERSION)).to.have.lengthOf(1)
    })

    it('Should not have sent a notification to users', async function () {
      this.timeout(30000)

      expect(userNotifications.filter(n => n.type === UserNotificationType.NEW_PEERTUBE_VERSION)).to.have.lengthOf(0)
    })

    it('Should send a new notification after a new release', async function () {
      this.timeout(30000)

      joinPeerTubeServer.setLatestVersion('15.4.3')

      await wait(3000)
      await checkNewPeerTubeVersion(baseParams, '15.4.3', 'presence')
      expect(adminNotifications.filter(n => n.type === UserNotificationType.NEW_PEERTUBE_VERSION)).to.have.lengthOf(2)
    })
  })

  describe('Latest plugin version notification', function () {

    it('Should not send a notification to admins if there is no new plugin version', async function () {
      this.timeout(30000)

      await wait(6000)
      await checkNewPluginVersion(baseParams, PluginType.PLUGIN, 'hello-world', 'absence')
    })

    it('Should send a notification to admins on new plugin version', async function () {
      this.timeout(30000)

      await setPluginVersion(server.internalServerNumber, 'hello-world', '0.0.1')
      await setPluginLatestVersion(server.internalServerNumber, 'hello-world', '0.0.1')
      await wait(6000)

      await checkNewPluginVersion(baseParams, PluginType.PLUGIN, 'hello-world', 'presence')
    })

    it('Should not send the same notification to admins', async function () {
      this.timeout(30000)

      await wait(6000)

      expect(adminNotifications.filter(n => n.type === UserNotificationType.NEW_PLUGIN_VERSION)).to.have.lengthOf(1)
    })

    it('Should not have sent a notification to users', async function () {
      expect(userNotifications.filter(n => n.type === UserNotificationType.NEW_PLUGIN_VERSION)).to.have.lengthOf(0)
    })

    it('Should send a new notification after a new plugin release', async function () {
      this.timeout(30000)

      await setPluginVersion(server.internalServerNumber, 'hello-world', '0.0.1')
      await setPluginLatestVersion(server.internalServerNumber, 'hello-world', '0.0.1')
      await wait(6000)

      expect(adminNotifications.filter(n => n.type === UserNotificationType.NEW_PEERTUBE_VERSION)).to.have.lengthOf(2)
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
