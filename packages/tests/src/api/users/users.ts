/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { testAvatarSize } from '@tests/shared/checks.js'
import { AbuseState, HttpStatusCode, UserAdminFlag, UserRole, VideoPlaylistType } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer, PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test users', function () {
  let server: PeerTubeServer
  let token: string
  let userToken: string
  let videoId: number
  let userId: number
  const user = {
    username: 'user_1',
    password: 'super password'
  }

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1, {
      rates_limit: {
        login: {
          max: 30
        }
      }
    })

    await setAccessTokensToServers([ server ])

    await server.plugins.install({ npmName: 'peertube-theme-background-red' })
  })

  describe('Creating a user', function () {

    it('Should be able to create a new user', async function () {
      await server.users.create({ ...user, videoQuota: 2 * 1024 * 1024, adminFlags: UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST })
    })

    it('Should be able to login with this user', async function () {
      userToken = await server.login.getAccessToken(user)
    })

    it('Should be able to get user information', async function () {
      const userMe = await server.users.getMyInfo({ token: userToken })

      const userGet = await server.users.get({ userId: userMe.id, withStats: true })

      for (const user of [ userMe, userGet ]) {
        expect(user.username).to.equal('user_1')
        expect(user.email).to.equal('user_1@example.com')
        expect(user.nsfwPolicy).to.equal('display')
        expect(user.videoQuota).to.equal(2 * 1024 * 1024)
        expect(user.role.label).to.equal('User')
        expect(user.id).to.be.a('number')
        expect(user.account.displayName).to.equal('user_1')
        expect(user.account.description).to.be.null
      }

      expect(userMe.adminFlags).to.equal(UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST)
      expect(userGet.adminFlags).to.equal(UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST)

      expect(userMe.specialPlaylists).to.have.lengthOf(1)
      expect(userMe.specialPlaylists[0].type).to.equal(VideoPlaylistType.WATCH_LATER)

      // Check stats are included with withStats
      expect(userGet.videosCount).to.be.a('number')
      expect(userGet.videosCount).to.equal(0)
      expect(userGet.videoCommentsCount).to.be.a('number')
      expect(userGet.videoCommentsCount).to.equal(0)
      expect(userGet.abusesCount).to.be.a('number')
      expect(userGet.abusesCount).to.equal(0)
      expect(userGet.abusesAcceptedCount).to.be.a('number')
      expect(userGet.abusesAcceptedCount).to.equal(0)
    })
  })

  describe('Users listing', function () {

    it('Should list all the users', async function () {
      const { data, total } = await server.users.list()

      expect(total).to.equal(2)
      expect(data).to.be.an('array')
      expect(data.length).to.equal(2)

      const user = data[0]
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('user_1@example.com')
      expect(user.nsfwPolicy).to.equal('display')

      expect(user.totalVideoFileSize).to.equal(0)

      const rootUser = data[1]
      expect(rootUser.username).to.equal('root')
      expect(rootUser.email).to.equal('admin' + server.internalServerNumber + '@example.com')
      expect(user.nsfwPolicy).to.equal('display')

      expect(rootUser.lastLoginDate).to.exist
      expect(user.lastLoginDate).to.exist

      userId = user.id
    })

    it('Should list only the first user by username asc', async function () {
      const { total, data } = await server.users.list({ start: 0, count: 1, sort: 'username' })

      expect(total).to.equal(2)
      expect(data.length).to.equal(1)

      const user = data[0]
      expect(user.username).to.equal('root')
      expect(user.email).to.equal('admin' + server.internalServerNumber + '@example.com')
      expect(user.role.label).to.equal('Administrator')
      expect(user.nsfwPolicy).to.equal('display')
    })

    it('Should list only the first user by username desc', async function () {
      const { total, data } = await server.users.list({ start: 0, count: 1, sort: '-username' })

      expect(total).to.equal(2)
      expect(data.length).to.equal(1)

      const user = data[0]
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('user_1@example.com')
      expect(user.nsfwPolicy).to.equal('display')
    })

    it('Should list only the second user by createdAt desc', async function () {
      const { data, total } = await server.users.list({ start: 0, count: 1, sort: '-createdAt' })
      expect(total).to.equal(2)

      expect(data.length).to.equal(1)

      const user = data[0]
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('user_1@example.com')
      expect(user.nsfwPolicy).to.equal('display')
    })

    it('Should list all the users by createdAt asc', async function () {
      const { data, total } = await server.users.list({ start: 0, count: 2, sort: 'createdAt' })

      expect(total).to.equal(2)
      expect(data.length).to.equal(2)

      expect(data[0].username).to.equal('root')
      expect(data[0].email).to.equal('admin' + server.internalServerNumber + '@example.com')
      expect(data[0].nsfwPolicy).to.equal('display')

      expect(data[1].username).to.equal('user_1')
      expect(data[1].email).to.equal('user_1@example.com')
      expect(data[1].nsfwPolicy).to.equal('display')
    })

    it('Should search user by username', async function () {
      const { data, total } = await server.users.list({ start: 0, count: 2, sort: 'createdAt', search: 'oot' })
      expect(total).to.equal(1)
      expect(data.length).to.equal(1)
      expect(data[0].username).to.equal('root')
    })

    it('Should search user by email', async function () {
      {
        const { total, data } = await server.users.list({ start: 0, count: 2, sort: 'createdAt', search: 'r_1@exam' })
        expect(total).to.equal(1)
        expect(data.length).to.equal(1)
        expect(data[0].username).to.equal('user_1')
        expect(data[0].email).to.equal('user_1@example.com')
      }

      {
        const { total, data } = await server.users.list({ start: 0, count: 2, sort: 'createdAt', search: 'example' })
        expect(total).to.equal(2)
        expect(data.length).to.equal(2)
        expect(data[0].username).to.equal('root')
        expect(data[1].username).to.equal('user_1')
      }
    })
  })

  describe('Update my account', function () {

    it('Should update my password', async function () {
      await server.users.updateMe({
        token: userToken,
        currentPassword: 'super password',
        password: 'new password'
      })
      user.password = 'new password'

      await server.login.login({ user })
    })

    it('Should be able to change the NSFW display attribute', async function () {
      await server.users.updateMe({
        token: userToken,
        nsfwPolicy: 'do_not_list'
      })

      const user = await server.users.getMyInfo({ token: userToken })
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('user_1@example.com')
      expect(user.nsfwPolicy).to.equal('do_not_list')
      expect(user.videoQuota).to.equal(2 * 1024 * 1024)
      expect(user.id).to.be.a('number')
      expect(user.account.displayName).to.equal('user_1')
      expect(user.account.description).to.be.null
    })

    it('Should be able to change the autoPlayVideo attribute', async function () {
      await server.users.updateMe({
        token: userToken,
        autoPlayVideo: false
      })

      const user = await server.users.getMyInfo({ token: userToken })
      expect(user.autoPlayVideo).to.be.false
    })

    it('Should be able to change the autoPlayNextVideo attribute', async function () {
      await server.users.updateMe({
        token: userToken,
        autoPlayNextVideo: true
      })

      const user = await server.users.getMyInfo({ token: userToken })
      expect(user.autoPlayNextVideo).to.be.true
    })

    it('Should be able to change the p2p attribute', async function () {
      await server.users.updateMe({
        token: userToken,
        p2pEnabled: true
      })

      const user = await server.users.getMyInfo({ token: userToken })
      expect(user.p2pEnabled).to.be.true
    })

    it('Should be able to change the email attribute', async function () {
      await server.users.updateMe({
        token: userToken,
        currentPassword: 'new password',
        email: 'updated@example.com'
      })

      const user = await server.users.getMyInfo({ token: userToken })
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('updated@example.com')
      expect(user.nsfwPolicy).to.equal('do_not_list')
      expect(user.videoQuota).to.equal(2 * 1024 * 1024)
      expect(user.id).to.be.a('number')
      expect(user.account.displayName).to.equal('user_1')
      expect(user.account.description).to.be.null
    })

    it('Should be able to update my avatar with a gif', async function () {
      const fixture = 'avatar.gif'

      await server.users.updateMyAvatar({ token: userToken, fixture })

      const user = await server.users.getMyInfo({ token: userToken })
      for (const avatar of user.account.avatars) {
        await testAvatarSize({ url: server.url, avatar, imageName: `avatar-resized-${avatar.width}x${avatar.width}` })
      }
    })

    it('Should be able to update my avatar with a gif, a webp and a png', async function () {
      for (const extension of [ '.png', '.gif', '.webp' ]) {
        const fixture = 'avatar' + extension

        await server.users.updateMyAvatar({ token: userToken, fixture })

        const user = await server.users.getMyInfo({ token: userToken })
        for (const avatar of user.account.avatars) {
          await testAvatarSize({ url: server.url, avatar, imageName: `avatar-resized-${avatar.width}x${avatar.width}` })
        }
      }
    })

    it('Should be able to update my display name', async function () {
      await server.users.updateMe({ token: userToken, displayName: 'new display name' })

      const user = await server.users.getMyInfo({ token: userToken })
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('updated@example.com')
      expect(user.nsfwPolicy).to.equal('do_not_list')
      expect(user.videoQuota).to.equal(2 * 1024 * 1024)
      expect(user.id).to.be.a('number')
      expect(user.account.displayName).to.equal('new display name')
      expect(user.account.description).to.be.null
    })

    it('Should be able to update my description', async function () {
      await server.users.updateMe({ token: userToken, description: 'my super description updated' })

      const user = await server.users.getMyInfo({ token: userToken })
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('updated@example.com')
      expect(user.nsfwPolicy).to.equal('do_not_list')
      expect(user.videoQuota).to.equal(2 * 1024 * 1024)
      expect(user.id).to.be.a('number')
      expect(user.account.displayName).to.equal('new display name')
      expect(user.account.description).to.equal('my super description updated')
      expect(user.noWelcomeModal).to.be.false
      expect(user.noInstanceConfigWarningModal).to.be.false
      expect(user.noAccountSetupWarningModal).to.be.false
    })

    it('Should be able to update my theme', async function () {
      for (const theme of [ 'background-red', 'default', 'instance-default' ]) {
        await server.users.updateMe({ token: userToken, theme })

        const user = await server.users.getMyInfo({ token: userToken })
        expect(user.theme).to.equal(theme)
      }
    })

    it('Should be able to update my modal preferences', async function () {
      await server.users.updateMe({
        token: userToken,
        noInstanceConfigWarningModal: true,
        noWelcomeModal: true,
        noAccountSetupWarningModal: true
      })

      const user = await server.users.getMyInfo({ token: userToken })
      expect(user.noWelcomeModal).to.be.true
      expect(user.noInstanceConfigWarningModal).to.be.true
      expect(user.noAccountSetupWarningModal).to.be.true
    })
  })

  describe('Updating another user', function () {

    it('Should be able to update another user', async function () {
      await server.users.update({
        userId,
        token,
        email: 'updated2@example.com',
        emailVerified: true,
        videoQuota: 42,
        role: UserRole.MODERATOR,
        adminFlags: UserAdminFlag.NONE,
        pluginAuth: 'toto'
      })

      const user = await server.users.get({ token, userId })

      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('updated2@example.com')
      expect(user.emailVerified).to.be.true
      expect(user.nsfwPolicy).to.equal('do_not_list')
      expect(user.videoQuota).to.equal(42)
      expect(user.role.label).to.equal('Moderator')
      expect(user.id).to.be.a('number')
      expect(user.adminFlags).to.equal(UserAdminFlag.NONE)
      expect(user.pluginAuth).to.equal('toto')
    })

    it('Should reset the auth plugin', async function () {
      await server.users.update({ userId, token, pluginAuth: null })

      const user = await server.users.get({ token, userId })
      expect(user.pluginAuth).to.be.null
    })

    it('Should have removed the user token', async function () {
      await server.users.getMyQuotaUsed({ token: userToken, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })

      userToken = await server.login.getAccessToken(user)
    })

    it('Should be able to update another user password', async function () {
      await server.users.update({ userId, token, password: 'password updated' })

      await server.users.getMyQuotaUsed({ token: userToken, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })

      await server.login.login({ user, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      user.password = 'password updated'
      userToken = await server.login.getAccessToken(user)
    })
  })

  describe('Remove a user', function () {

    before(async function () {
      await server.users.update({
        userId,
        token,
        videoQuota: 2 * 1024 * 1024
      })

      await server.videos.quickUpload({ name: 'user video', token: userToken, fixture: 'video_short.webm' })
      await server.videos.quickUpload({ name: 'root video' })

      const { total } = await server.videos.list()
      expect(total).to.equal(2)
    })

    it('Should be able to remove this user', async function () {
      await server.users.remove({ userId, token })
    })

    it('Should not be able to login with this user', async function () {
      await server.login.login({ user, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should not have videos of this user', async function () {
      const { data, total } = await server.videos.list()
      expect(total).to.equal(1)

      const video = data[0]
      expect(video.account.name).to.equal('root')
    })
  })

  describe('User blocking', function () {
    let user16Id: number
    let user16AccessToken: string

    const user16 = {
      username: 'user_16',
      password: 'my super password'
    }

    it('Should block a user', async function () {
      const user = await server.users.create({ ...user16 })
      user16Id = user.id

      user16AccessToken = await server.login.getAccessToken(user16)

      await server.users.getMyInfo({ token: user16AccessToken, expectedStatus: HttpStatusCode.OK_200 })
      await server.users.banUser({ userId: user16Id })

      await server.users.getMyInfo({ token: user16AccessToken, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      await server.login.login({ user: user16, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should search user by banned status', async function () {
      {
        const { data, total } = await server.users.list({ start: 0, count: 2, sort: 'createdAt', blocked: true })
        expect(total).to.equal(1)
        expect(data.length).to.equal(1)

        expect(data[0].username).to.equal(user16.username)
      }

      {
        const { data, total } = await server.users.list({ start: 0, count: 2, sort: 'createdAt', blocked: false })
        expect(total).to.equal(1)
        expect(data.length).to.equal(1)

        expect(data[0].username).to.not.equal(user16.username)
      }
    })

    it('Should unblock a user', async function () {
      await server.users.unbanUser({ userId: user16Id })
      user16AccessToken = await server.login.getAccessToken(user16)
      await server.users.getMyInfo({ token: user16AccessToken, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('User stats', function () {
    let user17Id: number
    let user17AccessToken: string

    it('Should report correct initial statistics about a user', async function () {
      const user17 = {
        username: 'user_17',
        password: 'my super password'
      }
      const created = await server.users.create({ ...user17 })

      user17Id = created.id
      user17AccessToken = await server.login.getAccessToken(user17)

      const user = await server.users.get({ userId: user17Id, withStats: true })
      expect(user.videosCount).to.equal(0)
      expect(user.videoCommentsCount).to.equal(0)
      expect(user.abusesCount).to.equal(0)
      expect(user.abusesCreatedCount).to.equal(0)
      expect(user.abusesAcceptedCount).to.equal(0)
      expect(user.totalVideoFileSize).to.equal(0)
    })

    it('Should report correct videos count', async function () {
      const attributes = { name: 'video to test user stats' }
      await server.videos.upload({ token: user17AccessToken, attributes })

      const { data } = await server.videos.list()
      videoId = data.find(video => video.name === attributes.name).id

      const user = await server.users.get({ userId: user17Id, withStats: true })
      expect(user.videosCount).to.equal(1)
      expect(user.totalVideoFileSize).to.not.equal(0)
    })

    it('Should report correct video comments for user', async function () {
      const text = 'super comment'
      await server.comments.createThread({ token: user17AccessToken, videoId, text })

      const user = await server.users.get({ userId: user17Id, withStats: true })
      expect(user.videoCommentsCount).to.equal(1)
    })

    it('Should report correct abuses counts', async function () {
      const reason = 'my super bad reason'
      await server.abuses.report({ token: user17AccessToken, videoId, reason })

      const body1 = await server.abuses.getAdminList()
      const abuseId = body1.data[0].id

      const user2 = await server.users.get({ userId: user17Id, withStats: true })
      expect(user2.abusesCount).to.equal(1) // number of incriminations
      expect(user2.abusesCreatedCount).to.equal(1) // number of reports created

      await server.abuses.update({ abuseId, body: { state: AbuseState.ACCEPTED } })

      const user3 = await server.users.get({ userId: user17Id, withStats: true })
      expect(user3.abusesAcceptedCount).to.equal(1) // number of reports created accepted
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
