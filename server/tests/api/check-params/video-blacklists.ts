/* tslint:disable:no-unused-expression */

import 'mocha'

import {
  ServerInfo,
  flushTests,
  runServer,
  uploadVideo,
  getVideosList,
  createUser,
  setAccessTokensToServers,
  killallServers,
  makePostBodyRequest,
  getUserAccessToken
} from '../../utils'

describe('Test video blacklists API validators', function () {
  let server: ServerInfo
  let userAccessToken = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    const username = 'user1'
    const password = 'my super password'
    await createUser(server.url, server.accessToken, username, password)
    userAccessToken = await getUserAccessToken(server, { username, password })

    // Upload a video
    const videoAttributes = {}
    await uploadVideo(server.url, server.accessToken, videoAttributes)

    const res = await getVideosList(server.url)

    const videos = res.body.data
    server.video = videos[0]
  })

  describe('When adding a video in blacklist', function () {
    const basePath = '/api/v1/videos/'

    it('Should fail with nothing', async function () {
      const path = basePath + server.video + '/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a wrong video', async function () {
      const wrongPath = '/api/v1/videos/blabla/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: server.url, path: wrongPath, token: server.accessToken, fields })
    })

    it('Should fail with a non authenticated user', async function () {
      const fields = {}
      const path = basePath + server.video + '/blacklist'
      await makePostBodyRequest({ url: server.url, path, token: 'hello', fields, statusCodeExpected: 401 })
    })

    it('Should fail with a non admin user', async function () {
      const fields = {}
      const path = basePath + server.video + '/blacklist'
      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields, statusCodeExpected: 403 })
    })

    it('Should fail with a local video', async function () {
      const fields = {}
      const path = basePath + server.video.id + '/blacklist'
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 403 })
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
