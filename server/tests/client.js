/* eslint-disable no-unused-expressions */

'use strict'

const chai = require('chai')
const expect = chai.expect
const request = require('supertest')
const series = require('async/series')

const loginUtils = require('./utils/login')
const serversUtils = require('./utils/servers')
const videosUtils = require('./utils/videos')

describe('Test a client controllers', function () {
  let server = null

  before(function (done) {
    this.timeout(120000)

    series([
      function (next) {
        serversUtils.flushTests(next)
      },
      function (next) {
        serversUtils.runServer(1, function (server1) {
          server = server1
          next()
        })
      },
      function (next) {
        loginUtils.loginAndGetAccessToken(server, function (err, token) {
          if (err) throw err
          server.accessToken = token
          next()
        })
      },
      function (next) {
        const videoAttributes = {
          name: 'my super name for pod 1',
          description: 'my super description for pod 1'
        }
        videosUtils.uploadVideo(server.url, server.accessToken, videoAttributes, next)
      },
      function (next) {
        videosUtils.getVideosList(server.url, function (err, res) {
          if (err) throw err

          const videos = res.body.data

          expect(videos.length).to.equal(1)

          server.video = videos[0]

          next()
        })
      }
    ], done)
  })

  it('It should have valid opengraph tags on the watch page with video id', function (done) {
    request(server.url)
      .get('/videos/watch/' + server.video.id)
      .expect(200, function (err, res) {
        if (err) throw err

        expect(res.text).to.contain('<meta property="og:title" content="my super name for pod 1" />')
        expect(res.text).to.contain('<meta property="og:description" content="my super description for pod 1" />')

        done()
      })
  })

  it('It should have valid opengraph tags on the watch page with video uuid', function (done) {
    request(server.url)
      .get('/videos/watch/' + server.video.uuid)
      .expect(200, function (err, res) {
        if (err) throw err

        expect(res.text).to.contain('<meta property="og:title" content="my super name for pod 1" />')
        expect(res.text).to.contain('<meta property="og:description" content="my super description for pod 1" />')

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
