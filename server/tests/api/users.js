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
  let videoId

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

  it('Should logout')

  it('Should not be able to upload a video')

  it('Should not be able to remove a video')

  it('Should be able to login again')

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
