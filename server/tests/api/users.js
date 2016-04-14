'use strict'

const async = require('async')
const chai = require('chai')
const expect = chai.expect
const pathUtils = require('path')

const webtorrent = require(pathUtils.join(__dirname, '../../lib/webtorrent'))
webtorrent.silent = true

const utils = require('./utils')

describe('Test users', function () {
  let server = null
  let access_token = null
  let video_id

  before(function (done) {
    this.timeout(20000)

    async.series([
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
    access_token = 'mysupertoken'
    utils.uploadVideo(server.url, access_token, 'my super name', 'my super description', 'video_short.webm', 401, done)
  })

  it('Should be able to login', function (done) {
    utils.login(server.url, server.client, server.user, 200, function (err, res) {
      if (err) throw err

      access_token = res.body.access_token
      done()
    })
  })

  it('Should upload the video with the correct token', function (done) {
    utils.uploadVideo(server.url, access_token, 'my super name', 'my super description', 'video_short.webm', 204, function (err, res) {
      if (err) throw err

      utils.getVideosList(server.url, function (err, res) {
        if (err) throw err

        video_id = res.body[0].id
        done()
      })
    })
  })

  it('Should upload the video again with the correct token', function (done) {
    utils.uploadVideo(server.url, access_token, 'my super name 2', 'my super description 2', 'video_short.webm', 204, done)
  })

  it('Should not be able to remove the video with an incorrect token', function (done) {
    utils.removeVideo(server.url, 'bad_token', video_id, 401, done)
  })

  it('Should not be able to remove the video with the token of another account')

  it('Should be able to remove the video with the correct token', function (done) {
    utils.removeVideo(server.url, access_token, video_id, done)
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
