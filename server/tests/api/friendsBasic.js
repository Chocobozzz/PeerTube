'use strict'

const async = require('async')
const chai = require('chai')
const expect = chai.expect

const utils = require('./utils')

describe('Test basic friends', function () {
  let servers = []

  function makeFriends (podNumber, callback) {
    const server = servers[podNumber - 1]
    return utils.makeFriends(server.url, server.accessToken, callback)
  }

  function testMadeFriends (servers, serverToTest, callback) {
    const friends = []
    for (let i = 0; i < servers.length; i++) {
      if (servers[i].url === serverToTest.url) continue
      friends.push(servers[i].url)
    }

    utils.getFriendsList(serverToTest.url, function (err, res) {
      if (err) throw err

      const result = res.body
      expect(result).to.be.an('array')
      expect(result.length).to.equal(2)

      const resultUrls = [ result[0].url, result[1].url ]
      expect(resultUrls[0]).to.not.equal(resultUrls[1])

      const errorString = 'Friends url do not correspond for ' + serverToTest.url
      expect(friends).to.contain(resultUrls[0], errorString)
      expect(friends).to.contain(resultUrls[1], errorString)
      callback()
    })
  }

  // ---------------------------------------------------------------

  before(function (done) {
    this.timeout(20000)
    utils.flushAndRunMultipleServers(3, function (serversRun, urlsRun) {
      servers = serversRun

      async.each(servers, function (server, callbackEach) {
        utils.loginAndGetAccessToken(server, function (err, accessToken) {
          if (err) return callbackEach(err)

          server.accessToken = accessToken
          callbackEach()
        })
      }, done)
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

    async.series([
      // The second pod make friend with the third
      function (next) {
        makeFriends(2, next)
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
        makeFriends(1, next)
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
    const server = servers[1]
    utils.makeFriends(server.url, server.accessToken, 409, done)
  })

  it('Should quit friends of pod 2', function (done) {
    async.series([
      // Pod 1 quit friends
      function (next) {
        const server = servers[1]
        utils.quitFriends(server.url, server.accessToken, next)
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
    const server = servers[1]
    utils.makeFriends(server.url, server.accessToken, function () {
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
