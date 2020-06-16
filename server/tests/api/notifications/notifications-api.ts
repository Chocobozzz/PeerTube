/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { addUserSubscription } from '@shared/extra-utils/users/user-subscriptions'
import { cleanupTests, getMyUserInformation, immutableAssign, uploadRandomVideo, waitJobs } from '../../../../shared/extra-utils'
import { ServerInfo } from '../../../../shared/extra-utils/index'
import { MockSmtpServer } from '../../../../shared/extra-utils/miscs/email'
import {
  CheckerBaseParams,
  checkNewVideoFromSubscription,
  getAllNotificationsSettings,
  getUserNotifications,
  markAsReadAllNotifications,
  markAsReadNotifications,
  prepareNotificationsTest,
  updateMyNotificationSettings
} from '../../../../shared/extra-utils/users/user-notifications'
import { User, UserNotification, UserNotificationSettingValue } from '../../../../shared/models/users'

const expect = chai.expect

describe('Test notifications API', function () {
  let server: ServerInfo
  let userNotifications: UserNotification[] = []
  let userAccessToken: string
  let emails: object[] = []

  before(async function () {
    this.timeout(120000)

    const res = await prepareNotificationsTest(1)
    emails = res.emails
    userAccessToken = res.userAccessToken
    userNotifications = res.userNotifications
    server = res.servers[0]

    await addUserSubscription(server.url, userAccessToken, 'root_channel@localhost:' + server.port)

    for (let i = 0; i < 10; i++) {
      await uploadRandomVideo(server, false)
    }

    await waitJobs([ server ])
  })

  describe('Mark as read', function () {

    it('Should mark as read some notifications', async function () {
      const res = await getUserNotifications(server.url, userAccessToken, 2, 3)
      const ids = res.body.data.map(n => n.id)

      await markAsReadNotifications(server.url, userAccessToken, ids)
    })

    it('Should have the notifications marked as read', async function () {
      const res = await getUserNotifications(server.url, userAccessToken, 0, 10)

      const notifications = res.body.data as UserNotification[]
      expect(notifications[0].read).to.be.false
      expect(notifications[1].read).to.be.false
      expect(notifications[2].read).to.be.true
      expect(notifications[3].read).to.be.true
      expect(notifications[4].read).to.be.true
      expect(notifications[5].read).to.be.false
    })

    it('Should only list read notifications', async function () {
      const res = await getUserNotifications(server.url, userAccessToken, 0, 10, false)

      const notifications = res.body.data as UserNotification[]
      for (const notification of notifications) {
        expect(notification.read).to.be.true
      }
    })

    it('Should only list unread notifications', async function () {
      const res = await getUserNotifications(server.url, userAccessToken, 0, 10, true)

      const notifications = res.body.data as UserNotification[]
      for (const notification of notifications) {
        expect(notification.read).to.be.false
      }
    })

    it('Should mark as read all notifications', async function () {
      await markAsReadAllNotifications(server.url, userAccessToken)

      const res = await getUserNotifications(server.url, userAccessToken, 0, 10, true)

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    })
  })

  describe('Notification settings', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: server,
        emails,
        socketNotifications: userNotifications,
        token: userAccessToken
      }
    })

    it('Should not have notifications', async function () {
      this.timeout(20000)

      await updateMyNotificationSettings(server.url, userAccessToken, immutableAssign(getAllNotificationsSettings(), {
        newVideoFromSubscription: UserNotificationSettingValue.NONE
      }))

      {
        const res = await getMyUserInformation(server.url, userAccessToken)
        const info = res.body as User
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.NONE)
      }

      const { name, uuid } = await uploadRandomVideo(server)

      const check = { web: true, mail: true }
      await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), name, uuid, 'absence')
    })

    it('Should only have web notifications', async function () {
      this.timeout(20000)

      await updateMyNotificationSettings(server.url, userAccessToken, immutableAssign(getAllNotificationsSettings(), {
        newVideoFromSubscription: UserNotificationSettingValue.WEB
      }))

      {
        const res = await getMyUserInformation(server.url, userAccessToken)
        const info = res.body as User
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.WEB)
      }

      const { name, uuid } = await uploadRandomVideo(server)

      {
        const check = { mail: true, web: false }
        await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), name, uuid, 'absence')
      }

      {
        const check = { mail: false, web: true }
        await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), name, uuid, 'presence')
      }
    })

    it('Should only have mail notifications', async function () {
      this.timeout(20000)

      await updateMyNotificationSettings(server.url, userAccessToken, immutableAssign(getAllNotificationsSettings(), {
        newVideoFromSubscription: UserNotificationSettingValue.EMAIL
      }))

      {
        const res = await getMyUserInformation(server.url, userAccessToken)
        const info = res.body as User
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.EMAIL)
      }

      const { name, uuid } = await uploadRandomVideo(server)

      {
        const check = { mail: false, web: true }
        await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), name, uuid, 'absence')
      }

      {
        const check = { mail: true, web: false }
        await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), name, uuid, 'presence')
      }
    })

    it('Should have email and web notifications', async function () {
      this.timeout(20000)

      await updateMyNotificationSettings(server.url, userAccessToken, immutableAssign(getAllNotificationsSettings(), {
        newVideoFromSubscription: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL
      }))

      {
        const res = await getMyUserInformation(server.url, userAccessToken)
        const info = res.body as User
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(
          UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL
        )
      }

      const { name, uuid } = await uploadRandomVideo(server)

      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
