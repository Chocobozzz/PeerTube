/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  userLogin,
  waitJobs
} from '@shared/extra-utils'
import { UserNotificationType } from '@shared/models'

const expect = chai.expect

async function checkNotifications (server: ServerInfo, token: string, expected: UserNotificationType[]) {
  const { data } = await server.notificationsCommand.list({ token, start: 0, count: 10, unread: true })
  expect(data).to.have.lengthOf(expected.length)

  for (const type of expected) {
    expect(data.find(n => n.type === type)).to.exist
  }
}

describe('Test blocklist', function () {
  let servers: ServerInfo[]
  let videoUUID: string

  let userToken1: string
  let userToken2: string
  let remoteUserToken: string

  async function resetState () {
    try {
      await servers[1].subscriptionsCommand.remove({ token: remoteUserToken, uri: 'user1_channel@' + servers[0].host })
      await servers[1].subscriptionsCommand.remove({ token: remoteUserToken, uri: 'user2_channel@' + servers[0].host })
    } catch {}

    await waitJobs(servers)

    await servers[0].notificationsCommand.markAsReadAll({ token: userToken1 })
    await servers[0].notificationsCommand.markAsReadAll({ token: userToken2 })

    {
      const res = await uploadVideo(servers[0].url, userToken1, { name: 'video' })
      videoUUID = res.body.video.uuid

      await waitJobs(servers)
    }

    {
      await servers[1].commentsCommand.createThread({
        token: remoteUserToken,
        videoId: videoUUID,
        text: '@user2@' + servers[0].host + ' hello'
      })
    }

    {

      await servers[1].subscriptionsCommand.add({ token: remoteUserToken, targetUri: 'user1_channel@' + servers[0].host })
      await servers[1].subscriptionsCommand.add({ token: remoteUserToken, targetUri: 'user2_channel@' + servers[0].host })
    }

    await waitJobs(servers)
  }

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    {
      const user = { username: 'user1', password: 'password' }
      await createUser({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        username: user.username,
        password: user.password,
        videoQuota: -1,
        videoQuotaDaily: -1
      })

      userToken1 = await userLogin(servers[0], user)
      await uploadVideo(servers[0].url, userToken1, { name: 'video user 1' })
    }

    {
      const user = { username: 'user2', password: 'password' }
      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: user.username, password: user.password })

      userToken2 = await userLogin(servers[0], user)
    }

    {
      const user = { username: 'user3', password: 'password' }
      await createUser({ url: servers[1].url, accessToken: servers[1].accessToken, username: user.username, password: user.password })

      remoteUserToken = await userLogin(servers[1], user)
    }

    await doubleFollow(servers[0], servers[1])
  })

  describe('User blocks another user', function () {

    before(async function () {
      this.timeout(30000)

      await resetState()
    })

    it('Should have appropriate notifications', async function () {
      const notifs = [ UserNotificationType.NEW_COMMENT_ON_MY_VIDEO, UserNotificationType.NEW_FOLLOW ]
      await checkNotifications(servers[0], userToken1, notifs)
    })

    it('Should block an account', async function () {
      this.timeout(10000)

      await servers[0].blocklistCommand.addToMyBlocklist({ token: userToken1, account: 'user3@' + servers[1].host })
      await waitJobs(servers)
    })

    it('Should not have notifications from this account', async function () {
      await checkNotifications(servers[0], userToken1, [])
    })

    it('Should have notifications of this account on user 2', async function () {
      const notifs = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]

      await checkNotifications(servers[0], userToken2, notifs)

      await servers[0].blocklistCommand.removeFromMyBlocklist({ token: userToken1, account: 'user3@' + servers[1].host })
    })
  })

  describe('User blocks another server', function () {

    before(async function () {
      this.timeout(30000)

      await resetState()
    })

    it('Should have appropriate notifications', async function () {
      const notifs = [ UserNotificationType.NEW_COMMENT_ON_MY_VIDEO, UserNotificationType.NEW_FOLLOW ]
      await checkNotifications(servers[0], userToken1, notifs)
    })

    it('Should block an account', async function () {
      this.timeout(10000)

      await servers[0].blocklistCommand.addToMyBlocklist({ token: userToken1, server: servers[1].host })
      await waitJobs(servers)
    })

    it('Should not have notifications from this account', async function () {
      await checkNotifications(servers[0], userToken1, [])
    })

    it('Should have notifications of this account on user 2', async function () {
      const notifs = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]

      await checkNotifications(servers[0], userToken2, notifs)

      await servers[0].blocklistCommand.removeFromMyBlocklist({ token: userToken1, server: servers[1].host })
    })
  })

  describe('Server blocks a user', function () {

    before(async function () {
      this.timeout(30000)

      await resetState()
    })

    it('Should have appropriate notifications', async function () {
      {
        const notifs = [ UserNotificationType.NEW_COMMENT_ON_MY_VIDEO, UserNotificationType.NEW_FOLLOW ]
        await checkNotifications(servers[0], userToken1, notifs)
      }

      {
        const notifs = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]
        await checkNotifications(servers[0], userToken2, notifs)
      }
    })

    it('Should block an account', async function () {
      this.timeout(10000)

      await servers[0].blocklistCommand.addToServerBlocklist({ account: 'user3@' + servers[1].host })
      await waitJobs(servers)
    })

    it('Should not have notifications from this account', async function () {
      await checkNotifications(servers[0], userToken1, [])
      await checkNotifications(servers[0], userToken2, [])

      await servers[0].blocklistCommand.removeFromServerBlocklist({ account: 'user3@' + servers[1].host })
    })
  })

  describe('Server blocks a server', function () {

    before(async function () {
      this.timeout(30000)

      await resetState()
    })

    it('Should have appropriate notifications', async function () {
      {
        const notifs = [ UserNotificationType.NEW_COMMENT_ON_MY_VIDEO, UserNotificationType.NEW_FOLLOW ]
        await checkNotifications(servers[0], userToken1, notifs)
      }

      {
        const notifs = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]
        await checkNotifications(servers[0], userToken2, notifs)
      }
    })

    it('Should block an account', async function () {
      this.timeout(10000)

      await servers[0].blocklistCommand.addToServerBlocklist({ server: servers[1].host })
      await waitJobs(servers)
    })

    it('Should not have notifications from this account', async function () {
      await checkNotifications(servers[0], userToken1, [])
      await checkNotifications(servers[0], userToken2, [])
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
