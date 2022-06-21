/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { testImage } from '@server/tests/shared'
import { AbuseState, HttpStatusCode, OAuth2ErrorCode, UserAdminFlag, UserRole, Video, VideoPlaylistType } from '@shared/models'
import {
  cleanupTests,
  createSingleServer,
  killallServers,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'

const expect = chai.expect

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

  describe('OAuth client', function () {
    it('Should create a new client')

    it('Should return the first client')

    it('Should remove the last client')

    it('Should not login with an invalid client id', async function () {
      const client = { id: 'client', secret: server.store.client.secret }
      const body = await server.login.login({ client, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      expect(body.code).to.equal(OAuth2ErrorCode.INVALID_CLIENT)
      expect(body.error).to.contain('client is invalid')
      expect(body.type.startsWith('https://')).to.be.true
      expect(body.type).to.contain(OAuth2ErrorCode.INVALID_CLIENT)
    })

    it('Should not login with an invalid client secret', async function () {
      const client = { id: server.store.client.id, secret: 'coucou' }
      const body = await server.login.login({ client, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      expect(body.code).to.equal(OAuth2ErrorCode.INVALID_CLIENT)
      expect(body.error).to.contain('client is invalid')
      expect(body.type.startsWith('https://')).to.be.true
      expect(body.type).to.contain(OAuth2ErrorCode.INVALID_CLIENT)
    })
  })

  describe('Login', function () {

    it('Should not login with an invalid username', async function () {
      const user = { username: 'captain crochet', password: server.store.user.password }
      const body = await server.login.login({ user, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      expect(body.code).to.equal(OAuth2ErrorCode.INVALID_GRANT)
      expect(body.error).to.contain('credentials are invalid')
      expect(body.type.startsWith('https://')).to.be.true
      expect(body.type).to.contain(OAuth2ErrorCode.INVALID_GRANT)
    })

    it('Should not login with an invalid password', async function () {
      const user = { username: server.store.user.username, password: 'mew_three' }
      const body = await server.login.login({ user, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      expect(body.code).to.equal(OAuth2ErrorCode.INVALID_GRANT)
      expect(body.error).to.contain('credentials are invalid')
      expect(body.type.startsWith('https://')).to.be.true
      expect(body.type).to.contain(OAuth2ErrorCode.INVALID_GRANT)
    })

    it('Should not be able to upload a video', async function () {
      token = 'my_super_token'

      await server.videos.upload({ token, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should not be able to follow', async function () {
      token = 'my_super_token'

      await server.follows.follow({
        hosts: [ 'http://example.com' ],
        token,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should not be able to unfollow')

    it('Should be able to login', async function () {
      const body = await server.login.login({ expectedStatus: HttpStatusCode.OK_200 })

      token = body.access_token
    })

    it('Should be able to login with an insensitive username', async function () {
      const user = { username: 'RoOt', password: server.store.user.password }
      await server.login.login({ user, expectedStatus: HttpStatusCode.OK_200 })

      const user2 = { username: 'rOoT', password: server.store.user.password }
      await server.login.login({ user: user2, expectedStatus: HttpStatusCode.OK_200 })

      const user3 = { username: 'ROOt', password: server.store.user.password }
      await server.login.login({ user: user3, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('Upload', function () {

    it('Should upload the video with the correct token', async function () {
      await server.videos.upload({ token })
      const { data } = await server.videos.list()
      const video = data[0]

      expect(video.account.name).to.equal('root')
      videoId = video.id
    })

    it('Should upload the video again with the correct token', async function () {
      await server.videos.upload({ token })
    })
  })

  describe('Ratings', function () {

    it('Should retrieve a video rating', async function () {
      await server.videos.rate({ id: videoId, rating: 'like' })
      const rating = await server.users.getMyRating({ token, videoId })

      expect(rating.videoId).to.equal(videoId)
      expect(rating.rating).to.equal('like')
    })

    it('Should retrieve ratings list', async function () {
      await server.videos.rate({ id: videoId, rating: 'like' })

      const body = await server.accounts.listRatings({ accountName: server.store.user.username })

      expect(body.total).to.equal(1)
      expect(body.data[0].video.id).to.equal(videoId)
      expect(body.data[0].rating).to.equal('like')
    })

    it('Should retrieve ratings list by rating type', async function () {
      {
        const body = await server.accounts.listRatings({ accountName: server.store.user.username, rating: 'like' })
        expect(body.data.length).to.equal(1)
      }

      {
        const body = await server.accounts.listRatings({ accountName: server.store.user.username, rating: 'dislike' })
        expect(body.data.length).to.equal(0)
      }
    })
  })

  describe('Remove video', function () {
    it('Should not be able to remove the video with an incorrect token', async function () {
      await server.videos.remove({ token: 'bad_token', id: videoId, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should not be able to remove the video with the token of another account')

    it('Should be able to remove the video with the correct token', async function () {
      await server.videos.remove({ token, id: videoId })
    })
  })

  describe('Logout', function () {
    it('Should logout (revoke token)', async function () {
      await server.login.logout({ token: server.accessToken })
    })

    it('Should not be able to get the user information', async function () {
      await server.users.getMyInfo({ expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should not be able to upload a video', async function () {
      await server.videos.upload({ attributes: { name: 'video' }, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should not be able to rate a video', async function () {
      const path = '/api/v1/videos/'
      const data = {
        rating: 'likes'
      }

      const options = {
        url: server.url,
        path: path + videoId,
        token: 'wrong token',
        fields: data,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      }
      await makePutBodyRequest(options)
    })

    it('Should be able to login again', async function () {
      const body = await server.login.login()
      server.accessToken = body.access_token
      server.refreshToken = body.refresh_token
    })

    it('Should be able to get my user information again', async function () {
      await server.users.getMyInfo()
    })

    it('Should have an expired access token', async function () {
      this.timeout(60000)

      await server.sql.setTokenField(server.accessToken, 'accessTokenExpiresAt', new Date().toISOString())
      await server.sql.setTokenField(server.accessToken, 'refreshTokenExpiresAt', new Date().toISOString())

      await killallServers([ server ])
      await server.run()

      await server.users.getMyInfo({ expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should not be able to refresh an access token with an expired refresh token', async function () {
      await server.login.refreshToken({ refreshToken: server.refreshToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should refresh the token', async function () {
      this.timeout(15000)

      const futureDate = new Date(new Date().getTime() + 1000 * 60).toISOString()
      await server.sql.setTokenField(server.accessToken, 'refreshTokenExpiresAt', futureDate)

      await killallServers([ server ])
      await server.run()

      const res = await server.login.refreshToken({ refreshToken: server.refreshToken })
      server.accessToken = res.body.access_token
      server.refreshToken = res.body.refresh_token
    })

    it('Should be able to get my user information again', async function () {
      await server.users.getMyInfo()
    })
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
        expect(user.roleLabel).to.equal('User')
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

  describe('My videos & quotas', function () {

    it('Should be able to upload a video with this user', async function () {
      this.timeout(10000)

      const attributes = {
        name: 'super user video',
        fixture: 'video_short.webm'
      }
      await server.videos.upload({ token: userToken, attributes })

      await server.channels.create({ token: userToken, attributes: { name: 'other_channel' } })
    })

    it('Should have video quota updated', async function () {
      const quota = await server.users.getMyQuotaUsed({ token: userToken })
      expect(quota.videoQuotaUsed).to.equal(218910)

      const { data } = await server.users.list()
      const tmpUser = data.find(u => u.username === user.username)
      expect(tmpUser.videoQuotaUsed).to.equal(218910)
    })

    it('Should be able to list my videos', async function () {
      const { total, data } = await server.videos.listMyVideos({ token: userToken })
      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)

      const video: Video = data[0]
      expect(video.name).to.equal('super user video')
      expect(video.thumbnailPath).to.not.be.null
      expect(video.previewPath).to.not.be.null
    })

    it('Should be able to filter by channel in my videos', async function () {
      const myInfo = await server.users.getMyInfo({ token: userToken })
      const mainChannel = myInfo.videoChannels.find(c => c.name !== 'other_channel')
      const otherChannel = myInfo.videoChannels.find(c => c.name === 'other_channel')

      {
        const { total, data } = await server.videos.listMyVideos({ token: userToken, channelId: mainChannel.id })
        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)

        const video: Video = data[0]
        expect(video.name).to.equal('super user video')
        expect(video.thumbnailPath).to.not.be.null
        expect(video.previewPath).to.not.be.null
      }

      {
        const { total, data } = await server.videos.listMyVideos({ token: userToken, channelId: otherChannel.id })
        expect(total).to.equal(0)
        expect(data).to.have.lengthOf(0)
      }
    })

    it('Should be able to search in my videos', async function () {
      {
        const { total, data } = await server.videos.listMyVideos({ token: userToken, sort: '-createdAt', search: 'user video' })
        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      }

      {
        const { total, data } = await server.videos.listMyVideos({ token: userToken, sort: '-createdAt', search: 'toto' })
        expect(total).to.equal(0)
        expect(data).to.have.lengthOf(0)
      }
    })

    it('Should disable webtorrent, enable HLS, and update my quota', async function () {
      this.timeout(160000)

      {
        const config = await server.config.getCustomConfig()
        config.transcoding.webtorrent.enabled = false
        config.transcoding.hls.enabled = true
        config.transcoding.enabled = true
        await server.config.updateCustomSubConfig({ newConfig: config })
      }

      {
        const attributes = {
          name: 'super user video 2',
          fixture: 'video_short.webm'
        }
        await server.videos.upload({ token: userToken, attributes })

        await waitJobs([ server ])
      }

      {
        const data = await server.users.getMyQuotaUsed({ token: userToken })
        expect(data.videoQuotaUsed).to.be.greaterThan(220000)
      }
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
      expect(user.roleLabel).to.equal('Administrator')
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
      {
        await server.users.updateMe({
          token: userToken,
          webTorrentEnabled: false
        })

        const user = await server.users.getMyInfo({ token: userToken })
        expect(user.p2pEnabled).to.be.false
      }

      {
        await server.users.updateMe({
          token: userToken,
          p2pEnabled: true
        })

        const user = await server.users.getMyInfo({ token: userToken })
        expect(user.p2pEnabled).to.be.true
      }
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
        await testImage(server.url, `avatar-resized-${avatar.width}x${avatar.width}`, avatar.path, '.gif')
      }
    })

    it('Should be able to update my avatar with a gif, and then a png', async function () {
      for (const extension of [ '.png', '.gif' ]) {
        const fixture = 'avatar' + extension

        await server.users.updateMyAvatar({ token: userToken, fixture })

        const user = await server.users.getMyInfo({ token: userToken })
        for (const avatar of user.account.avatars) {
          await testImage(server.url, `avatar-resized-${avatar.width}x${avatar.width}`, avatar.path, extension)
        }
      }
    })

    it('Should still have the same amount of videos in my account', async function () {
      const { total, data } = await server.videos.listMyVideos({ token: userToken })

      expect(total).to.equal(2)
      expect(data).to.have.lengthOf(2)
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
      expect(user.roleLabel).to.equal('Moderator')
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

  describe('Video blacklists', function () {
    it('Should be able to list video blacklist by a moderator', async function () {
      await server.blacklist.list({ token: userToken })
    })
  })

  describe('Remove a user', function () {
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

  describe('Registering a new user', function () {
    let user15AccessToken

    it('Should register a new user', async function () {
      const user = { displayName: 'super user 15', username: 'user_15', password: 'my super password' }
      const channel = { name: 'my_user_15_channel', displayName: 'my channel rocks' }

      await server.users.register({ ...user, channel })
    })

    it('Should be able to login with this registered user', async function () {
      const user15 = {
        username: 'user_15',
        password: 'my super password'
      }

      user15AccessToken = await server.login.getAccessToken(user15)
    })

    it('Should have the correct display name', async function () {
      const user = await server.users.getMyInfo({ token: user15AccessToken })
      expect(user.account.displayName).to.equal('super user 15')
    })

    it('Should have the correct video quota', async function () {
      const user = await server.users.getMyInfo({ token: user15AccessToken })
      expect(user.videoQuota).to.equal(5 * 1024 * 1024)
    })

    it('Should have created the channel', async function () {
      const { displayName } = await server.channels.get({ channelName: 'my_user_15_channel' })

      expect(displayName).to.equal('my channel rocks')
    })

    it('Should remove me', async function () {
      {
        const { data } = await server.users.list()
        expect(data.find(u => u.username === 'user_15')).to.not.be.undefined
      }

      await server.users.deleteMe({ token: user15AccessToken })

      {
        const { data } = await server.users.list()
        expect(data.find(u => u.username === 'user_15')).to.be.undefined
      }
    })
  })

  describe('User blocking', function () {
    let user16Id
    let user16AccessToken
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
    let user17Id
    let user17AccessToken

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
    })

    it('Should report correct videos count', async function () {
      const attributes = { name: 'video to test user stats' }
      await server.videos.upload({ token: user17AccessToken, attributes })

      const { data } = await server.videos.list()
      videoId = data.find(video => video.name === attributes.name).id

      const user = await server.users.get({ userId: user17Id, withStats: true })
      expect(user.videosCount).to.equal(1)
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
