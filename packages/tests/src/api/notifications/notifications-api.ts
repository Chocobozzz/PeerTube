/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { UserNotification, UserNotificationSettingValue, UserNotificationType } from '@peertube/peertube-models'
import { cleanupTests, PeerTubeServer, waitJobs } from '@peertube/peertube-server-commands'
import { MockSmtpServer } from '@tests/shared/mock-servers/mock-email.js'
import { checkNewVideoFromSubscription } from '@tests/shared/notifications/check-video-notifications.js'
import { getAllNotificationsSettings, prepareNotificationsTest } from '@tests/shared/notifications/notifications-common.js'
import { CheckerBaseParams } from '@tests/shared/notifications/shared/notification-checker.js'
import { expect } from 'chai'

describe('Test notifications API', function () {
  let server: PeerTubeServer
  let userNotifications: UserNotification[] = []
  let userToken: string
  let emails: object[] = []

  before(async function () {
    this.timeout(240000)

    const res = await prepareNotificationsTest(1)
    emails = res.emails
    userToken = res.userAccessToken
    userNotifications = res.userNotifications
    server = res.servers[0]

    await server.subscriptions.add({ token: userToken, targetUri: 'root_channel@' + server.host })

    for (let i = 0; i < 10; i++) {
      await server.videos.randomUpload({ wait: false })
    }

    await waitJobs([ server ])
  })

  describe('Notification list & count', function () {
    it('Should correctly list notifications', async function () {
      const { data, total } = await server.notifications.list({ token: userToken, start: 0, count: 2 })

      expect(data).to.have.lengthOf(2)
      expect(total).to.equal(10)
    })

    it('Should correctly filter notifications on its type', async function () {
      {
        const { data, total } = await server.notifications.list({
          token: userToken,
          start: 0,
          count: 2,
          typeOneOf: [ UserNotificationType.ABUSE_NEW_MESSAGE ]
        })

        expect(data).to.have.lengthOf(0)
        expect(total).to.equal(0)
      }

      {
        const { data, total } = await server.notifications.list({
          token: userToken,
          start: 0,
          count: 2,
          typeOneOf: [ UserNotificationType.ABUSE_NEW_MESSAGE, UserNotificationType.NEW_VIDEO_FROM_SUBSCRIPTION ]
        })

        console.log(data)

        expect(data).to.have.lengthOf(2)
        expect(total).to.equal(10)
      }
    })
  })

  describe('Mark as read', function () {
    it('Should mark as read some notifications', async function () {
      const { data } = await server.notifications.list({ token: userToken, start: 2, count: 3 })
      const ids = data.map(n => n.id)

      await server.notifications.markAsRead({ token: userToken, ids })
    })

    it('Should have the notifications marked as read', async function () {
      const { data } = await server.notifications.list({ token: userToken, start: 0, count: 10 })

      expect(data[0].read).to.be.false
      expect(data[1].read).to.be.false
      expect(data[2].read).to.be.true
      expect(data[3].read).to.be.true
      expect(data[4].read).to.be.true
      expect(data[5].read).to.be.false
    })

    it('Should only list read notifications', async function () {
      const { data } = await server.notifications.list({ token: userToken, start: 0, count: 10, unread: false })

      for (const notification of data) {
        expect(notification.read).to.be.true
      }
    })

    it('Should only list unread notifications', async function () {
      const { data } = await server.notifications.list({ token: userToken, start: 0, count: 10, unread: true })

      for (const notification of data) {
        expect(notification.read).to.be.false
      }
    })

    it('Should mark as read all notifications', async function () {
      await server.notifications.markAsReadAll({ token: userToken })

      const body = await server.notifications.list({ token: userToken, start: 0, count: 10, unread: true })

      expect(body.total).to.equal(0)
      expect(body.data).to.have.lengthOf(0)
    })
  })

  describe('Notification settings', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server,
        emails,
        socketNotifications: userNotifications,
        token: userToken
      }
    })

    it('Should not have notifications', async function () {
      this.timeout(40000)

      await server.notifications.updateMySettings({
        token: userToken,
        settings: { ...getAllNotificationsSettings(), newVideoFromSubscription: UserNotificationSettingValue.NONE }
      })

      {
        const info = await server.users.getMyInfo({ token: userToken })
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.NONE)
      }

      const { name, shortUUID } = await server.videos.randomUpload()

      const check = { web: true, mail: true }
      await checkNewVideoFromSubscription({ ...baseParams, check, videoName: name, shortUUID, checkType: 'absence' })
    })

    it('Should only have web notifications', async function () {
      this.timeout(20000)

      await server.notifications.updateMySettings({
        token: userToken,
        settings: { ...getAllNotificationsSettings(), newVideoFromSubscription: UserNotificationSettingValue.WEB }
      })

      {
        const info = await server.users.getMyInfo({ token: userToken })
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.WEB)
      }

      const { name, shortUUID } = await server.videos.randomUpload()

      {
        const check = { mail: true, web: false }
        await checkNewVideoFromSubscription({ ...baseParams, check, videoName: name, shortUUID, checkType: 'absence' })
      }

      {
        const check = { mail: false, web: true }
        await checkNewVideoFromSubscription({ ...baseParams, check, videoName: name, shortUUID, checkType: 'presence' })
      }
    })

    it('Should only have mail notifications', async function () {
      this.timeout(20000)

      await server.notifications.updateMySettings({
        token: userToken,
        settings: { ...getAllNotificationsSettings(), newVideoFromSubscription: UserNotificationSettingValue.EMAIL }
      })

      {
        const info = await server.users.getMyInfo({ token: userToken })
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.EMAIL)
      }

      const { name, shortUUID } = await server.videos.randomUpload()

      {
        const check = { mail: false, web: true }
        await checkNewVideoFromSubscription({ ...baseParams, check, videoName: name, shortUUID, checkType: 'absence' })
      }

      {
        const check = { mail: true, web: false }
        await checkNewVideoFromSubscription({ ...baseParams, check, videoName: name, shortUUID, checkType: 'presence' })
      }
    })

    it('Should have email and web notifications', async function () {
      this.timeout(20000)

      await server.notifications.updateMySettings({
        token: userToken,
        settings: {
          ...getAllNotificationsSettings(),
          newVideoFromSubscription: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL
        }
      })

      {
        const info = await server.users.getMyInfo({ token: userToken })
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(
          UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL
        )
      }

      const { name, shortUUID } = await server.videos.randomUpload()

      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID, checkType: 'presence' })
    })
  })

  after(async function () {
    await MockSmtpServer.Instance.kill()

    await cleanupTests([ server ])
  })
})
