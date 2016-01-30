;(function () {
  'use strict'

  var async = require('async')
  var chai = require('chai')
  var expect = chai.expect
  var request = require('supertest')

  var utils = require('./utils')

  describe('Test basic friends', function () {
    var apps = []
    var urls = []

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

    // ---------------------------------------------------------------

    before(function (done) {
      this.timeout(20000)
      utils.flushAndRunMultipleServers(3, function (apps_run, urls_run) {
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
      }, done)
    })

    it('Should make friends', function (done) {
      this.timeout(10000)

      var path = '/api/v1/pods/makefriends'

      async.series([
        // The second pod make friend with the third
        function (next) {
          request(urls[1])
            .get(path)
            .set('Accept', 'application/json')
            .expect(204)
            .end(next)
        },
        // Wait for the request between pods
        function (next) {
          setTimeout(next, 1000)
        },
        // The second pod should have the third as a friend
        function (next) {
          utils.getFriendsList(urls[1], function (err, res) {
            if (err) throw err

            var result = res.body
            expect(result).to.be.an('array')
            expect(result.length).to.equal(1)
            expect(result[0].url).to.be.equal(urls[2])

            next()
          })
        },
        // Same here, the third pod should have the second pod as a friend
        function (next) {
          utils.getFriendsList(urls[2], function (err, res) {
            if (err) throw err

            var result = res.body
            expect(result).to.be.an('array')
            expect(result.length).to.equal(1)
            expect(result[0].url).to.be.equal(urls[1])

            next()
          })
        },
        // Finally the first pod make friend with the second pod
        function (next) {
          request(urls[0])
            .get(path)
            .set('Accept', 'application/json')
            .expect(204)
            .end(next)
        },
        // Wait for the request between pods
        function (next) {
          setTimeout(next, 1000)
        }
      ],
      // Now each pod should be friend with the other ones
      function (err) {
        if (err) throw err
        async.each(urls, function (url, callback) {
          testMadeFriends(urls, url, callback)
        }, done)
      })
    })

    it('Should not be allowed to make friend again', function (done) {
      utils.makeFriends(urls[1], 409, done)
    })

    it('Should quit friends of pod 2', function (done) {
      async.series([
        // Pod 1 quit friends
        function (next) {
          utils.quitFriends(urls[1], next)
        },
        // Pod 1 should not have friends anymore
        function (next) {
          utils.getFriendsList(urls[1], function (err, res) {
            if (err) throw err

            var result = res.body
            expect(result).to.be.an('array')
            expect(result.length).to.equal(0)

            next()
          })
        },
        // Other pods shouldn't have pod 1 too
        function (next) {
          async.each([ urls[0], urls[2] ], function (url, callback) {
            utils.getFriendsList(url, function (err, res) {
              if (err) throw err

              var result = res.body
              expect(result).to.be.an('array')
              expect(result.length).to.equal(1)
              expect(result[0].url).not.to.be.equal(urls[1])
              callback()
            })
          }, next)
        }
      ], done)
    })

    it('Should allow pod 2 to make friend again', function (done) {
      utils.makeFriends(urls[1], function () {
        async.each(urls, function (url, callback) {
          testMadeFriends(urls, url, callback)
        }, done)
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
})()
