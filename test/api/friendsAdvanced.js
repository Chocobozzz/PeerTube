;(function () {
  'use strict'

  var chai = require('chai')
  var expect = chai.expect

  var utils = require('./utils')

  describe('Test advanced friends', function () {
    var apps = []
    var urls = []

    function makeFriend (pod_number, callback) {
      return utils.makeFriend(urls[pod_number - 1], callback)
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

    beforeEach(function (done) {
      this.timeout(30000)
      utils.runMultipleServers(6, function (apps_run, urls_run) {
        apps = apps_run
        urls = urls_run
        done()
      })
    })

    afterEach(function (done) {
      apps.forEach(function (app) {
        process.kill(-app.pid)
      })

      if (this.ok) {
        utils.flushTests(function () {
          done()
        })
      } else {
        done()
      }
    })

    it('Should make friends with two pod each in a different group', function (done) {
      this.timeout(10000)

      // Pod 3 makes friend with the first one
      makeFriend(3, function () {
        // Pod 4 makes friend with the second one
        makeFriend(4, function () {
          // Now if the fifth wants to make friends with the third et the first
          makeFriend(5, function () {
            // It should have 0 friends
            getFriendsList(5, function (err, res) {
              if (err) throw err

              expect(res.body.length).to.equal(0)

              done()
            })
          })
        })
      })
    })

    it('Should make friends with the pods 1, 2, 3', function (done) {
      this.timeout(150000)

      // Pods 1, 2, 3 and 4 become friends (yes this is beautiful)
      makeFriend(2, function () {
        makeFriend(1, function () {
          makeFriend(4, function () {
            // Kill the server 4
            apps[3].kill()

            // Expulse pod 4 from pod 1 and 2
            uploadVideo(1, function () {
              setTimeout(function () {
                uploadVideo(1, function () {
                  setTimeout(function () {
                    uploadVideo(2, function () {
                      setTimeout(function () {
                        uploadVideo(2, function () {
                          setTimeout(function () {
                            // Rerun server 4
                            utils.runServer(4, function (app, url) {
                              apps[3] = app
                              getFriendsList(4, function (err, res) {
                                if (err) throw err
                                // Pod 4 didn't know pod 1 and 2 removed it
                                expect(res.body.length).to.equal(3)

                                // Pod 6 ask pod 1, 2 and 3
                                makeFriend(6, function () {
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
                                })
                              })
                            })
                          }, 15000)
                        })
                      }, 15000)
                    })
                  }, 15000)
                })
              }, 15000)
            })
          })
        })
      })
    })
  })
})()
