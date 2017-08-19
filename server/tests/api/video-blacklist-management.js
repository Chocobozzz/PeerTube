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

describe('Test video blacklists management', function () {
  let servers = []

  before(function (done) {
    this.timeout(120000)

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
      // Upload 2 videos on pod 2
      function (next) {
        videosUtils.uploadVideo(servers[1].url, servers[1].accessToken, { name: 'My 1st video', description: 'A video on pod 2' }, next)
      },
      function (next) {
        videosUtils.uploadVideo(servers[1].url, servers[1].accessToken, { name: 'My 2nd video', description: 'A video on pod 2' }, next)
      },
      // Wait videos propagation
      function (next) {
        setTimeout(next, 22000)
      },
      // Blacklist the two videos on pod 1
      function (next) {
        videosUtils.getVideosList(servers[0].url, function (err, res) {
          if (err) throw err

          const videos = res.body.data

          each(videos,
               function (video, next) {
		 videoBlacklistsUtils.addVideoToBlacklist(servers[0].url, servers[0].accessToken, video.id, next)
	       },
               next
          )
        })
      }
    ], done)
  })

  describe('When listing blacklisted videos', function () {
    it('Should display all the blacklisted videos', function (done) {
      videoBlacklistsUtils.getBlacklistedVideosList(servers[0].url, servers[0].accessToken, function (err, res) {
        if (err) throw err

        expect(res.body.total).to.equal(2)

	const videos = res.body.data
	expect(videos).to.be.an('array')
	expect(videos.length).to.equal(2)

	done()
      })
    })

    it('Should get the correct sort when sorting by descending video name', function (done) {
      videoBlacklistsUtils.getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, '-name', function (err, res) {
        if (err) throw err

        expect(res.body.total).to.equal(2)

        const videos = res.body.data
        expect(videos).to.be.an('array')
        expect(videos.length).to.equal(2)

        const result = res.body.data.slice(0).sort((a, b) => {
          if (a.name > b.name) return -1
          if (a.name < b.name) return 1
          return 0
        })

        expect(videos).to.deep.equal(result)

        done()
      })
    })

    it('Should get the correct sort when sorting by ascending creation date', function (done) {
      videoBlacklistsUtils.getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, 'createdAt', function (err, res) {
        if (err) throw err

        expect(res.body.total).to.equal(2)

        const videos = res.body.data
        expect(videos).to.be.an('array')
        expect(videos.length).to.equal(2)

        const result = res.body.data.slice(0).sort((a, b) => {
          if (a.createdAt < b.createdAt) return -1
          if (a.createdAt > b.createdAt) return 1
          return 0
        })

        expect(videos).to.deep.equal(result)

        done()
      })
    })
  })

  describe('When removing a blacklisted video', function () {
    // it('Should not have the blacklisted video in videos search on pod 1')
    it('Should remove the video from the blacklist on pod 1')
    it('Should have the blacklisted video in videos serach on pod 1')

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
