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

describe('Test advanced friends', function () {
  let servers = []

  function makeFriends (podNumber, callback) {
    const server = servers[podNumber - 1]
    return podsUtils.makeFriends(server.url, server.accessToken, callback)
  }

  function quitFriends (podNumber, callback) {
    const server = servers[podNumber - 1]
    return podsUtils.quitFriends(server.url, server.accessToken, callback)
  }

  function getFriendsList (podNumber, end) {
    const server = servers[podNumber - 1]
    return podsUtils.getFriendsList(server.url, end)
  }

  function uploadVideo (podNumber, callback) {
    const name = 'my super video'
    const category = 5
    const description = 'my super description'
    const tags = [ 'tag1', 'tag2' ]
    const fixture = 'video_short.webm'
    const server = servers[podNumber - 1]

    return videosUtils.uploadVideo(server.url, server.accessToken, name, category, description, tags, fixture, callback)
  }

  function getVideos (podNumber, callback) {
    return videosUtils.getVideosList(servers[podNumber - 1].url, callback)
  }

  // ---------------------------------------------------------------

  before(function (done) {
    this.timeout(30000)
    serversUtils.flushAndRunMultipleServers(6, function (serversRun, urlsRun) {
      servers = serversRun

      each(servers, function (server, callbackEach) {
        loginUtils.loginAndGetAccessToken(server, function (err, accessToken) {
          if (err) return callbackEach(err)

          server.accessToken = accessToken
          callbackEach()
        })
      }, done)
    })
  })

  it('Should make friends with two pod each in a different group', function (done) {
    this.timeout(20000)

    series([
      // Pod 3 makes friend with the first one
      function (next) {
        makeFriends(3, next)
      },
      // Pod 4 makes friend with the second one
      function (next) {
        makeFriends(4, next)
      },
      // Now if the fifth wants to make friends with the third et the first
      function (next) {
        makeFriends(5, next)
      },
      function (next) {
        setTimeout(next, 11000)
      }],
      function (err) {
        if (err) throw err

        // It should have 0 friends
        getFriendsList(5, function (err, res) {
          if (err) throw err

          expect(res.body.data.length).to.equal(0)

          done()
        })
      }
    )
  })

  it('Should quit all friends', function (done) {
    this.timeout(10000)

    series([
      function (next) {
        quitFriends(1, next)
      },
      function (next) {
        quitFriends(2, next)
      }],
      function (err) {
        if (err) throw err

        each([ 1, 2, 3, 4, 5, 6 ], function (i, callback) {
          getFriendsList(i, function (err, res) {
            if (err) throw err

            expect(res.body.data.length).to.equal(0)

            callback()
          })
        }, done)
      }
    )
  })

  it('Should make friends with the pods 1, 2, 3', function (done) {
    this.timeout(150000)

    series([
      // Pods 1, 2, 3 and 4 become friends
      function (next) {
        makeFriends(2, next)
      },
      function (next) {
        makeFriends(1, next)
      },
      function (next) {
        makeFriends(4, next)
      },
      // Check the pods 1, 2, 3 and 4 are friends
      function (next) {
        each([ 1, 2, 3, 4 ], function (i, callback) {
          getFriendsList(i, function (err, res) {
            if (err) throw err

            expect(res.body.data.length).to.equal(3)

            callback()
          })
        }, next)
      },
      // Kill pod 4
      function (next) {
        servers[3].app.kill()
        next()
      },
      // Expulse pod 4 from pod 1 and 2
      function (next) {
        uploadVideo(1, next)
      },
      function (next) {
        uploadVideo(2, next)
      },
      function (next) {
        setTimeout(next, 11000)
      },
      function (next) {
        uploadVideo(1, next)
      },
      function (next) {
        uploadVideo(2, next)
      },
      function (next) {
        setTimeout(next, 11000)
      },
      // Rerun server 4
      function (next) {
        serversUtils.runServer(4, function (server) {
          servers[3].app = server.app
          next()
        })
      },
      function (next) {
        getFriendsList(4, function (err, res) {
          if (err) throw err

          // Pod 4 didn't know pod 1 and 2 removed it
          expect(res.body.data.length).to.equal(3)
          next()
        })
      },
      // Pod 6 ask pod 1, 2 and 3
      function (next) {
        makeFriends(6, next)
      },
      function (next) {
        setTimeout(next, 11000)
      }],
      function (err) {
        if (err) throw err

        getFriendsList(6, function (err, res) {
          if (err) throw err

          // Pod 4 should not be our friend
          const result = res.body.data
          expect(result.length).to.equal(3)
          for (const pod of result) {
            expect(pod.host).not.equal(servers[3].host)
          }

          done()
        })
      }
    )
  })

  it('Should pod 1 quit friends', function (done) {
    this.timeout(25000)

    series([
      // Upload a video on server 3 for aditionnal tests
      function (next) {
        uploadVideo(3, next)
      },
      function (next) {
        setTimeout(next, 15000)
      },
      function (next) {
        quitFriends(1, next)
      },
      // Remove pod 1 from pod 2
      function (next) {
        getVideos(1, function (err, res) {
          if (err) throw err

          const videos = res.body.data
          expect(videos).to.be.an('array')
          expect(videos.length).to.equal(2)

          next()
        })
      }],
      function (err) {
        if (err) throw err

        getVideos(2, function (err, res) {
          if (err) throw err

          const videos = res.body.data
          expect(videos).to.be.an('array')
          expect(videos.length).to.equal(3)
          done()
        })
      }
    )
  })

  it('Should make friends between pod 1 and 2 and exchange their videos', function (done) {
    this.timeout(20000)
    makeFriends(1, function () {
      setTimeout(function () {
        getVideos(1, function (err, res) {
          if (err) throw err

          const videos = res.body.data
          expect(videos).to.be.an('array')
          expect(videos.length).to.equal(5)

          done()
        })
      }, 11000)
    })
  })

  after(function (done) {
    servers.forEach(function (server) {
      process.kill(-server.app.pid)
    })

    if (this.ok) {
      serversUtils.flushTests(done)
    } else {
      done()
    }
  })
})
