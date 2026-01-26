/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { UserNotification } from '@peertube/peertube-models'
import { cleanupTests, PeerTubeServer, waitJobs } from '@peertube/peertube-server-commands'
import { MockSmtpServer } from '@tests/shared/mock-servers/mock-email.js'
import { checkRegistrationRequest, checkUserRegistered } from '@tests/shared/notifications/check-moderation-notifications.js'
import { prepareNotificationsTest } from '@tests/shared/notifications/notifications-common.js'
import { CheckerBaseParams } from '@tests/shared/notifications/shared/notification-checker.js'

describe('Test registrations notifications', function () {
  let server: PeerTubeServer
  let userToken1: string

  let userNotifications: UserNotification[] = []
  let adminNotifications: UserNotification[] = []
  let emails: object[] = []

  let baseParams: CheckerBaseParams

  before(async function () {
    this.timeout(120000)

    const res = await prepareNotificationsTest(1)

    server = res.servers[0]
    emails = res.emails
    userToken1 = res.userAccessToken
    adminNotifications = res.adminNotifications
    userNotifications = res.userNotifications

    baseParams = {
      server,
      emails,
      socketNotifications: adminNotifications,
      token: server.accessToken
    }
  })

  describe('New direct registration for moderators', function () {
    before(async function () {
      await server.config.enableSignup(false)
    })

    it('Should send a notification only to moderators when a user registers on the instance', async function () {
      this.timeout(50000)

      await server.registrations.register({ username: 'user_10' })

      await waitJobs([ server ])

      await checkUserRegistered({ ...baseParams, username: 'user_10', checkType: 'presence' })

      const userOverride = { socketNotifications: userNotifications, token: userToken1, check: { web: true, mail: false } }
      await checkUserRegistered({ ...baseParams, ...userOverride, username: 'user_10', checkType: 'absence' })
    })
  })

  describe('New registration request for moderators', function () {
    before(async function () {
      await server.config.enableSignup(true)
    })

    it('Should send a notification on new registration request', async function () {
      this.timeout(50000)

      const registrationReason = 'my reason'
      await server.registrations.requestRegistration({ username: 'user_11', registrationReason })

      await waitJobs([ server ])

      await checkRegistrationRequest({ ...baseParams, username: 'user_11', registrationReason, checkType: 'presence' })

      const userOverride = { socketNotifications: userNotifications, token: userToken1, check: { web: true, mail: false } }
      await checkRegistrationRequest({ ...baseParams, ...userOverride, username: 'user_11', registrationReason, checkType: 'absence' })
    })
  })

  after(async function () {
    await MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
