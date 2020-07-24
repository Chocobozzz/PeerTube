/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { AbuseState, AbuseUpdate, MyUser, User, UserRole, Video, VideoPlaylistType } from '@shared/models'
import { CustomConfig } from '@shared/models/server'
import {
  addVideoCommentThread,
  blockUser,
  cleanupTests,
  createUser,
  deleteMe,
  flushAndRunServer,
  getAccountRatings,
  getAdminAbusesList,
  getBlacklistedVideosList,
  getCustomConfig,
  getMyUserInformation,
  getMyUserVideoQuotaUsed,
  getMyUserVideoRating,
  getUserInformation,
  getUsersList,
  getUsersListPaginationAndSort,
  getVideoChannel,
  getVideosList,
  installPlugin,
  login,
  makePutBodyRequest,
  rateVideo,
  registerUserWithChannel,
  removeUser,
  removeVideo,
  reportAbuse,
  ServerInfo,
  testImage,
  unblockUser,
  updateAbuse,
  updateCustomSubConfig,
  updateMyAvatar,
  updateMyUser,
  updateUser,
  uploadVideo,
  userLogin,
  waitJobs
} from '../../../../shared/extra-utils'
import { follow } from '../../../../shared/extra-utils/server/follows'
import { logout, serverLogin, setAccessTokensToServers } from '../../../../shared/extra-utils/users/login'
import { getMyVideos } from '../../../../shared/extra-utils/videos/videos'
import { UserAdminFlag } from '../../../../shared/models/users/user-flag.model'

const expect = chai.expect

