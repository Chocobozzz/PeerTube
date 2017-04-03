/* eslint-disable no-unused-expressions */

'use strict'

const chai = require('chai')
const expect = chai.expect
const series = require('async/series')

const loginUtils = require('../utils/login')
const podsUtils = require('../utils/pods')
const serversUtils = require('../utils/servers')
const usersUtils = require('../utils/users')
const requestsUtils = require('../utils/requests')
const videosUtils = require('../utils/videos')

describe('Test users', function () {
  let server = null
  let accessToken = null
  let accessTokenUser = null
  let videoId = null
  let userId = null

  before(function (done) {
    this.timeout(20000)

    series([
      function (next) {
        serversUtils.flushTests(next)
      },
      function (next) {
        serversUtils.runServer(1, function (server1) {
          server = server1
          next()
        })
      }
    ], done)
  })

  it('Should create a new client')

  it('Should return the first client')

  it('Should remove the last client')

  it('Should not login with an invalid client id', function (done) {
    const client = { id: 'client', password: server.client.secret }
    loginUtils.login(server.url, client, server.user, 400, function (err, res) {
      if (err) throw err

      expect(res.body.error).to.equal('invalid_client')
      done()
    })
  })

  it('Should not login with an invalid client password', function (done) {
    const client = { id: server.client.id, password: 'coucou' }
    loginUtils.login(server.url, client, server.user, 400, function (err, res) {
      if (err) throw err

      expect(res.body.error).to.equal('invalid_client')
      done()
    })
  })

  it('Should not login with an invalid username', function (done) {
    const user = { username: 'captain crochet', password: server.user.password }
    loginUtils.login(server.url, server.client, user, 400, function (err, res) {
      if (err) throw err

      expect(res.body.error).to.equal('invalid_grant')
      done()
    })
  })

  it('Should not login with an invalid password', function (done) {
    const user = { username: server.user.username, password: 'mewthree' }
    loginUtils.login(server.url, server.client, user, 400, function (err, res) {
      if (err) throw err

      expect(res.body.error).to.equal('invalid_grant')
      done()
    })
  })

  it('Should not be able to upload a video', function (done) {
    accessToken = 'mysupertoken'

    const videoAttributes = {}
    videosUtils.uploadVideo(server.url, accessToken, videoAttributes, 401, done)
  })

  it('Should not be able to make friends', function (done) {
    accessToken = 'mysupertoken'
    podsUtils.makeFriends(server.url, accessToken, 401, done)
  })

  it('Should not be able to quit friends', function (done) {
    accessToken = 'mysupertoken'
    podsUtils.quitFriends(server.url, accessToken, 401, done)
  })

  it('Should be able to login', function (done) {
    loginUtils.login(server.url, server.client, server.user, 200, function (err, res) {
      if (err) throw err

      accessToken = res.body.access_token
      done()
    })
  })

  it('Should upload the video with the correct token', function (done) {
    const videoAttributes = {}
    videosUtils.uploadVideo(server.url, accessToken, videoAttributes, 204, function (err, res) {
      if (err) throw err

      videosUtils.getVideosList(server.url, function (err, res) {
        if (err) throw err

        const video = res.body.data[0]
        expect(video.author).to.equal('root')

        videoId = video.id
        done()
      })
    })
  })

  it('Should upload the video again with the correct token', function (done) {
    const videoAttributes = {}
    videosUtils.uploadVideo(server.url, accessToken, videoAttributes, 204, done)
  })

  it('Should retrieve a video rating', function (done) {
    videosUtils.rateVideo(server.url, accessToken, videoId, 'like', function (err) {
      if (err) throw err

      usersUtils.getUserVideoRating(server.url, accessToken, videoId, function (err, res) {
        if (err) throw err

        const rating = res.body

        expect(rating.videoId).to.equal(videoId)
        expect(rating.rating).to.equal('like')

        done()
      })
    })
  })

  it('Should not be able to remove the video with an incorrect token', function (done) {
    videosUtils.removeVideo(server.url, 'bad_token', videoId, 401, done)
  })

  it('Should not be able to remove the video with the token of another account')

  it('Should be able to remove the video with the correct token', function (done) {
    videosUtils.removeVideo(server.url, accessToken, videoId, done)
  })

  it('Should logout (revoke token)')

  it('Should not be able to get the user informations')

  it('Should not be able to upload a video')

  it('Should not be able to remove a video')

  it('Should not be able to rate a video', function (done) {
    const path = '/api/v1/videos/'
    const data = {
      rating: 'likes'
    }

    requestsUtils.makePutBodyRequest(server.url, path + videoId, 'wrong token', data, done, 401)
  })

  it('Should be able to login again')

  it('Should have an expired access token')

  it('Should refresh the token')

  it('Should be able to upload a video again')

  it('Should be able to create a new user', function (done) {
    usersUtils.createUser(server.url, accessToken, 'user_1', 'super password', done)
  })

  it('Should be able to login with this user', function (done) {
    server.user = {
      username: 'user_1',
      password: 'super password'
    }

    loginUtils.loginAndGetAccessToken(server, function (err, token) {
      if (err) throw err

      accessTokenUser = token

      done()
    })
  })

  it('Should be able to get the user informations', function (done) {
    usersUtils.getUserInformation(server.url, accessTokenUser, function (err, res) {
      if (err) throw err

      const user = res.body

      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('user_1@example.com')
      expect(user.displayNSFW).to.be.falsy
      expect(user.id).to.exist

      done()
    })
  })

  it('Should be able to upload a video with this user', function (done) {
    this.timeout(5000)

    const videoAttributes = {}
    videosUtils.uploadVideo(server.url, accessTokenUser, videoAttributes, done)
  })

  it('Should list all the users', function (done) {
    usersUtils.getUsersList(server.url, function (err, res) {
      if (err) throw err

      const result = res.body
      const total = result.total
      const users = result.data

      expect(total).to.equal(2)
      expect(users).to.be.an('array')
      expect(users.length).to.equal(2)

      const user = users[0]
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('user_1@example.com')
      expect(user.displayNSFW).to.be.falsy

      const rootUser = users[1]
      expect(rootUser.username).to.equal('root')
      expect(rootUser.email).to.equal('admin1@example.com')
      expect(rootUser.displayNSFW).to.be.falsy

      userId = user.id

      done()
    })
  })

  it('Should list only the first user by username asc', function (done) {
    usersUtils.getUsersListPaginationAndSort(server.url, 0, 1, 'username', function (err, res) {
      if (err) throw err

      const result = res.body
      const total = result.total
      const users = result.data

      expect(total).to.equal(2)
      expect(users.length).to.equal(1)

      const user = users[0]
      expect(user.username).to.equal('root')
      expect(user.email).to.equal('admin1@example.com')
      expect(user.displayNSFW).to.be.falsy

      done()
    })
  })

  it('Should list only the first user by username desc', function (done) {
    usersUtils.getUsersListPaginationAndSort(server.url, 0, 1, '-username', function (err, res) {
      if (err) throw err

      const result = res.body
      const total = result.total
      const users = result.data

      expect(total).to.equal(2)
      expect(users.length).to.equal(1)

      const user = users[0]
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('user_1@example.com')
      expect(user.displayNSFW).to.be.falsy

      done()
    })
  })

  it('Should list only the second user by createdAt desc', function (done) {
    usersUtils.getUsersListPaginationAndSort(server.url, 0, 1, '-createdAt', function (err, res) {
      if (err) throw err

      const result = res.body
      const total = result.total
      const users = result.data

      expect(total).to.equal(2)
      expect(users.length).to.equal(1)

      const user = users[0]
      expect(user.username).to.equal('user_1')
      expect(user.email).to.equal('user_1@example.com')
      expect(user.displayNSFW).to.be.falsy

      done()
    })
  })

  it('Should list all the users by createdAt asc', function (done) {
    usersUtils.getUsersListPaginationAndSort(server.url, 0, 2, 'createdAt', function (err, res) {
      if (err) throw err

      const result = res.body
      const total = result.total
      const users = result.data

      expect(total).to.equal(2)
      expect(users.length).to.equal(2)

      expect(users[0].username).to.equal('root')
      expect(users[0].email).to.equal('admin1@example.com')
      expect(users[0].displayNSFW).to.be.falsy

      expect(users[1].username).to.equal('user_1')
      expect(users[1].email).to.equal('user_1@example.com')
      expect(users[1].displayNSFW).to.be.falsy

      done()
    })
  })

  it('Should update the user password', function (done) {
    usersUtils.updateUser(server.url, userId, accessTokenUser, 'new password', null, function (err, res) {
      if (err) throw err

      server.user.password = 'new password'
      loginUtils.login(server.url, server.client, server.user, 200, done)
    })
  })

  it('Should be able to change the NSFW display attribute', function (done) {
    usersUtils.updateUser(server.url, userId, accessTokenUser, null, true, function (err, res) {
      if (err) throw err

      usersUtils.getUserInformation(server.url, accessTokenUser, function (err, res) {
        if (err) throw err

        const user = res.body

        expect(user.username).to.equal('user_1')
        expect(user.email).to.equal('user_1@example.com')
        expect(user.displayNSFW).to.be.truthy
        expect(user.id).to.exist

        done()
      })
    })
  })

  it('Should be able to remove this user', function (done) {
    usersUtils.removeUser(server.url, userId, accessToken, done)
  })

  it('Should not be able to login with this user', function (done) {
    // server.user is already set to user 1
    loginUtils.login(server.url, server.client, server.user, 400, done)
  })

  it('Should not have videos of this user', function (done) {
    videosUtils.getVideosList(server.url, function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(1)
      const video = res.body.data[0]
      expect(video.author).to.equal('root')

      done()
    })
  })

  after(function (done) {
    process.kill(-server.app.pid)

    // Keep the logs if the test failed
    if (this.ok) {
      serversUtils.flushTests(done)
    } else {
      done()
    }
  })
})
