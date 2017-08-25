/* eslint-disable no-unused-expressions */

'use strict'

const chai = require('chai')
const each = require('async/each')
const expect = chai.expect
const series = require('async/series')
const webtorrent = new (require('webtorrent'))()

const loginUtils = require('../utils/login')
const serversUtils = require('../utils/servers')
const videosUtils = require('../utils/videos')

describe('Test video transcoding', function () {
  let servers = []

  before(function (done) {
    this.timeout(30000)

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
      }
    ], done)
  })

  it('Should not transcode video on server 1', function (done) {
    this.timeout(60000)

    const videoAttributes = {
      name: 'my super name for pod 1',
      description: 'my super description for pod 1',
      fixture: 'video_short.webm'
    }
    videosUtils.uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes, function (err) {
      if (err) throw err

      setTimeout(function () {
        videosUtils.getVideosList(servers[0].url, function (err, res) {
          if (err) throw err

          const video = res.body.data[0]
          const magnetUri = video.files[0].magnetUri
          expect(magnetUri).to.match(/\.webm/)

          webtorrent.add(magnetUri, function (torrent) {
            expect(torrent.files).to.exist
            expect(torrent.files.length).to.equal(1)
            expect(torrent.files[0].path).match(/\.webm$/)

            done()
          })
        })
      }, 30000)
    })
  })

  it('Should transcode video on server 2', function (done) {
    this.timeout(60000)

    const videoAttributes = {
      name: 'my super name for pod 2',
      description: 'my super description for pod 2',
      fixture: 'video_short.webm'
    }
    videosUtils.uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes, function (err) {
      if (err) throw err

      setTimeout(function () {
        videosUtils.getVideosList(servers[1].url, function (err, res) {
          if (err) throw err

          const video = res.body.data[0]
          const magnetUri = video.files[0].magnetUri
          expect(magnetUri).to.match(/\.mp4/)

          webtorrent.add(magnetUri, function (torrent) {
            expect(torrent.files).to.exist
            expect(torrent.files.length).to.equal(1)
            expect(torrent.files[0].path).match(/\.mp4$/)

            done()
          })
        })
      }, 30000)
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
