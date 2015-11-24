;(function () {
  'use strict'

  var request = require('supertest')
  var chai = require('chai')
  var expect = chai.expect
  var async = require('async')

  var utils = require('../utils')

  function getFriendsList (url, end) {
    var path = '/api/v1/pods/'

    request(url)
      .get(path)
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /json/)
      .end(end)
  }

  describe('Test basic friends', function () {
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
        getFriendsList(url, function (err, res) {
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

      function testMadeFriends (urls, url_to_test, callback) {
        var friends = []
        for (var i = 0; i < urls.length; i++) {
          if (urls[i] === url_to_test) continue
          friends.push(urls[i])
        }

        getFriendsList(url_to_test, function (err, res) {
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
            getFriendsList(urls[1], function (err, res) {
              if (err) throw err

              var result = res.body
              expect(result).to.be.an('array')
              expect(result.length).to.equal(1)
              expect(result[0].url).to.be.equal(urls[2])

              // Same here, the third pod should have the second pod as a friend
              getFriendsList(urls[2], function (err, res) {
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

    // TODO
    it('Should not be able to make friends again')

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