describe('Test users', function () {
  let server: ServerInfo
  let accessToken: string
  let accessTokenUser: string
  let videoId: number
  let userId: number
  const user = {
    username: 'user_1',
    password: 'super password'
  }

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1, {
      rates_limit: {
        login: {
          max: 30
        }
      }
    })

    await setAccessTokensToServers([ server ])

    await installPlugin({ url: server.url, accessToken: server.accessToken, npmName: 'peertube-theme-background-red' })
  })

  describe('OAuth client', function () {
    it('Should create a new client')

    it('Should return the first client')

    it('Should remove the last client')

    it('Should not login with an invalid client id', async function () {
      const client = { id: 'client', secret: server.client.secret }
      const res = await login(server.url, client, server.user, 400)

      expect(res.body.error).to.contain('client is invalid')
    })

    it('Should not login with an invalid client secret', async function () {
      const client = { id: server.client.id, secret: 'coucou' }
      const res = await login(server.url, client, server.user, 400)

      expect(res.body.error).to.contain('client is invalid')
    })
  })

  describe('Login', function () {

    it('Should not login with an invalid username', async function () {
      const user = { username: 'captain crochet', password: server.user.password }
      const res = await login(server.url, server.client, user, 400)

      expect(res.body.error).to.contain('credentials are invalid')
    })

    it('Should not login with an invalid password', async function () {
      const user = { username: server.user.username, password: 'mew_three' }
      const res = await login(server.url, server.client, user, 400)

      expect(res.body.error).to.contain('credentials are invalid')
    })

    it('Should not be able to upload a video', async function () {
      accessToken = 'my_super_token'

      const videoAttributes = {}
      await uploadVideo(server.url, accessToken, videoAttributes, 401)
    })

    it('Should not be able to follow', async function () {
      accessToken = 'my_super_token'
      await follow(server.url, [ 'http://example.com' ], accessToken, 401)
    })

    it('Should not be able to unfollow')

    it('Should be able to login', async function () {
      const res = await login(server.url, server.client, server.user, 200)

      accessToken = res.body.access_token
    })

    it('Should be able to login with an insensitive username', async function () {
      const user = { username: 'RoOt', password: server.user.password }
      await login(server.url, server.client, user, 200)

      const user2 = { username: 'rOoT', password: server.user.password }
      await login(server.url, server.client, user2, 200)

      const user3 = { username: 'ROOt', password: server.user.password }
      await login(server.url, server.client, user3, 200)
    })
  })

  describe('Upload', function () {

    it('Should upload the video with the correct token', async function () {
      const videoAttributes = {}
      await uploadVideo(server.url, accessToken, videoAttributes)
      const res = await getVideosList(server.url)
      const video = res.body.data[0]

      expect(video.account.name).to.equal('root')
      videoId = video.id
    })

    it('Should upload the video again with the correct token', async function () {
      const videoAttributes = {}
      await uploadVideo(server.url, accessToken, videoAttributes)
    })
  })

  describe('Ratings', function () {

    it('Should retrieve a video rating', async function () {
      await rateVideo(server.url, accessToken, videoId, 'like')
      const res = await getMyUserVideoRating(server.url, accessToken, videoId)
      const rating = res.body

      expect(rating.videoId).to.equal(videoId)
      expect(rating.rating).to.equal('like')
    })

    it('Should retrieve ratings list', async function () {
      await rateVideo(server.url, accessToken, videoId, 'like')

      const res = await getAccountRatings(server.url, server.user.username, server.accessToken, null, 200)
      const ratings = res.body

      expect(ratings.total).to.equal(1)
      expect(ratings.data[0].video.id).to.equal(videoId)
      expect(ratings.data[0].rating).to.equal('like')
    })

    it('Should retrieve ratings list by rating type', async function () {
      {
        const res = await getAccountRatings(server.url, server.user.username, server.accessToken, 'like')
        const ratings = res.body
        expect(ratings.data.length).to.equal(1)
      }

      {
        const res = await getAccountRatings(server.url, server.user.username, server.accessToken, 'dislike')
        const ratings = res.body
        expect(ratings.data.length).to.equal(0)
      }
    })
  })

  describe('Remove video', function () {
    it('Should not be able to remove the video with an incorrect token', async function () {
      await removeVideo(server.url, 'bad_token', videoId, 401)
    })

    it('Should not be able to remove the video with the token of another account')

    it('Should be able to remove the video with the correct token', async function () {
      await removeVideo(server.url, accessToken, videoId)
    })
  })

  describe('Logout', function () {
    it('Should logout (revoke token)', async function () {
      await logout(server.url, server.accessToken)
    })

    it('Should not be able to get the user information', async function () {
      await getMyUserInformation(server.url, server.accessToken, 401)
    })

    it('Should not be able to upload a video', async function () {
      await uploadVideo(server.url, server.accessToken, { name: 'video' }, 401)
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
        statusCodeExpected: 401
      }
      await makePutBodyRequest(options)
    })

    it('Should be able to login again', async function () {
      server.accessToken = await serverLogin(server)
    })

    it('Should have an expired access token')

    it('Should refresh the token')

    it('Should be able to get my user information again', async function () {
      await getMyUserInformation(server.url, server.accessToken)
    })
  })

  describe('Creating a user', function () {

    it('Should be able to create a new user', async function () {
      await createUser({
        url: server.url,
        accessToken: accessToken,
        username: user.username,
        password: user.password,
        videoQuota: 2 * 1024 * 1024,
        adminFlags: UserAdminFlag.BYPASS_VIDEO_AUTO_BLACKLIST
      })
    })

    it('Should be able to login with this user', async function () {
      accessTokenUser = await userLogin(server, user)
    })

    it('Should be able to get user information', async function () {
      const res1 = await getMyUserInformation(server.url, accessTokenUser)
      const userMe: MyUser = res1.body

      const res2 = await getUserInformation(server.url, server.accessToken, userMe.id, true)
      const userGet: User = res2.body

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

      expect(userMe.adminFlags).to.be.undefined
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

      const videoAttributes = {
        name: 'super user video',
        fixture: 'video_short.webm'
      }
      await uploadVideo(server.url, accessTokenUser, videoAttributes)
    })

    it('Should have video quota updated', async function () {
      const res = await getMyUserVideoQuotaUsed(server.url, accessTokenUser)
      const data = res.body

      expect(data.videoQuotaUsed).to.equal(218910)

      const resUsers = await getUsersList(server.url, server.accessToken)

      const users: User[] = resUsers.body.data
      const tmpUser = users.find(u => u.username === user.username)
      expect(tmpUser.videoQuotaUsed).to.equal(218910)
    })

    it('Should be able to list my videos', async function () {
      const res = await getMyVideos(server.url, accessTokenUser, 0, 5)
      expect(res.body.total).to.equal(1)

      const videos = res.body.data
      expect(videos).to.have.lengthOf(1)

      const video: Video = videos[0]
      expect(video.name).to.equal('super user video')
      expect(video.thumbnailPath).to.not.be.null
      expect(video.previewPath).to.not.be.null
    })

    it('Should be able to search in my videos', async function () {
      {
        const res = await getMyVideos(server.url, accessTokenUser, 0, 5, '-createdAt', 'user video')
        expect(res.body.total).to.equal(1)

        const videos = res.body.data
        expect(videos).to.have.lengthOf(1)
      }

      {
        const res = await getMyVideos(server.url, accessTokenUser, 0, 5, '-createdAt', 'toto')
        expect(res.body.total).to.equal(0)

        const videos = res.body.data
        expect(videos).to.have.lengthOf(0)
      }
    })

    it('Should disable webtorrent, enable HLS, and update my quota', async function () {
      this.timeout(60000)

      {
        const res = await getCustomConfig(server.url, server.accessToken)
        const config = res.body as CustomConfig
        config.transcoding.webtorrent.enabled = false
        config.transcoding.hls.enabled = true
        config.transcoding.enabled = true
        await updateCustomSubConfig(server.url, server.accessToken, config)
      }

      {
        const videoAttributes = {
          name: 'super user video 2',
          fixture: 'video_short.webm'
        }
        await uploadVideo(server.url, accessTokenUser, videoAttributes)

        await waitJobs([ server ])
      }

      {
        const res = await getMyUserVideoQuotaUsed(server.url, accessTokenUser)
        const data = res.body

        expect(data.videoQuotaUsed).to.be.greaterThan(220000)
      }
    })
  })

  describe('Users listing', function () {

    it('Should list all the users', async function () {
      const res = await getUsersList(server.url, server.accessToken)
      const result = res.body
      const total = result.total
      const users = result.data

      expect(total).to.equal(2)
      expect(users).to.be.an('array')
      expect(users.length).to.equal(2)

      const user = users[0]
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('user_1@example.com')
      expect(user.nsfwPolicy).to.equal('display')

      const rootUser = users[1]
      expect(rootUser.username).to.equal('root')
      expect(rootUser.email).to.equal('admin' + server.internalServerNumber + '@example.com')
      expect(user.nsfwPolicy).to.equal('display')

      expect(rootUser.lastLoginDate).to.exist
      expect(user.lastLoginDate).to.exist

      userId = user.id
    })

    it('Should list only the first user by username asc', async function () {
      const res = await getUsersListPaginationAndSort(server.url, server.accessToken, 0, 1, 'username')

      const result = res.body
      const total = result.total
      const users = result.data

      expect(total).to.equal(2)
      expect(users.length).to.equal(1)

      const user = users[0]
      expect(user.username).to.equal('root')
      expect(user.email).to.equal('admin' + server.internalServerNumber + '@example.com')
      expect(user.roleLabel).to.equal('Administrator')
      expect(user.nsfwPolicy).to.equal('display')
    })

    it('Should list only the first user by username desc', async function () {
      const res = await getUsersListPaginationAndSort(server.url, server.accessToken, 0, 1, '-username')
      const result = res.body
      const total = result.total
      const users = result.data

      expect(total).to.equal(2)
      expect(users.length).to.equal(1)

      const user = users[0]
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('user_1@example.com')
      expect(user.nsfwPolicy).to.equal('display')
    })

    it('Should list only the second user by createdAt desc', async function () {
      const res = await getUsersListPaginationAndSort(server.url, server.accessToken, 0, 1, '-createdAt')
      const result = res.body
      const total = result.total
      const users = result.data

      expect(total).to.equal(2)
      expect(users.length).to.equal(1)

      const user = users[0]
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('user_1@example.com')
      expect(user.nsfwPolicy).to.equal('display')
    })

    it('Should list all the users by createdAt asc', async function () {
      const res = await getUsersListPaginationAndSort(server.url, server.accessToken, 0, 2, 'createdAt')
      const result = res.body
      const total = result.total
      const users = result.data

      expect(total).to.equal(2)
      expect(users.length).to.equal(2)

      expect(users[0].username).to.equal('root')
      expect(users[0].email).to.equal('admin' + server.internalServerNumber + '@example.com')
      expect(users[0].nsfwPolicy).to.equal('display')

      expect(users[1].username).to.equal('user_1')
      expect(users[1].email).to.equal('user_1@example.com')
      expect(users[1].nsfwPolicy).to.equal('display')
    })

    it('Should search user by username', async function () {
      const res = await getUsersListPaginationAndSort(server.url, server.accessToken, 0, 2, 'createdAt', 'oot')
      const users = res.body.data as User[]

      expect(res.body.total).to.equal(1)
      expect(users.length).to.equal(1)

      expect(users[0].username).to.equal('root')
    })

    it('Should search user by email', async function () {
      {
        const res = await getUsersListPaginationAndSort(server.url, server.accessToken, 0, 2, 'createdAt', 'r_1@exam')
        const users = res.body.data as User[]

        expect(res.body.total).to.equal(1)
        expect(users.length).to.equal(1)

        expect(users[0].username).to.equal('user_1')
        expect(users[0].email).to.equal('user_1@example.com')
      }

      {
        const res = await getUsersListPaginationAndSort(server.url, server.accessToken, 0, 2, 'createdAt', 'example')
        const users = res.body.data as User[]

        expect(res.body.total).to.equal(2)
        expect(users.length).to.equal(2)

        expect(users[0].username).to.equal('root')
        expect(users[1].username).to.equal('user_1')
      }
    })
  })

  describe('Update my account', function () {
    it('Should update my password', async function () {
      await updateMyUser({
        url: server.url,
        accessToken: accessTokenUser,
        currentPassword: 'super password',
        password: 'new password'
      })
      user.password = 'new password'

      await userLogin(server, user, 200)
    })

    it('Should be able to change the NSFW display attribute', async function () {
      await updateMyUser({
        url: server.url,
        accessToken: accessTokenUser,
        nsfwPolicy: 'do_not_list'
      })

      const res = await getMyUserInformation(server.url, accessTokenUser)
      const user = res.body

      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('user_1@example.com')
      expect(user.nsfwPolicy).to.equal('do_not_list')
      expect(user.videoQuota).to.equal(2 * 1024 * 1024)
      expect(user.id).to.be.a('number')
      expect(user.account.displayName).to.equal('user_1')
      expect(user.account.description).to.be.null
    })

    it('Should be able to change the autoPlayVideo attribute', async function () {
      await updateMyUser({
        url: server.url,
        accessToken: accessTokenUser,
        autoPlayVideo: false
      })

      const res = await getMyUserInformation(server.url, accessTokenUser)
      const user = res.body

      expect(user.autoPlayVideo).to.be.false
    })

    it('Should be able to change the autoPlayNextVideo attribute', async function () {
      await updateMyUser({
        url: server.url,
        accessToken: accessTokenUser,
        autoPlayNextVideo: true
      })

      const res = await getMyUserInformation(server.url, accessTokenUser)
      const user = res.body

      expect(user.autoPlayNextVideo).to.be.true
    })

    it('Should be able to change the email attribute', async function () {
      await updateMyUser({
        url: server.url,
        accessToken: accessTokenUser,
        currentPassword: 'new password',
        email: 'updated@example.com'
      })

      const res = await getMyUserInformation(server.url, accessTokenUser)
      const user = res.body

      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('updated@example.com')
      expect(user.nsfwPolicy).to.equal('do_not_list')
      expect(user.videoQuota).to.equal(2 * 1024 * 1024)
      expect(user.id).to.be.a('number')
      expect(user.account.displayName).to.equal('user_1')
      expect(user.account.description).to.be.null
    })

    it('Should be able to update my avatar', async function () {
      const fixture = 'avatar.png'

      await updateMyAvatar({
        url: server.url,
        accessToken: accessTokenUser,
        fixture
      })

      const res = await getMyUserInformation(server.url, accessTokenUser)
      const user = res.body

      await testImage(server.url, 'avatar-resized', user.account.avatar.path, '.png')
    })

    it('Should be able to update my display name', async function () {
      await updateMyUser({
        url: server.url,
        accessToken: accessTokenUser,
        displayName: 'new display name'
      })

      const res = await getMyUserInformation(server.url, accessTokenUser)
      const user = res.body

      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('updated@example.com')
      expect(user.nsfwPolicy).to.equal('do_not_list')
      expect(user.videoQuota).to.equal(2 * 1024 * 1024)
      expect(user.id).to.be.a('number')
      expect(user.account.displayName).to.equal('new display name')
      expect(user.account.description).to.be.null
    })

    it('Should be able to update my description', async function () {
      await updateMyUser({
        url: server.url,
        accessToken: accessTokenUser,
        description: 'my super description updated'
      })

      const res = await getMyUserInformation(server.url, accessTokenUser)
      const user: User = res.body

      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('updated@example.com')
      expect(user.nsfwPolicy).to.equal('do_not_list')
      expect(user.videoQuota).to.equal(2 * 1024 * 1024)
      expect(user.id).to.be.a('number')
      expect(user.account.displayName).to.equal('new display name')
      expect(user.account.description).to.equal('my super description updated')
      expect(user.noWelcomeModal).to.be.false
      expect(user.noInstanceConfigWarningModal).to.be.false
    })

    it('Should be able to update my theme', async function () {
      for (const theme of [ 'background-red', 'default', 'instance-default' ]) {
        await updateMyUser({
          url: server.url,
          accessToken: accessTokenUser,
          theme
        })

        const res = await getMyUserInformation(server.url, accessTokenUser)
        const body: User = res.body

        expect(body.theme).to.equal(theme)
      }
    })

    it('Should be able to update my modal preferences', async function () {
      await updateMyUser({
        url: server.url,
        accessToken: accessTokenUser,
        noInstanceConfigWarningModal: true,
        noWelcomeModal: true
      })

      const res = await getMyUserInformation(server.url, accessTokenUser)
      const user: User = res.body

      expect(user.noWelcomeModal).to.be.true
      expect(user.noInstanceConfigWarningModal).to.be.true
    })
  })

  describe('Updating another user', function () {
    it('Should be able to update another user', async function () {
      await updateUser({
        url: server.url,
        userId,
        accessToken,
        email: 'updated2@example.com',
        emailVerified: true,
        videoQuota: 42,
        role: UserRole.MODERATOR,
        adminFlags: UserAdminFlag.NONE
      })

      const res = await getUserInformation(server.url, accessToken, userId)
      const user = res.body

      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('updated2@example.com')
      expect(user.emailVerified).to.be.true
      expect(user.nsfwPolicy).to.equal('do_not_list')
      expect(user.videoQuota).to.equal(42)
      expect(user.roleLabel).to.equal('Moderator')
      expect(user.id).to.be.a('number')
      expect(user.adminFlags).to.equal(UserAdminFlag.NONE)
    })

    it('Should have removed the user token', async function () {
      await getMyUserVideoQuotaUsed(server.url, accessTokenUser, 401)

      accessTokenUser = await userLogin(server, user)
    })

    it('Should be able to update another user password', async function () {
      await updateUser({
        url: server.url,
        userId,
        accessToken,
        password: 'password updated'
      })

      await getMyUserVideoQuotaUsed(server.url, accessTokenUser, 401)

      await userLogin(server, user, 400)

      user.password = 'password updated'
      accessTokenUser = await userLogin(server, user)
    })
  })

  describe('Video blacklists', function () {
    it('Should be able to list video blacklist by a moderator', async function () {
      await getBlacklistedVideosList({ url: server.url, token: accessTokenUser })
    })
  })

  describe('Remove a user', function () {
    it('Should be able to remove this user', async function () {
      await removeUser(server.url, userId, accessToken)
    })

    it('Should not be able to login with this user', async function () {
      await userLogin(server, user, 400)
    })

    it('Should not have videos of this user', async function () {
      const res = await getVideosList(server.url)

      expect(res.body.total).to.equal(1)

      const video = res.body.data[0]
      expect(video.account.name).to.equal('root')
    })
  })

  describe('Registering a new user', function () {
    let user15AccessToken

    it('Should register a new user', async function () {
      const user = { displayName: 'super user 15', username: 'user_15', password: 'my super password' }
      const channel = { name: 'my_user_15_channel', displayName: 'my channel rocks' }

      await registerUserWithChannel({ url: server.url, user, channel })
    })

    it('Should be able to login with this registered user', async function () {
      const user15 = {
        username: 'user_15',
        password: 'my super password'
      }

      user15AccessToken = await userLogin(server, user15)
    })

    it('Should have the correct display name', async function () {
      const res = await getMyUserInformation(server.url, user15AccessToken)
      const user: User = res.body

      expect(user.account.displayName).to.equal('super user 15')
    })

    it('Should have the correct video quota', async function () {
      const res = await getMyUserInformation(server.url, user15AccessToken)
      const user = res.body

      expect(user.videoQuota).to.equal(5 * 1024 * 1024)
    })

    it('Should have created the channel', async function () {
      const res = await getVideoChannel(server.url, 'my_user_15_channel')

      expect(res.body.displayName).to.equal('my channel rocks')
    })

    it('Should remove me', async function () {
      {
        const res = await getUsersList(server.url, server.accessToken)
        expect(res.body.data.find(u => u.username === 'user_15')).to.not.be.undefined
      }

      await deleteMe(server.url, user15AccessToken)

      {
        const res = await getUsersList(server.url, server.accessToken)
        expect(res.body.data.find(u => u.username === 'user_15')).to.be.undefined
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
      const resUser = await createUser({
        url: server.url,
        accessToken: server.accessToken,
        username: user16.username,
        password: user16.password
      })
      user16Id = resUser.body.user.id

      user16AccessToken = await userLogin(server, user16)

      await getMyUserInformation(server.url, user16AccessToken, 200)
      await blockUser(server.url, user16Id, server.accessToken)

      await getMyUserInformation(server.url, user16AccessToken, 401)
      await userLogin(server, user16, 400)
    })

    it('Should search user by banned status', async function () {
      {
        const res = await getUsersListPaginationAndSort(server.url, server.accessToken, 0, 2, 'createdAt', undefined, true)
        const users = res.body.data as User[]

        expect(res.body.total).to.equal(1)
        expect(users.length).to.equal(1)

        expect(users[0].username).to.equal(user16.username)
      }

      {
        const res = await getUsersListPaginationAndSort(server.url, server.accessToken, 0, 2, 'createdAt', undefined, false)
        const users = res.body.data as User[]

        expect(res.body.total).to.equal(1)
        expect(users.length).to.equal(1)

        expect(users[0].username).to.not.equal(user16.username)
      }
    })

    it('Should unblock a user', async function () {
      await unblockUser(server.url, user16Id, server.accessToken)
      user16AccessToken = await userLogin(server, user16)
      await getMyUserInformation(server.url, user16AccessToken, 200)
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
      const resUser = await createUser({
        url: server.url,
        accessToken: server.accessToken,
        username: user17.username,
        password: user17.password
      })

      user17Id = resUser.body.user.id
      user17AccessToken = await userLogin(server, user17)

      const res = await getUserInformation(server.url, server.accessToken, user17Id, true)
      const user: User = res.body

      expect(user.videosCount).to.equal(0)
      expect(user.videoCommentsCount).to.equal(0)
      expect(user.abusesCount).to.equal(0)
      expect(user.abusesCreatedCount).to.equal(0)
      expect(user.abusesAcceptedCount).to.equal(0)
    })

    it('Should report correct videos count', async function () {
      const videoAttributes = {
        name: 'video to test user stats'
      }
      await uploadVideo(server.url, user17AccessToken, videoAttributes)
      const res1 = await getVideosList(server.url)
      videoId = res1.body.data.find(video => video.name === videoAttributes.name).id

      const res2 = await getUserInformation(server.url, server.accessToken, user17Id, true)
      const user: User = res2.body

      expect(user.videosCount).to.equal(1)
    })

    it('Should report correct video comments for user', async function () {
      const text = 'super comment'
      await addVideoCommentThread(server.url, user17AccessToken, videoId, text)

      const res = await getUserInformation(server.url, server.accessToken, user17Id, true)
      const user: User = res.body

      expect(user.videoCommentsCount).to.equal(1)
    })

    it('Should report correct abuses counts', async function () {
      const reason = 'my super bad reason'
      await reportAbuse({ url: server.url, token: user17AccessToken, videoId, reason })

      const res1 = await getAdminAbusesList({ url: server.url, token: server.accessToken })
      const abuseId = res1.body.data[0].id

      const res2 = await getUserInformation(server.url, server.accessToken, user17Id, true)
      const user2: User = res2.body

      expect(user2.abusesCount).to.equal(1) // number of incriminations
      expect(user2.abusesCreatedCount).to.equal(1) // number of reports created

      const body: AbuseUpdate = { state: AbuseState.ACCEPTED }
      await updateAbuse(server.url, server.accessToken, abuseId, body)

      const res3 = await getUserInformation(server.url, server.accessToken, user17Id, true)
      const user3: User = res3.body

      expect(user3.abusesAcceptedCount).to.equal(1) // number of reports created accepted
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
