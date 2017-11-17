/* tslint:disable:no-unused-expression */
import * as chai from 'chai'
import 'mocha'
import { UserRole } from '../../../shared'
import {
  createUser,
  flushTests,
  getBlacklistedVideosList,
  getMyUserInformation,
  getUserInformation,
  getUsersList,
  getUsersListPaginationAndSort,
  getUserVideoRating,
  getVideosList,
  killallServers,
  login,
  loginAndGetAccessToken,
  makePutBodyRequest,
  rateVideo,
  registerUser,
  removeUser,
  removeVideo,
  runServer,
  ServerInfo,
  updateMyUser,
  updateUser,
  uploadVideo
} from '../utils'
import { follow } from '../utils/follows'
import { getMyVideos } from '../utils/videos'

const expect = chai.expect

describe('Test users', function () {
  let server: ServerInfo
  let accessToken: string
  let accessTokenUser: string
  let videoId: number
  let userId: number

  before(async function () {
    this.timeout(10000)

    await flushTests()
    server = await runServer(1)
  })

  it('Should create a new client')

  it('Should return the first client')

  it('Should remove the last client')

  it('Should not login with an invalid client id', async function () {
    const client = { id: 'client', secret: server.client.secret }
    const res = await login(server.url, client, server.user, 400)

    expect(res.body.error)
      .to
      .equal('invalid_client')
  })

  it('Should not login with an invalid client secret', async function () {
    const client = { id: server.client.id, secret: 'coucou' }
    const res = await login(server.url, client, server.user, 400)

    expect(res.body.error)
      .to
      .equal('invalid_client')
  })

  it('Should not login with an invalid username', async function () {
    const user = { username: 'captain crochet', password: server.user.password }
    const res = await login(server.url, server.client, user, 400)

    expect(res.body.error)
      .to
      .equal('invalid_grant')
  })

  it('Should not login with an invalid password', async function () {
    const user = { username: server.user.username, password: 'mew_three' }
    const res = await login(server.url, server.client, user, 400)

    expect(res.body.error)
      .to
      .equal('invalid_grant')
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
    await uploadVideo(server.url, accessToken, videoAttributes, 204)
    const res = await getVideosList(server.url)
    const video = res.body.data[ 0 ]

    expect(video.account)
      .to
      .equal('root')
    videoId = video.id
  })

  it('Should upload the video again with the correct token', async function () {
    const videoAttributes = {}
    await uploadVideo(server.url, accessToken, videoAttributes, 204)
  })

  it('Should retrieve a video rating', async function () {
    await rateVideo(server.url, accessToken, videoId, 'like')
    const res = await getUserVideoRating(server.url, accessToken, videoId)
    const rating = res.body

    expect(rating.videoId)
      .to
      .equal(videoId)
    expect(rating.rating)
      .to
      .equal('like')
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
    await createUser(server.url, accessToken, 'user_1', 'super password', 2 * 1024 * 1024)
  })

  it('Should be able to login with this user', async function () {
    server.user = {
      username: 'user_1',
      password: 'super password'
    }

    accessTokenUser = await loginAndGetAccessToken(server)
  })

  it('Should be able to get the user information', async function () {
    const res = await getMyUserInformation(server.url, accessTokenUser)
    const user = res.body

    expect(user.username)
      .to
      .equal('user_1')
    expect(user.email)
      .to
      .equal('user_1@example.com')
    expect(user.displayNSFW).to.be.false
    expect(user.videoQuota)
      .to
      .equal(2 * 1024 * 1024)
    expect(user.roleLabel)
      .to
      .equal('User')
    expect(user.id)
      .to
      .be
      .a('number')
  })

  it('Should be able to upload a video with this user', async function () {
    this.timeout(5000)

    const videoAttributes = {
      name: 'super user video'
    }
    await uploadVideo(server.url, accessTokenUser, videoAttributes)
  })

  it('Should be able to list my videos', async function () {
    const res = await getMyVideos(server.url, accessTokenUser, 0, 5)
    expect(res.body.total)
      .to
      .equal(1)

    const videos = res.body.data
    expect(videos)
      .to
      .have
      .lengthOf(1)

    expect(videos[ 0 ].name)
      .to
      .equal('super user video')
  })

  it('Should list all the users', async function () {
    const res = await getUsersList(server.url)
    const result = res.body
    const total = result.total
    const users = result.data

    expect(total)
      .to
      .equal(2)
    expect(users)
      .to
      .be
      .an('array')
    expect(users.length)
      .to
      .equal(2)

    const user = users[ 0 ]
    expect(user.username)
      .to
      .equal('user_1')
    expect(user.email)
      .to
      .equal('user_1@example.com')
    expect(user.displayNSFW).to.be.false

    const rootUser = users[ 1 ]
    expect(rootUser.username)
      .to
      .equal('root')
    expect(rootUser.email)
      .to
      .equal('admin1@example.com')
    expect(rootUser.displayNSFW).to.be.false

    userId = user.id
  })

  it('Should list only the first user by username asc', async function () {
    const res = await getUsersListPaginationAndSort(server.url, 0, 1, 'username')

    const result = res.body
    const total = result.total
    const users = result.data

    expect(total)
      .to
      .equal(2)
    expect(users.length)
      .to
      .equal(1)

    const user = users[ 0 ]
    expect(user.username)
      .to
      .equal('root')
    expect(user.email)
      .to
      .equal('admin1@example.com')
    expect(user.roleLabel)
      .to
      .equal('Administrator')
    expect(user.displayNSFW).to.be.false
  })

  it('Should list only the first user by username desc', async function () {
    const res = await getUsersListPaginationAndSort(server.url, 0, 1, '-username')
    const result = res.body
    const total = result.total
    const users = result.data

    expect(total)
      .to
      .equal(2)
    expect(users.length)
      .to
      .equal(1)

    const user = users[ 0 ]
    expect(user.username)
      .to
      .equal('user_1')
    expect(user.email)
      .to
      .equal('user_1@example.com')
    expect(user.displayNSFW).to.be.false
  })

  it('Should list only the second user by createdAt desc', async function () {
    const res = await getUsersListPaginationAndSort(server.url, 0, 1, '-createdAt')
    const result = res.body
    const total = result.total
    const users = result.data

    expect(total)
      .to
      .equal(2)
    expect(users.length)
      .to
      .equal(1)

    const user = users[ 0 ]
    expect(user.username)
      .to
      .equal('user_1')
    expect(user.email)
      .to
      .equal('user_1@example.com')
    expect(user.displayNSFW).to.be.false
  })

  it('Should list all the users by createdAt asc', async function () {
    const res = await getUsersListPaginationAndSort(server.url, 0, 2, 'createdAt')
    const result = res.body
    const total = result.total
    const users = result.data

    expect(total)
      .to
      .equal(2)
    expect(users.length)
      .to
      .equal(2)

    expect(users[ 0 ].username)
      .to
      .equal('root')
    expect(users[ 0 ].email)
      .to
      .equal('admin1@example.com')
    expect(users[ 0 ].displayNSFW).to.be.false

    expect(users[ 1 ].username)
      .to
      .equal('user_1')
    expect(users[ 1 ].email)
      .to
      .equal('user_1@example.com')
    expect(users[ 1 ].displayNSFW).to.be.false
  })

  it('Should update my password', async function () {
    await updateMyUser(server.url, accessTokenUser, 'new password')
    server.user.password = 'new password'

    await login(server.url, server.client, server.user, 200)
  })

  it('Should be able to change the NSFW display attribute', async function () {
    await updateMyUser(server.url, accessTokenUser, undefined, true)

    const res = await getMyUserInformation(server.url, accessTokenUser)
    const user = res.body

    expect(user.username)
      .to
      .equal('user_1')
    expect(user.email)
      .to
      .equal('user_1@example.com')
    expect(user.displayNSFW).to.be.ok
    expect(user.videoQuota)
      .to
      .equal(2 * 1024 * 1024)
    expect(user.id)
      .to
      .be
      .a('number')
  })

  it('Should be able to change the email display attribute', async function () {
    await updateMyUser(server.url, accessTokenUser, undefined, undefined, 'updated@example.com')

    const res = await getMyUserInformation(server.url, accessTokenUser)
    const user = res.body

    expect(user.username)
      .to
      .equal('user_1')
    expect(user.email)
      .to
      .equal('updated@example.com')
    expect(user.displayNSFW).to.be.ok
    expect(user.videoQuota)
      .to
      .equal(2 * 1024 * 1024)
    expect(user.id)
      .to
      .be
      .a('number')
  })

  it('Should be able to update another user', async function () {
    await updateUser(server.url, userId, accessToken, 'updated2@example.com', 42, UserRole.MODERATOR)

    const res = await getUserInformation(server.url, accessToken, userId)
    const user = res.body

    expect(user.username)
      .to
      .equal('user_1')
    expect(user.email)
      .to
      .equal('updated2@example.com')
    expect(user.displayNSFW).to.be.ok
    expect(user.videoQuota)
      .to
      .equal(42)
    expect(user.roleLabel)
      .to
      .equal('Moderator')
    expect(user.id)
      .to
      .be
      .a('number')
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
    // server.user is already set to user 1
    await login(server.url, server.client, server.user, 400)
  })

  it('Should not have videos of this user', async function () {
    const res = await getVideosList(server.url)

    expect(res.body.total)
      .to
      .equal(1)

    const video = res.body.data[ 0 ]
    expect(video.account)
      .to
      .equal('root')
  })

  it('Should register a new user', async function () {
    await registerUser(server.url, 'user_15', 'my super password')
  })

  it('Should be able to login with this registered user', async function () {
    server.user = {
      username: 'user_15',
      password: 'my super password'
    }

    accessToken = await loginAndGetAccessToken(server)
  })

  it('Should have the correct video quota', async function () {
    const res = await getMyUserInformation(server.url, accessToken)
    const user = res.body

    expect(user.videoQuota)
      .to
      .equal(5 * 1024 * 1024)
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this[ 'ok' ]) {
      await flushTests()
    }
  })
})
