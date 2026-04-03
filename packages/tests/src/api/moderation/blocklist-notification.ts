/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { UserNotificationType, UserNotificationType_Type } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

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

  let userToBlockToken: string
  let remoteUserToken: string

  let collaboratorId: number
  let videoOwnershipId: number
  let channelOwnershipId: number

  const allUser1Notifications = [
    UserNotificationType.NEW_COMMENT_ON_MY_VIDEO,
    UserNotificationType.NEW_FOLLOW,
    UserNotificationType.INVITED_TO_COLLABORATE_TO_CHANNEL,
    UserNotificationType.CHANNEL_OWNERSHIP_CHANGED_REQUEST,
    UserNotificationType.VIDEO_OWNERSHIP_CHANGED_REQUEST
  ]

  async function resetState () {
    if (videoOwnershipId) {
      await servers[1].subscriptions.remove({ token: remoteUserToken, uri: 'user1_channel@' + servers[0].host })
      await servers[1].subscriptions.remove({ token: remoteUserToken, uri: 'user2_channel@' + servers[0].host })

      await servers[0].channelCollaborators.remove({ channel: 'user_to_block_channel', token: userToBlockToken, id: collaboratorId })
      await servers[0].changeOwnership.deleteVideo({ token: userToBlockToken, ownershipId: videoOwnershipId })
      await servers[0].changeOwnership.deleteChannel({ token: userToBlockToken, ownershipId: channelOwnershipId })
    }

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

    {
      const { id } = await servers[0].channelCollaborators.invite({
        channel: 'user_to_block_channel',
        token: userToBlockToken,
        target: 'user1'
      })
      collaboratorId = id
    }

    {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video', token: userToBlockToken })
      await servers[0].changeOwnership.createVideo({ token: userToBlockToken, username: 'user1', videoId: uuid })
      await servers[0].changeOwnership.createChannel({ token: userToBlockToken, username: 'user1', channelName: 'user_to_block_channel' })

      {
        const { data } = await servers[0].changeOwnership.listVideos({ token: userToBlockToken })
        videoOwnershipId = data[0].id
      }

      {
        const { data } = await servers[0].changeOwnership.listChannels({ token: userToBlockToken })
        channelOwnershipId = data[0].id
      }
    }

    await waitJobs(servers)
  }

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    userToBlockToken = await servers[0].users.generateUserAndToken('user_to_block')

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
      await checkNotifications(servers[0], userToken1, allUser1Notifications)
    })

    it('Should block a remote account', async function () {
      await servers[0].blocklist.addToMyBlocklist({ token: userToken1, account: 'user3@' + servers[1].host })
      await waitJobs(servers)
    })

    it('Should not have notifications from this remote account', async function () {
      await checkNotifications(servers[0], userToken1, [
        UserNotificationType.INVITED_TO_COLLABORATE_TO_CHANNEL,
        UserNotificationType.CHANNEL_OWNERSHIP_CHANGED_REQUEST,
        UserNotificationType.VIDEO_OWNERSHIP_CHANGED_REQUEST
      ])
    })

    it('Should block a local account', async function () {
      await servers[0].blocklist.addToMyBlocklist({ token: userToken1, account: 'user_to_block' })
      await waitJobs(servers)
    })

    it('Should not have notifications from this local account', async function () {
      await checkNotifications(servers[0], userToken1, [])
    })

    it('Should have notifications of this account on user 2', async function () {
      const notifs = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]

      await checkNotifications(servers[0], userToken2, notifs)
    })

    after(async function () {
      await servers[0].blocklist.removeFromMyBlocklist({ token: userToken1, account: 'user3@' + servers[1].host })
      await servers[0].blocklist.removeFromMyBlocklist({ token: userToken1, account: 'user_to_block' })
    })
  })

  describe('User blocks another server', function () {
    before(async function () {
      await resetState()
    })

    it('Should have appropriate notifications', async function () {
      await checkNotifications(servers[0], userToken1, allUser1Notifications)
    })

    it('Should block a server', async function () {
      await servers[0].blocklist.addToMyBlocklist({ token: userToken1, server: servers[1].host })
      await waitJobs(servers)
    })

    it('Should not have notifications from this server', async function () {
      await checkNotifications(servers[0], userToken1, [
        UserNotificationType.INVITED_TO_COLLABORATE_TO_CHANNEL,
        UserNotificationType.CHANNEL_OWNERSHIP_CHANGED_REQUEST,
        UserNotificationType.VIDEO_OWNERSHIP_CHANGED_REQUEST
      ])
    })

    it('Should have notifications of this account on user 2', async function () {
      const notifications = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]

      await checkNotifications(servers[0], userToken2, notifications)
    })

    after(async function () {
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
        await checkNotifications(servers[0], userToken1, allUser1Notifications)
      }

      {
        const notifications = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]
        await checkNotifications(servers[0], userToken2, notifications)
      }
    })

    it('Should block a remote account', async function () {
      await servers[0].blocklist.addToServerBlocklist({ account: 'user3@' + servers[1].host })
      await waitJobs(servers)
    })

    it('Should not have notifications from this remote account', async function () {
      await checkNotifications(servers[0], userToken1, [
        UserNotificationType.INVITED_TO_COLLABORATE_TO_CHANNEL,
        UserNotificationType.CHANNEL_OWNERSHIP_CHANGED_REQUEST,
        UserNotificationType.VIDEO_OWNERSHIP_CHANGED_REQUEST
      ])

      await checkNotifications(servers[0], userToken2, [])
    })

    it('Should block a local account', async function () {
      await servers[0].blocklist.addToServerBlocklist({ account: 'user_to_block' })
      await waitJobs(servers)
    })

    it('Should not have notifications from this local account', async function () {
      await checkNotifications(servers[0], userToken1, [])
    })

    after(async function () {
      await servers[0].blocklist.removeFromServerBlocklist({ account: 'user_to_block' })
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
        await checkNotifications(servers[0], userToken1, allUser1Notifications)
      }

      {
        const notifications = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]
        await checkNotifications(servers[0], userToken2, notifications)
      }
    })

    it('Should block an account', async function () {
      await servers[0].blocklist.addToServerBlocklist({ server: servers[1].host })
      await waitJobs(servers)
    })

    it('Should not have notifications from this account', async function () {
      await checkNotifications(servers[0], userToken1, [
        UserNotificationType.INVITED_TO_COLLABORATE_TO_CHANNEL,
        UserNotificationType.CHANNEL_OWNERSHIP_CHANGED_REQUEST,
        UserNotificationType.VIDEO_OWNERSHIP_CHANGED_REQUEST
      ])
      await checkNotifications(servers[0], userToken2, [])
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
