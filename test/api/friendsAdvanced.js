;(function () {
  'use strict'

  var request = require('supertest')
  var chai = require('chai')
  var expect = chai.expect

  var utils = require('../utils')

  describe('Test advanced friends', function () {
    var path = '/api/v1/pods/makefriends'
    var apps = []
    var urls = []

    function makeFriend (pod_number, callback) {
      // The first pod make friend with the third
      request(urls[pod_number - 1])
        .get(path)
        .set('Accept', 'application/json')
        .expect(204)
        .end(function (err, res) {
          if (err) throw err

          // Wait for the request between pods
          setTimeout(function () {
            callback()
          }, 1000)
        })
    }

    function getFriendsList (pod_number, end) {
      var path = '/api/v1/pods/'

      request(urls[pod_number - 1])
        .get(path)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(end)
    }

    function uploadVideo (pod_number, callback) {
      var path = '/api/v1/videos'

      request(urls[pod_number - 1])
        .post(path)
        .set('Accept', 'application/json')
        .field('name', 'my super video')
        .field('description', 'my super description')
        .attach('input_video', __dirname + '/../fixtures/video_short.webm')
        .expect(201)
        .end(function (err) {
          if (err) throw err

          // Wait for the retry requests
          setTimeout(callback, 10000)
        })
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
      this.timeout(100000)

      // Pods 1, 2, 3 and 4 become friends
      makeFriend(2, function () {
        makeFriend(1, function () {
          makeFriend(4, function () {
            // Kill the server 4
            apps[3].kill()

            // Expulse pod 4 from pod 1 and 2
            uploadVideo(1, function () {
              uploadVideo(1, function () {
                uploadVideo(2, function () {
                  uploadVideo(2, function () {
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
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})()
