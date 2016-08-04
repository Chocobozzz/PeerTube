'use strict'

const chai = require('chai')
const expect = chai.expect
const pathUtils = require('path')
const series = require('async/series')

const webtorrent = require(pathUtils.join(__dirname, '../../lib/webtorrent'))
webtorrent.silent = true

const utils = require('./utils')

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
        utils.flushTests(next)
      },
      function (next) {
        utils.runServer(1, function (server1) {
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
    utils.login(server.url, client, server.user, 400, function (err, res) {
      if (err) throw err

      expect(res.body.error).to.equal('invalid_client')
      done()
    })
  })

  it('Should not login with an invalid client password', function (done) {
    const client = { id: server.client.id, password: 'coucou' }
    utils.login(server.url, client, server.user, 400, function (err, res) {
      if (err) throw err

      expect(res.body.error).to.equal('invalid_client')
      done()
    })
  })

  it('Should not login with an invalid username', function (done) {
    const user = { username: 'captain crochet', password: server.user.password }
    utils.login(server.url, server.client, user, 400, function (err, res) {
      if (err) throw err

      expect(res.body.error).to.equal('invalid_grant')
      done()
    })
  })

  it('Should not login with an invalid password', function (done) {
    const user = { username: server.user.username, password: 'mewthree' }
    utils.login(server.url, server.client, user, 400, function (err, res) {
      if (err) throw err

      expect(res.body.error).to.equal('invalid_grant')
      done()
    })
  })

  it('Should not be able to upload a video', function (done) {
    accessToken = 'mysupertoken'

    const name = 'my super name'
    const description = 'my super description'
    const tags = [ 'tag1', 'tag2' ]
    const video = 'video_short.webm'
    utils.uploadVideo(server.url, accessToken, name, description, tags, video, 401, done)
  })

  it('Should not be able to make friends', function (done) {
    accessToken = 'mysupertoken'
    utils.makeFriends(server.url, accessToken, 401, done)
  })

  it('Should not be able to quit friends', function (done) {
    accessToken = 'mysupertoken'
    utils.quitFriends(server.url, accessToken, 401, done)
  })

  it('Should be able to login', function (done) {
    utils.login(server.url, server.client, server.user, 200, function (err, res) {
      if (err) throw err

      accessToken = res.body.access_token
      done()
    })
  })

  it('Should upload the video with the correct token', function (done) {
    const name = 'my super name'
    const description = 'my super description'
    const tags = [ 'tag1', 'tag2' ]
    const video = 'video_short.webm'
    utils.uploadVideo(server.url, accessToken, name, description, tags, video, 204, function (err, res) {
      if (err) throw err

      utils.getVideosList(server.url, function (err, res) {
        if (err) throw err

        const video = res.body.data[0]
        expect(video.author).to.equal('root')

        videoId = video.id
        done()
      })
    })
  })

  it('Should upload the video again with the correct token', function (done) {
    const name = 'my super name 2'
    const description = 'my super description 2'
    const tags = [ 'tag1' ]
    const video = 'video_short.webm'
    utils.uploadVideo(server.url, accessToken, name, description, tags, video, 204, done)
  })

  it('Should not be able to remove the video with an incorrect token', function (done) {
    utils.removeVideo(server.url, 'bad_token', videoId, 401, done)
  })

  it('Should not be able to remove the video with the token of another account')

  it('Should be able to remove the video with the correct token', function (done) {
    utils.removeVideo(server.url, accessToken, videoId, done)
  })

  it('Should logout (revoke token)')

  it('Should not be able to upload a video')

  it('Should not be able to remove a video')

  it('Should be able to login again')

  it('Should have an expired access token')

  it('Should refresh the token')

  it('Should be able to upload a video again')

  it('Should be able to create a new user', function (done) {
    utils.createUser(server.url, accessToken, 'user_1', 'super password', done)
  })

  it('Should be able to login with this user', function (done) {
    server.user = {
      username: 'user_1',
      password: 'super password'
    }

    utils.loginAndGetAccessToken(server, function (err, token) {
      if (err) throw err

      accessTokenUser = token

      done()
    })
  })

  it('Should be able to upload a video with this user', function (done) {
    this.timeout(5000)

    const name = 'my super name'
    const description = 'my super description'
    const tags = [ 'tag1', 'tag2', 'tag3' ]
    const file = 'video_short.webm'
    utils.uploadVideo(server.url, accessTokenUser, name, description, tags, file, done)
  })

  it('Should list all the users', function (done) {
    utils.getUsersList(server.url, function (err, res) {
      if (err) throw err

      const users = res.body.data

      expect(users).to.be.an('array')
      expect(users.length).to.equal(2)

      const rootUser = users[0]
      expect(rootUser.username).to.equal('root')

      const user = users[1]
      expect(user.username).to.equal('user_1')
      userId = user.id

      done()
    })
  })

  it('Should update the user password', function (done) {
    utils.updateUser(server.url, userId, accessTokenUser, 'new password', function (err, res) {
      if (err) throw err

      server.user.password = 'new password'
      utils.login(server.url, server.client, server.user, 200, done)
    })
  })

  it('Should be able to remove this user', function (done) {
    utils.removeUser(server.url, accessToken, 'user_1', done)
  })

  it('Should not be able to login with this user', function (done) {
    // server.user is already set to user 1
    utils.login(server.url, server.client, server.user, 400, done)
  })

  it('Should not have videos of this user', function (done) {
    utils.getVideosList(server.url, function (err, res) {
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
      utils.flushTests(done)
    } else {
      done()
    }
  })
})
