;(function () {
  'use strict'

  var async = require('async')
  var chai = require('chai')
  var expect = chai.expect
  var request = require('supertest')

  var utils = require('./utils')

  describe('Test basic friends', function () {
    function testMadeFriends (urls, url_to_test, callback) {
      var friends = []
      for (var i = 0; i < urls.length; i++) {
        if (urls[i] === url_to_test) continue
        friends.push(urls[i])
      }

      utils.getFriendsList(url_to_test, function (err, res) {
        if (err) throw err

        var result = res.body
        var result_urls = [ result[0].url, result[1].url ]
        expect(result).to.be.an('array')
        expect(result.length).to.equal(2)
        expect(result_urls[0]).to.not.equal(result_urls[1])

        var error_string = 'Friends url do not correspond for ' + url_to_test
        expect(friends).to.contain(result_urls[0], error_string)
        expect(friends).to.contain(result_urls[1], error_string)
        callback()
      })
    }

    var apps = []
    var urls = []

    before(function (done) {
      this.timeout(20000)
      utils.runMultipleServers(3, function (apps_run, urls_run) {
        apps = apps_run
        urls = urls_run
        done()
      })
    })

    it('Should not have friends', function (done) {
      async.each(urls, function (url, callback) {
        utils.getFriendsList(url, function (err, res) {
          if (err) throw err

          var result = res.body
          expect(result).to.be.an('array')
          expect(result.length).to.equal(0)
          callback()
        })
      }, function (err) {
        if (err) throw err

        done()
      })
    })

    it('Should make friends', function (done) {
      this.timeout(10000)

      var path = '/api/v1/pods/makefriends'

      // The second pod make friend with the third
      request(urls[1])
        .get(path)
        .set('Accept', 'application/json')
        .expect(204)
        .end(function (err, res) {
          if (err) throw err

          // Wait for the request between pods
          setTimeout(function () {
            // The second pod should have the third as a friend
            utils.getFriendsList(urls[1], function (err, res) {
              if (err) throw err

              var result = res.body
              expect(result).to.be.an('array')
              expect(result.length).to.equal(1)
              expect(result[0].url).to.be.equal(urls[2])

              // Same here, the third pod should have the second pod as a friend
              utils.getFriendsList(urls[2], function (err, res) {
                if (err) throw err

                var result = res.body
                expect(result).to.be.an('array')
                expect(result.length).to.equal(1)
                expect(result[0].url).to.be.equal(urls[1])

                // Finally the first pod make friend with the second pod
                request(urls[0])
                  .get(path)
                  .set('Accept', 'application/json')
                  .expect(204)
                  .end(function (err, res) {
                    if (err) throw err

                    setTimeout(function () {
                      // Now each pod should be friend with the other ones
                      async.each(urls, function (url, callback) {
                        testMadeFriends(urls, url, callback)
                      }, function (err) {
                        if (err) throw err
                        done()
                      })
                    }, 1000)
                  })
              })
            })
          }, 1000)
        })
    })

    it('Should not be allowed to make friend again', function (done) {
      utils.makeFriends(urls[1], 409, done)
    })

    it('Should quit friends of pod 2', function (done) {
      utils.quitFriends(urls[1], function () {
        utils.getFriendsList(urls[1], function (err, res) {
          if (err) throw err

          var result = res.body
          expect(result).to.be.an('array')
          expect(result.length).to.equal(0)

          // Other pods shouldn't have pod 2 too
          async.each([ urls[0], urls[2] ], function (url, callback) {
            utils.getFriendsList(url, function (err, res) {
              if (err) throw err

              var result = res.body
              expect(result).to.be.an('array')
              expect(result.length).to.equal(1)
              expect(result[0].url).not.to.be.equal(urls[1])
              callback()
            })
          }, function (err) {
            if (err) throw err
            done()
          })
        })
      })
    })

    it('Should allow pod 2 to make friend again', function (done) {
      utils.makeFriends(urls[1], function () {
        async.each(urls, function (url, callback) {
          testMadeFriends(urls, url, callback)
        }, function (err) {
          if (err) throw err
          done()
        })
      })
    })

    after(function (done) {
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
  })
})()
