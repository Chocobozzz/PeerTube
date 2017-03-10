/* eslint-disable no-unused-expressions */

'use strict'

const chai = require('chai')
const expect = chai.expect
const series = require('async/series')

const serversUtils = require('../utils/servers')
const configUtils = require('../utils/config')

describe('Test config', function () {
  let server = null

  before(function (done) {
    this.timeout(20000)

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

  it('Should have a correct config', function (done) {
    configUtils.getConfig(server.url, function (err, res) {
      if (err) throw err

      const data = res.body

      expect(data.signup.enabled).to.be.truthy

      done()
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
