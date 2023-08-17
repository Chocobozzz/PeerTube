/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { UserNotificationType, UserNotificationType_Type } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

async function checkNotifications (server: PeerTubeServer, token: string, expected: UserNotificationType_Type[]) {
  const { data } = await server.notifications.list({ token, start: 0, count: 10, unread: true })
  expect(data).to.have.lengthOf(expected.length)

  for (const type of expected) {
    expect(data.find(n => n.type === type)).to.exist
  }
}

describe('Test blocklist notifications', function () {
  let servers: PeerTubeServer[]
  let videoUUID: string

  let userToken1: string
  let userToken2: string
  let remoteUserToken: string

  async function resetState () {
    try {
      await servers[1].subscriptions.remove({ token: remoteUserToken, uri: 'user1_channel@' + servers[0].host })
      await servers[1].subscriptions.remove({ token: remoteUserToken, uri: 'user2_channel@' + servers[0].host })
    } catch {}

    await waitJobs(servers)

    await servers[0].notifications.markAsReadAll({ token: userToken1 })
    await servers[0].notifications.markAsReadAll({ token: userToken2 })

    {
      const { uuid } = await servers[0].videos.upload({ token: userToken1, attributes: { name: 'video' } })
      videoUUID = uuid

      await waitJobs(servers)
    }

    {
      await servers[1].comments.createThread({
        token: remoteUserToken,
        videoId: videoUUID,
        text: '@user2@' + servers[0].host + ' hello'
      })
    }

    {

      await servers[1].subscriptions.add({ token: remoteUserToken, targetUri: 'user1_channel@' + servers[0].host })
      await servers[1].subscriptions.add({ token: remoteUserToken, targetUri: 'user2_channel@' + servers[0].host })
    }

    await waitJobs(servers)
  }

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    {
      const user = { username: 'user1', password: 'password' }
      await servers[0].users.create({
        username: user.username,
        password: user.password,
        videoQuota: -1,
        videoQuotaDaily: -1
      })

      userToken1 = await servers[0].login.getAccessToken(user)
      await servers[0].videos.upload({ token: userToken1, attributes: { name: 'video user 1' } })
    }

    {
      const user = { username: 'user2', password: 'password' }
      await servers[0].users.create({ username: user.username, password: user.password })

      userToken2 = await servers[0].login.getAccessToken(user)
    }

    {
      const user = { username: 'user3', password: 'password' }
      await servers[1].users.create({ username: user.username, password: user.password })

      remoteUserToken = await servers[1].login.getAccessToken(user)
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
      await servers[0].blocklist.addToMyBlocklist({ token: userToken1, account: 'user3@' + servers[1].host })
      await waitJobs(servers)
    })

    it('Should not have notifications from this account', async function () {
      await checkNotifications(servers[0], userToken1, [])
    })

    it('Should have notifications of this account on user 2', async function () {
      const notifs = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]

      await checkNotifications(servers[0], userToken2, notifs)

      await servers[0].blocklist.removeFromMyBlocklist({ token: userToken1, account: 'user3@' + servers[1].host })
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
      await servers[0].blocklist.addToMyBlocklist({ token: userToken1, server: servers[1].host })
      await waitJobs(servers)
    })

    it('Should not have notifications from this account', async function () {
      await checkNotifications(servers[0], userToken1, [])
    })

    it('Should have notifications of this account on user 2', async function () {
      const notifs = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]

      await checkNotifications(servers[0], userToken2, notifs)

      await servers[0].blocklist.removeFromMyBlocklist({ token: userToken1, server: servers[1].host })
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
      await servers[0].blocklist.addToServerBlocklist({ account: 'user3@' + servers[1].host })
      await waitJobs(servers)
    })

    it('Should not have notifications from this account', async function () {
      await checkNotifications(servers[0], userToken1, [])
      await checkNotifications(servers[0], userToken2, [])

      await servers[0].blocklist.removeFromServerBlocklist({ account: 'user3@' + servers[1].host })
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
      await servers[0].blocklist.addToServerBlocklist({ server: servers[1].host })
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
