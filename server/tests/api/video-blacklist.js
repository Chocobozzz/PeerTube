/* eslint-disable no-unused-expressions */

'use strict'

const chai = require('chai')
const each = require('async/each')
const expect = chai.expect
const series = require('async/series')

const loginUtils = require('../utils/login')
const podsUtils = require('../utils/pods')
const serversUtils = require('../utils/servers')
const videosUtils = require('../utils/videos')
const videoBlacklistsUtils = require('../utils/video-blacklists')

describe('Test video blacklists', function () {
  let servers = []

  before(function (done) {
    this.timeout(40000)

    series([
      // Run servers
      function (next) {
        serversUtils.flushAndRunMultipleServers(2, function (serversRun) {
          servers = serversRun
          next()
        })
      },
      // Get the access tokens
      function (next) {
        each(servers, function (server, callbackEach) {
          loginUtils.loginAndGetAccessToken(server, function (err, accessToken) {
            if (err) return callbackEach(err)

            server.accessToken = accessToken
            callbackEach()
          })
        }, next)
      },
      // Pod 1 makes friend with pod 2
      function (next) {
        const server = servers[0]
        podsUtils.makeFriends(server.url, server.accessToken, next)
      },
      // Upload a video on pod 2
      function (next) {
        const videoAttributes = {
          name: 'my super name for pod 2',
          description: 'my super description for pod 2'
        }
        videosUtils.uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes, next)
      },
      // Wait videos propagation
      function (next) {
        setTimeout(next, 22000)
      },
      function (next) {
        videosUtils.getVideosList(servers[0].url, function (err, res) {
          if (err) throw err

          const videos = res.body.data

          expect(videos.length).to.equal(1)

          servers[0].remoteVideo = videos.find(function (video) { return video.name === 'my super name for pod 2' })

          next()
        })
      }
    ], done)
  })

  it('Should blacklist a remote video on pod 1', function (done) {
    videoBlacklistsUtils.addVideoToBlacklist(servers[0].url, servers[0].accessToken, servers[0].remoteVideo.id, done)
  })

  it('Should not have the video blacklisted in videos list on pod 1', function (done) {
    videosUtils.getVideosList(servers[0].url, function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(0)

      done()
    })
  })

  it('Should not have the video blacklisted in videos search on pod 1', function (done) {
    videosUtils.searchVideo(servers[0].url, 'name', function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(0)

      done()
    })
  })

  it('Should have the blacklisted video in videos list on pod 2', function (done) {
    videosUtils.getVideosList(servers[1].url, function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(1)

      done()
    })
  })

  it('Should have the video blacklisted in videos search on pod 2', function (done) {
    videosUtils.searchVideo(servers[1].url, 'name', function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(1)

      done()
    })
  })

  after(function (done) {
    servers.forEach(function (server) {
      process.kill(-server.app.pid)
    })

    // Keep the logs if the test failed
    if (this.ok) {
      serversUtils.flushTests(done)
    } else {
      done()
    }
  })
})
