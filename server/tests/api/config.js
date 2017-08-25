/* eslint-disable no-unused-expressions */

'use strict'

const chai = require('chai')
const expect = chai.expect
const series = require('async/series')

const serversUtils = require('../utils/servers')
const configUtils = require('../utils/config')
const usersUtils = require('../utils/users')

describe('Test config', function () {
  let server = null

  before(function (done) {
    this.timeout(120000)

    series([
      function (next) {
        serversUtils.flushTests(next)
      },
      function (next) {
        serversUtils.runServer(1, function (server1) {
          server = server1
          next()
        })
      }
    ], done)
  })

  it('Should have a correct config on a server with registration enabled', function (done) {
    configUtils.getConfig(server.url, function (err, res) {
      if (err) throw err

      const data = res.body

      expect(data.signup.allowed).to.be.true

      done()
    })
  })

  it('Should have a correct config on a server with registration enabled and a users limit', function (done) {
    series([
      function (next) {
        usersUtils.registerUser(server.url, 'user1', 'super password', next)
      },

      function (next) {
        usersUtils.registerUser(server.url, 'user2', 'super password', next)
      },

      function (next) {
        usersUtils.registerUser(server.url, 'user3', 'super password', next)
      }

    ], function (err) {
      if (err) throw err

      configUtils.getConfig(server.url, function (err, res) {
        if (err) throw err

        const data = res.body

        expect(data.signup.allowed).to.be.false

        done()
      })
    })
  })

  after(function (done) {
    process.kill(-server.app.pid)

    // Keep the logs if the test failed
    if (this.ok) {
      serversUtils.flushTests(done)
    } else {
      done()
    }
  })
})
