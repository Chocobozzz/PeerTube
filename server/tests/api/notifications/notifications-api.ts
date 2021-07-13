/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  CheckerBaseParams,
  checkNewVideoFromSubscription,
  cleanupTests,
  getAllNotificationsSettings,
  MockSmtpServer,
  prepareNotificationsTest,
  ServerInfo,
  uploadRandomVideo,
  waitJobs
} from '@shared/extra-utils'
import { UserNotification, UserNotificationSettingValue } from '@shared/models'

const expect = chai.expect

describe('Test notifications API', function () {
  let server: ServerInfo
  let userNotifications: UserNotification[] = []
  let userToken: string
  let emails: object[] = []

  before(async function () {
    this.timeout(120000)

    const res = await prepareNotificationsTest(1)
    emails = res.emails
    userToken = res.userAccessToken
    userNotifications = res.userNotifications
    server = res.servers[0]

    await server.subscriptionsCommand.add({ token: userToken, targetUri: 'root_channel@localhost:' + server.port })

    for (let i = 0; i < 10; i++) {
      await uploadRandomVideo(server, false)
    }

    await waitJobs([ server ])
  })

  describe('Mark as read', function () {

    it('Should mark as read some notifications', async function () {
      const { data } = await server.notificationsCommand.list({ token: userToken, start: 2, count: 3 })
      const ids = data.map(n => n.id)

      await server.notificationsCommand.markAsRead({ token: userToken, ids })
    })

    it('Should have the notifications marked as read', async function () {
      const { data } = await server.notificationsCommand.list({ token: userToken, start: 0, count: 10 })

      expect(data[0].read).to.be.false
      expect(data[1].read).to.be.false
      expect(data[2].read).to.be.true
      expect(data[3].read).to.be.true
      expect(data[4].read).to.be.true
      expect(data[5].read).to.be.false
    })

    it('Should only list read notifications', async function () {
      const { data } = await server.notificationsCommand.list({ token: userToken, start: 0, count: 10, unread: false })

      for (const notification of data) {
        expect(notification.read).to.be.true
      }
    })

    it('Should only list unread notifications', async function () {
      const { data } = await server.notificationsCommand.list({ token: userToken, start: 0, count: 10, unread: true })

      for (const notification of data) {
        expect(notification.read).to.be.false
      }
    })

    it('Should mark as read all notifications', async function () {
      await server.notificationsCommand.markAsReadAll({ token: userToken })

      const body = await server.notificationsCommand.list({ token: userToken, start: 0, count: 10, unread: true })

      expect(body.total).to.equal(0)
      expect(body.data).to.have.lengthOf(0)
    })
  })

  describe('Notification settings', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: server,
        emails,
        socketNotifications: userNotifications,
        token: userToken
      }
    })

    it('Should not have notifications', async function () {
      this.timeout(20000)

      await server.notificationsCommand.updateMySettings({
        token: userToken,
        settings: { ...getAllNotificationsSettings(), newVideoFromSubscription: UserNotificationSettingValue.NONE }
      })

      {
        const info = await server.usersCommand.getMyInfo({ token: userToken })
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.NONE)
      }

      const { name, uuid } = await uploadRandomVideo(server)

      const check = { web: true, mail: true }
      await checkNewVideoFromSubscription({ ...baseParams, check }, name, uuid, 'absence')
    })

    it('Should only have web notifications', async function () {
      this.timeout(20000)

      await server.notificationsCommand.updateMySettings({
        token: userToken,
        settings: { ...getAllNotificationsSettings(), newVideoFromSubscription: UserNotificationSettingValue.WEB }
      })

      {
        const info = await server.usersCommand.getMyInfo({ token: userToken })
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.WEB)
      }

      const { name, uuid } = await uploadRandomVideo(server)

      {
        const check = { mail: true, web: false }
        await checkNewVideoFromSubscription({ ...baseParams, check }, name, uuid, 'absence')
      }

      {
        const check = { mail: false, web: true }
        await checkNewVideoFromSubscription({ ...baseParams, check }, name, uuid, 'presence')
      }
    })

    it('Should only have mail notifications', async function () {
      this.timeout(20000)

      await server.notificationsCommand.updateMySettings({
        token: userToken,
        settings: { ...getAllNotificationsSettings(), newVideoFromSubscription: UserNotificationSettingValue.EMAIL }
      })

      {
        const info = await server.usersCommand.getMyInfo({ token: userToken })
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.EMAIL)
      }

      const { name, uuid } = await uploadRandomVideo(server)

      {
        const check = { mail: false, web: true }
        await checkNewVideoFromSubscription({ ...baseParams, check }, name, uuid, 'absence')
      }

      {
        const check = { mail: true, web: false }
        await checkNewVideoFromSubscription({ ...baseParams, check }, name, uuid, 'presence')
      }
    })

    it('Should have email and web notifications', async function () {
      this.timeout(20000)

      await server.notificationsCommand.updateMySettings({
        token: userToken,
        settings: {
          ...getAllNotificationsSettings(),
          newVideoFromSubscription: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL
        }
      })

      {
        const info = await server.usersCommand.getMyInfo({ token: userToken })
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
