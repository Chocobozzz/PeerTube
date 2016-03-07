'use strict'

var async = require('async')
var chai = require('chai')
var expect = chai.expect

var utils = require('./utils')

describe('Test advanced friends', function () {
  var apps = []
  var urls = []

  function makeFriends (pod_number, callback) {
    return utils.makeFriends(urls[pod_number - 1], callback)
  }

  function quitFriends (pod_number, callback) {
    return utils.quitFriends(urls[pod_number - 1], callback)
  }

  function getFriendsList (pod_number, end) {
    return utils.getFriendsList(urls[pod_number - 1], end)
  }

  function uploadVideo (pod_number, callback) {
    var name = 'my super video'
    var description = 'my super description'
    var fixture = 'video_short.webm'

    return utils.uploadVideo(urls[pod_number - 1], name, description, fixture, callback)
  }

  function getVideos (pod_number, callback) {
    return utils.getVideosList(urls[pod_number - 1], callback)
  }

  // ---------------------------------------------------------------

  before(function (done) {
    this.timeout(30000)
    utils.flushAndRunMultipleServers(6, function (apps_run, urls_run) {
      apps = apps_run
      urls = urls_run
      done()
    })
  })

  it('Should make friends with two pod each in a different group', function (done) {
    this.timeout(20000)

    async.series([
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

          expect(res.body.length).to.equal(0)

          done()
        })
      }
    )
  })

  it('Should quit all friends', function (done) {
    this.timeout(10000)

    async.series([
      function (next) {
        quitFriends(1, next)
      },
      function (next) {
        quitFriends(2, next)
      }],
      function (err) {
        if (err) throw err

        async.each([ 1, 2, 3, 4, 5, 6 ], function (i, callback) {
          getFriendsList(i, function (err, res) {
            if (err) throw err

            expect(res.body.length).to.equal(0)

            callback()
          })
        }, done)
      }
    )
  })

  it('Should make friends with the pods 1, 2, 3', function (done) {
    this.timeout(150000)

    async.series([
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
      // Kill pod 4
      function (next) {
        apps[3].kill()
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
        setTimeout(next, 20000)
      },
      // Rerun server 4
      function (next) {
        utils.runServer(4, function (app, url) {
          apps[3] = app
          next()
        })
      },
      function (next) {
        getFriendsList(4, function (err, res) {
          if (err) throw err

          // Pod 4 didn't know pod 1 and 2 removed it
          expect(res.body.length).to.equal(3)

          next()
        })
      },
      // Pod 6 ask pod 1, 2 and 3
      function (next) {
        makeFriends(6, next)
      }],
      function (err) {
        if (err) throw err

        getFriendsList(6, function (err, res) {
          if (err) throw err

          // Pod 4 should not be our friend
          var result = res.body
          expect(result.length).to.equal(3)
          for (var pod of result) {
            expect(pod.url).not.equal(urls[3])
          }

          done()
        })
      }
    )
  })

  it('Should pod 1 quit friends', function (done) {
    this.timeout(25000)

    async.series([
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
          expect(res.body).to.be.an('array')
          expect(res.body.length).to.equal(2)

          next()
        })
      }],
      function (err) {
        if (err) throw err

        getVideos(2, function (err, res) {
          if (err) throw err
          expect(res.body).to.be.an('array')
          expect(res.body.length).to.equal(3)
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

          expect(res.body).to.be.an('array')
          expect(res.body.length).to.equal(5)

          done()
        })
      }, 5000)
    })
  })

  after(function (done) {
    apps.forEach(function (app) {
      process.kill(-app.pid)
    })

    if (this.ok) {
      utils.flushTests(done)
    } else {
      done()
    }
  })
})
