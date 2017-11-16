/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
const expect = chai.expect

import {
  getConfig,
  flushTests,
  runServer,
  registerUser
} from '../utils'

describe('Test config', function () {
  let server = null

  before(async function () {
    this.timeout(10000)

    await flushTests()
    server = await runServer(1)
  })

  it('Should have a correct config on a server with registration enabled', async function () {
    const res = await getConfig(server.url)
    const data = res.body

    expect(data.signup.allowed).to.be.true
  })

  it('Should have a correct config on a server with registration enabled and a users limit', async function () {
    await Promise.all([
      registerUser(server.url, 'user1', 'super password'),
      registerUser(server.url, 'user2', 'super password'),
      registerUser(server.url, 'user3', 'super password')
    ])

    const res = await getConfig(server.url)
    const data = res.body

    expect(data.signup.allowed).to.be.false
  })

  after(async function () {
    process.kill(-server.app.pid)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
