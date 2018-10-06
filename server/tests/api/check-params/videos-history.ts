/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  flushTests,
  killallServers,
  makePostBodyRequest,
  makePutBodyRequest,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../../utils'

const expect = chai.expect

describe('Test videos history API validator', function () {
  let path: string
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    const res = await uploadVideo(server.url, server.accessToken, {})
    const videoUUID = res.body.video.uuid

    path = '/api/v1/videos/' + videoUUID + '/watching'
  })

  describe('When notifying a user is watching a video', function () {

    it('Should fail with an unauthenticated user', async function () {
      const fields = { currentTime: 5 }
      await makePutBodyRequest({ url: server.url, path, fields, statusCodeExpected: 401 })
    })

    it('Should fail with an incorrect video id', async function () {
      const fields = { currentTime: 5 }
      const path = '/api/v1/videos/blabla/watching'
      await makePutBodyRequest({ url: server.url, path, fields, token: server.accessToken, statusCodeExpected: 400 })
    })

    it('Should fail with an unknown video', async function () {
      const fields = { currentTime: 5 }
      const path = '/api/v1/videos/d91fff41-c24d-4508-8e13-3bd5902c3b02/watching'

      await makePutBodyRequest({ url: server.url, path, fields, token: server.accessToken, statusCodeExpected: 404 })
    })

    it('Should fail with a bad current time', async function () {
      const fields = { currentTime: 'hello' }
      await makePutBodyRequest({ url: server.url, path, fields, token: server.accessToken, statusCodeExpected: 400 })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = { currentTime: 5 }

      await makePutBodyRequest({ url: server.url, path, fields, token: server.accessToken, statusCodeExpected: 204 })
    })
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
