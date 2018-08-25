/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { User, UserRole } from '../../../../shared/index'
import {
  createUser, flushTests, getBlacklistedVideosList, getMyUserInformation, getMyUserVideoQuotaUsed, getMyUserVideoRating,
  getUserInformation, getUsersList, getUsersListPaginationAndSort, getVideosList, killallServers, login, makePutBodyRequest, rateVideo,
  registerUser, removeUser, removeVideo, runServer, ServerInfo, testImage, updateMyAvatar, updateMyUser, updateUser, uploadVideo, userLogin,
  deleteMe, blockUser, unblockUser
} from '../../utils/index'
import { follow } from '../../utils/server/follows'
import { setAccessTokensToServers } from '../../utils/users/login'
import { getMyVideos } from '../../utils/videos/videos'

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

    await flushTests()
    server = await runServer(1)

    await setAccessTokensToServers([ server ])
  })

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

  it('Should upload the video with the correct token', async function () {
    const videoAttributes = {}
    await uploadVideo(server.url, accessToken, videoAttributes)
    const res = await getVideosList(server.url)
    const video = res.body.data[ 0 ]

    expect(video.account.name).to.equal('root')
    videoId = video.id
  })

  it('Should upload the video again with the correct token', async function () {
    const videoAttributes = {}
    await uploadVideo(server.url, accessToken, videoAttributes)
  })

  it('Should retrieve a video rating', async function () {
    await rateVideo(server.url, accessToken, videoId, 'like')
    const res = await getMyUserVideoRating(server.url, accessToken, videoId)
    const rating = res.body

    expect(rating.videoId).to.equal(videoId)
    expect(rating.rating).to.equal('like')
  })

  it('Should not be able to remove the video with an incorrect token', async function () {
    await removeVideo(server.url, 'bad_token', videoId, 401)
  })

  it('Should not be able to remove the video with the token of another account')

  it('Should be able to remove the video with the correct token', async function () {
    await removeVideo(server.url, accessToken, videoId)
  })

  it('Should logout (revoke token)')

  it('Should not be able to get the user information')

  it('Should not be able to upload a video')

  it('Should not be able to remove a video')

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

  it('Should be able to login again')

  it('Should have an expired access token')

  it('Should refresh the token')

  it('Should be able to upload a video again')

  it('Should be able to create a new user', async function () {
    await createUser(server.url, accessToken, user.username,user.password, 2 * 1024 * 1024)
  })

  it('Should be able to login with this user', async function () {
    accessTokenUser = await userLogin(server, user)
  })

  it('Should be able to get the user information', async function () {
    const res = await getMyUserInformation(server.url, accessTokenUser)
    const user = res.body

    expect(user.username).to.equal('user_1')
    expect(user.email).to.equal('user_1@example.com')
    expect(user.nsfwPolicy).to.equal('display')
    expect(user.videoQuota).to.equal(2 * 1024 * 1024)
    expect(user.roleLabel).to.equal('User')
    expect(user.id).to.be.a('number')
    expect(user.account.displayName).to.equal('user_1')
    expect(user.account.description).to.be.null
  })

  it('Should be able to upload a video with this user', async function () {
    this.timeout(5000)

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

    expect(videos[ 0 ].name).to.equal('super user video')
  })

  it('Should list all the users', async function () {
    const res = await getUsersList(server.url, server.accessToken)
    const result = res.body
    const total = result.total
    const users = result.data

    expect(total).to.equal(2)
    expect(users).to.be.an('array')
    expect(users.length).to.equal(2)

    const user = users[ 0 ]
    expect(user.username).to.equal('user_1')
    expect(user.email).to.equal('user_1@example.com')
    expect(user.nsfwPolicy).to.equal('display')

    const rootUser = users[ 1 ]
    expect(rootUser.username).to.equal('root')
    expect(rootUser.email).to.equal('admin1@example.com')
    expect(user.nsfwPolicy).to.equal('display')

    userId = user.id
  })

  it('Should list only the first user by username asc', async function () {
    const res = await getUsersListPaginationAndSort(server.url, server.accessToken, 0, 1, 'username')

    const result = res.body
    const total = result.total
    const users = result.data

    expect(total).to.equal(2)
    expect(users.length).to.equal(1)

    const user = users[ 0 ]
    expect(user.username).to.equal('root')
    expect(user.email).to.equal('admin1@example.com')
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

    const user = users[ 0 ]
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

    const user = users[ 0 ]
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

    expect(users[ 0 ].username).to.equal('root')
    expect(users[ 0 ].email).to.equal('admin1@example.com')
    expect(users[ 0 ].nsfwPolicy).to.equal('display')

    expect(users[ 1 ].username).to.equal('user_1')
    expect(users[ 1 ].email).to.equal('user_1@example.com')
    expect(users[ 1 ].nsfwPolicy).to.equal('display')
  })

  it('Should update my password', async function () {
    await updateMyUser({
      url: server.url,
      accessToken: accessTokenUser,
      newPassword: 'new password'
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

  it('Should be able to change the email display attribute', async function () {
    await updateMyUser({
      url: server.url,
      accessToken: accessTokenUser,
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
    const user = res.body

    expect(user.username).to.equal('user_1')
    expect(user.email).to.equal('updated@example.com')
    expect(user.nsfwPolicy).to.equal('do_not_list')
    expect(user.videoQuota).to.equal(2 * 1024 * 1024)
    expect(user.id).to.be.a('number')
    expect(user.account.displayName).to.equal('new display name')
    expect(user.account.description).to.equal('my super description updated')
  })

  it('Should be able to update another user', async function () {
    await updateUser({
      url: server.url,
      userId,
      accessToken,
      email: 'updated2@example.com',
      videoQuota: 42,
      role: UserRole.MODERATOR
    })

    const res = await getUserInformation(server.url, accessToken, userId)
    const user = res.body

    expect(user.username).to.equal('user_1')
    expect(user.email).to.equal('updated2@example.com')
    expect(user.nsfwPolicy).to.equal('do_not_list')
    expect(user.videoQuota).to.equal(42)
    expect(user.roleLabel).to.equal('Moderator')
    expect(user.id).to.be.a('number')
  })

  it('Should have removed the user token', async function () {
    await getMyUserVideoQuotaUsed(server.url, accessTokenUser, 401)

    accessTokenUser = await userLogin(server, user)
  })

  it('Should not be able to delete a user by a moderator', async function () {
    await removeUser(server.url, 2, accessTokenUser, 403)
  })

  it('Should be able to list video blacklist by a moderator', async function () {
    await getBlacklistedVideosList(server.url, accessTokenUser)
  })

  it('Should be able to remove this user', async function () {
    await removeUser(server.url, userId, accessToken)
  })

  it('Should not be able to login with this user', async function () {
    await userLogin(server, user, 400)
  })

  it('Should not have videos of this user', async function () {
    const res = await getVideosList(server.url)

    expect(res.body.total).to.equal(1)

    const video = res.body.data[ 0 ]
    expect(video.account.name).to.equal('root')
  })

  it('Should register a new user', async function () {
    await registerUser(server.url, 'user_15', 'my super password')
  })

  it('Should be able to login with this registered user', async function () {
    const user15 = {
      username: 'user_15',
      password: 'my super password'
    }

    accessToken = await userLogin(server, user15)
  })

  it('Should have the correct video quota', async function () {
    const res = await getMyUserInformation(server.url, accessToken)
    const user = res.body

    expect(user.videoQuota).to.equal(5 * 1024 * 1024)
  })

  it('Should remove me', async function () {
    {
      const res = await getUsersList(server.url, server.accessToken)
      expect(res.body.data.find(u => u.username === 'user_15')).to.not.be.undefined
    }

    await deleteMe(server.url, accessToken)

    {
      const res = await getUsersList(server.url, server.accessToken)
      expect(res.body.data.find(u => u.username === 'user_15')).to.be.undefined
    }
  })

  it('Should block and unblock a user', async function () {
    const user16 = {
      username: 'user_16',
      password: 'my super password'
    }
    const resUser = await createUser(server.url, server.accessToken, user16.username, user16.password)
    const user16Id = resUser.body.user.id

    accessToken = await userLogin(server, user16)

    await getMyUserInformation(server.url, accessToken, 200)
    await blockUser(server.url, user16Id, server.accessToken)

    await getMyUserInformation(server.url, accessToken, 401)
    await userLogin(server, user16, 400)

    await unblockUser(server.url, user16Id, server.accessToken)
    accessToken = await userLogin(server, user16)
    await getMyUserInformation(server.url, accessToken, 200)
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this[ 'ok' ]) {
      await flushTests()
    }
  })
})
