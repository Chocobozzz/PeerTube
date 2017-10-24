/* tslint:disable:no-unused-expression */

import 'mocha'

import {
  ServerInfo,
  flushTests,
  runServer,
  setAccessTokensToServers,
  killallServers
} from '../../utils'

describe('Test remote videos API validators', function () {
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])
  })

  describe('When making a secure request', async function () {
    it('Should check a secure request')
  })

  describe('When adding a video', async function () {
    it('Should check when adding a video')

    it('Should not add an existing uuid')
  })

  describe('When removing a video', async function () {
    it('Should check when removing a video')
  })

  describe('When reporting abuse on a video', async function () {
    it('Should check when reporting a video abuse')
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
