/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { getUserNotifications, markAsReadAllNotifications } from '@shared/extra-utils/users/user-notifications'
import { addUserSubscription, removeUserSubscription } from '@shared/extra-utils/users/user-subscriptions'
import { UserNotification, UserNotificationType } from '@shared/models'
import {
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  ServerInfo,
  uploadVideo,
  userLogin
} from '../../../../shared/extra-utils/index'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import {
  addAccountToAccountBlocklist,
  addAccountToServerBlocklist,
  addServerToAccountBlocklist,
  addServerToServerBlocklist,
  removeAccountFromAccountBlocklist,
  removeAccountFromServerBlocklist,
  removeServerFromAccountBlocklist
} from '../../../../shared/extra-utils/users/blocklist'
import { setAccessTokensToServers } from '../../../../shared/extra-utils/users/login'
import { addVideoCommentThread } from '../../../../shared/extra-utils/videos/video-comments'

const expect = chai.expect

async function checkNotifications (url: string, token: string, expected: UserNotificationType[]) {
  const res = await getUserNotifications(url, token, 0, 10, true)

  const notifications: UserNotification[] = res.body.data

  expect(notifications).to.have.lengthOf(expected.length)

  for (const type of expected) {
    expect(notifications.find(n => n.type === type)).to.exist
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
      await removeUserSubscription(servers[1].url, remoteUserToken, 'user1_channel@' + servers[0].host)
      await removeUserSubscription(servers[1].url, remoteUserToken, 'user2_channel@' + servers[0].host)
    } catch {}

    await waitJobs(servers)

    await markAsReadAllNotifications(servers[0].url, userToken1)
    await markAsReadAllNotifications(servers[0].url, userToken2)

    {
      const res = await uploadVideo(servers[0].url, userToken1, { name: 'video' })
      videoUUID = res.body.video.uuid

      await waitJobs(servers)
    }

    {
      await addVideoCommentThread(servers[1].url, remoteUserToken, videoUUID, '@user2@' + servers[0].host + ' hello')
    }

    {

      await addUserSubscription(servers[1].url, remoteUserToken, 'user1_channel@' + servers[0].host)
      await addUserSubscription(servers[1].url, remoteUserToken, 'user2_channel@' + servers[0].host)
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
      await checkNotifications(servers[0].url, userToken1, notifs)
    })

    it('Should block an account', async function () {
      this.timeout(10000)

      await addAccountToAccountBlocklist(servers[0].url, userToken1, 'user3@' + servers[1].host)
      await waitJobs(servers)
    })

    it('Should not have notifications from this account', async function () {
      await checkNotifications(servers[0].url, userToken1, [])
    })

    it('Should have notifications of this account on user 2', async function () {
      const notifs = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]

      await checkNotifications(servers[0].url, userToken2, notifs)

      await removeAccountFromAccountBlocklist(servers[0].url, userToken1, 'user3@' + servers[1].host)
    })
  })

  describe('User blocks another server', function () {

    before(async function () {
      this.timeout(30000)

      await resetState()
    })

    it('Should have appropriate notifications', async function () {
      const notifs = [ UserNotificationType.NEW_COMMENT_ON_MY_VIDEO, UserNotificationType.NEW_FOLLOW ]
      await checkNotifications(servers[0].url, userToken1, notifs)
    })

    it('Should block an account', async function () {
      this.timeout(10000)

      await addServerToAccountBlocklist(servers[0].url, userToken1, servers[1].host)
      await waitJobs(servers)
    })

    it('Should not have notifications from this account', async function () {
      await checkNotifications(servers[0].url, userToken1, [])
    })

    it('Should have notifications of this account on user 2', async function () {
      const notifs = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]

      await checkNotifications(servers[0].url, userToken2, notifs)

      await removeServerFromAccountBlocklist(servers[0].url, userToken1, servers[1].host)
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
        await checkNotifications(servers[0].url, userToken1, notifs)
      }

      {
        const notifs = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]
        await checkNotifications(servers[0].url, userToken2, notifs)
      }
    })

    it('Should block an account', async function () {
      this.timeout(10000)

      await addAccountToServerBlocklist(servers[0].url, servers[0].accessToken, 'user3@' + servers[1].host)
      await waitJobs(servers)
    })

    it('Should not have notifications from this account', async function () {
      await checkNotifications(servers[0].url, userToken1, [])
      await checkNotifications(servers[0].url, userToken2, [])

      await removeAccountFromServerBlocklist(servers[0].url, servers[0].accessToken, 'user3@' + servers[1].host)
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
        await checkNotifications(servers[0].url, userToken1, notifs)
      }

      {
        const notifs = [ UserNotificationType.COMMENT_MENTION, UserNotificationType.NEW_FOLLOW ]
        await checkNotifications(servers[0].url, userToken2, notifs)
      }
    })

    it('Should block an account', async function () {
      this.timeout(10000)

      await addServerToServerBlocklist(servers[0].url, servers[0].accessToken, servers[1].host)
      await waitJobs(servers)
    })

    it('Should not have notifications from this account', async function () {
      await checkNotifications(servers[0].url, userToken1, [])
      await checkNotifications(servers[0].url, userToken2, [])
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
