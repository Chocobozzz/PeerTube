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
const videoAbusesUtils = require('../utils/video-abuses')

describe('Test video abuses', function () {
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
      // Upload some videos on each pods
      function (next) {
        const videoAttributes = {
          name: 'my super name for pod 1',
          description: 'my super description for pod 1'
        }
        videosUtils.uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes, next)
      },
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

          expect(videos.length).to.equal(2)

          servers[0].video = videos.find(function (video) { return video.name === 'my super name for pod 1' })
          servers[1].video = videos.find(function (video) { return video.name === 'my super name for pod 2' })

          next()
        })
      }
    ], done)
  })

  it('Should not have video abuses', function (done) {
    videoAbusesUtils.getVideoAbusesList(servers[0].url, servers[0].accessToken, function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(0)

      done()
    })
  })

  it('Should report abuse on a local video', function (done) {
    this.timeout(15000)

    const reason = 'my super bad reason'
    videoAbusesUtils.reportVideoAbuse(servers[0].url, servers[0].accessToken, servers[0].video.id, reason, function (err) {
      if (err) throw err

      // We wait requests propagation, even if the pod 1 is not supposed to make a request to pod 2
      setTimeout(done, 11000)
    })
  })

  it('Should have 1 video abuses on pod 1 and 0 on pod 2', function (done) {
    videoAbusesUtils.getVideoAbusesList(servers[0].url, servers[0].accessToken, function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(1)

      const abuse = res.body.data[0]
      expect(abuse.reason).to.equal('my super bad reason')
      expect(abuse.reporterUsername).to.equal('root')
      expect(abuse.reporterPodHost).to.equal('localhost:9001')
      expect(abuse.videoId).to.equal(servers[0].video.id)

      videoAbusesUtils.getVideoAbusesList(servers[1].url, servers[1].accessToken, function (err, res) {
        if (err) throw err

        expect(res.body.total).to.equal(0)
        expect(res.body.data).to.be.an('array')
        expect(res.body.data.length).to.equal(0)

        done()
      })
    })
  })

  it('Should report abuse on a remote video', function (done) {
    this.timeout(15000)

    const reason = 'my super bad reason 2'
    videoAbusesUtils.reportVideoAbuse(servers[0].url, servers[0].accessToken, servers[1].video.id, reason, function (err) {
      if (err) throw err

      // We wait requests propagation
      setTimeout(done, 11000)
    })
  })

  it('Should have 2 video abuse on pod 1 and 1 on pod 2', function (done) {
    videoAbusesUtils.getVideoAbusesList(servers[0].url, servers[0].accessToken, function (err, res) {
      if (err) throw err

      expect(res.body.total).to.equal(2)
      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(2)

      let abuse = res.body.data[0]
      expect(abuse.reason).to.equal('my super bad reason')
      expect(abuse.reporterUsername).to.equal('root')
      expect(abuse.reporterPodHost).to.equal('localhost:9001')
      expect(abuse.videoId).to.equal(servers[0].video.id)

      abuse = res.body.data[1]
      expect(abuse.reason).to.equal('my super bad reason 2')
      expect(abuse.reporterUsername).to.equal('root')
      expect(abuse.reporterPodHost).to.equal('localhost:9001')
      expect(abuse.videoId).to.equal(servers[1].video.id)

      videoAbusesUtils.getVideoAbusesList(servers[1].url, servers[1].accessToken, function (err, res) {
        if (err) throw err

        expect(res.body.total).to.equal(1)
        expect(res.body.data).to.be.an('array')
        expect(res.body.data.length).to.equal(1)

        let abuse = res.body.data[0]
        expect(abuse.reason).to.equal('my super bad reason 2')
        expect(abuse.reporterUsername).to.equal('root')
        expect(abuse.reporterPodHost).to.equal('localhost:9001')

        done()
      })
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
