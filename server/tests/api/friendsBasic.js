'use strict'

const async = require('async')
const chai = require('chai')
const expect = chai.expect
const request = require('supertest')

const utils = require('./utils')

describe('Test basic friends', function () {
  let servers = []

  function testMadeFriends (servers, server_to_test, callback) {
    const friends = []
    for (let i = 0; i < servers.length; i++) {
      if (servers[i].url === server_to_test.url) continue
      friends.push(servers[i].url)
    }

    utils.getFriendsList(server_to_test.url, function (err, res) {
      if (err) throw err

      const result = res.body
      const result_urls = [ result[0].url, result[1].url ]
      expect(result).to.be.an('array')
      expect(result.length).to.equal(2)
      expect(result_urls[0]).to.not.equal(result_urls[1])

      const error_string = 'Friends url do not correspond for ' + server_to_test.url
      expect(friends).to.contain(result_urls[0], error_string)
      expect(friends).to.contain(result_urls[1], error_string)
      callback()
    })
  }

  // ---------------------------------------------------------------

  before(function (done) {
    this.timeout(20000)
    utils.flushAndRunMultipleServers(3, function (servers_run, urls_run) {
      servers = servers_run
      done()
    })
  })

  it('Should not have friends', function (done) {
    async.each(servers, function (server, callback) {
      utils.getFriendsList(server.url, function (err, res) {
        if (err) throw err

        const result = res.body
        expect(result).to.be.an('array')
        expect(result.length).to.equal(0)
        callback()
      })
    }, done)
  })

  it('Should make friends', function (done) {
    this.timeout(10000)

    const path = '/api/v1/pods/makefriends'

    async.series([
      // The second pod make friend with the third
      function (next) {
        request(servers[1].url)
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
        utils.getFriendsList(servers[1].url, function (err, res) {
          if (err) throw err

          const result = res.body
          expect(result).to.be.an('array')
          expect(result.length).to.equal(1)
          expect(result[0].url).to.be.equal(servers[2].url)

          next()
        })
      },
      // Same here, the third pod should have the second pod as a friend
      function (next) {
        utils.getFriendsList(servers[2].url, function (err, res) {
          if (err) throw err

          const result = res.body
          expect(result).to.be.an('array')
          expect(result.length).to.equal(1)
          expect(result[0].url).to.be.equal(servers[1].url)

          next()
        })
      },
      // Finally the first pod make friend with the second pod
      function (next) {
        request(servers[0].url)
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
      async.each(servers, function (server, callback) {
        testMadeFriends(servers, server, callback)
      }, done)
    })
  })

  it('Should not be allowed to make friend again', function (done) {
    utils.makeFriends(servers[1].url, 409, done)
  })

  it('Should quit friends of pod 2', function (done) {
    async.series([
      // Pod 1 quit friends
      function (next) {
        utils.quitFriends(servers[1].url, next)
      },
      // Pod 1 should not have friends anymore
      function (next) {
        utils.getFriendsList(servers[1].url, function (err, res) {
          if (err) throw err

          const result = res.body
          expect(result).to.be.an('array')
          expect(result.length).to.equal(0)

          next()
        })
      },
      // Other pods shouldn't have pod 1 too
      function (next) {
        async.each([ servers[0].url, servers[2].url ], function (url, callback) {
          utils.getFriendsList(url, function (err, res) {
            if (err) throw err

            const result = res.body
            expect(result).to.be.an('array')
            expect(result.length).to.equal(1)
            expect(result[0].url).not.to.be.equal(servers[1].url)
            callback()
          })
        }, next)
      }
    ], done)
  })

  it('Should allow pod 2 to make friend again', function (done) {
    utils.makeFriends(servers[1].url, function () {
      async.each(servers, function (server, callback) {
        testMadeFriends(servers, server, callback)
      }, done)
    })
  })

  after(function (done) {
    servers.forEach(function (server) {
      process.kill(-server.app.pid)
    })

    if (this.ok) {
      utils.flushTests(done)
    } else {
      done()
    }
  })
})
