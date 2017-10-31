/* tslint:disable:no-unused-expression */

import * as request from 'supertest'
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

describe('Test video abuses API validators', function () {
  let server: ServerInfo
  let userAccessToken = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(20000)

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

  describe('When listing video abuses', function () {
    const path = '/api/v1/videos/abuse'

    it('Should fail with a bad start pagination', async function () {
      await request(server.url)
              .get(path)
              .query({ start: 'hello' })
              .set('Authorization', 'Bearer ' + server.accessToken)
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should fail with a bad count pagination', async function () {
      await request(server.url)
              .get(path)
              .query({ count: 'hello' })
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(400)
    })

    it('Should fail with an incorrect sort', async function () {
      await request(server.url)
              .get(path)
              .query({ sort: 'hello' })
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(400)
    })

    it('Should fail with a non authenticated user', async function () {
      await request(server.url)
              .get(path)
              .query({ sort: 'hello' })
              .set('Accept', 'application/json')
              .expect(401)
    })

    it('Should fail with a non admin user', async function () {
      await request(server.url)
              .get(path)
              .query({ sort: 'hello' })
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + userAccessToken)
              .expect(403)
    })
  })

  describe('When reporting a video abuse', function () {
    const basePath = '/api/v1/videos/'

    it('Should fail with nothing', async function () {
      const path = basePath + server.video.id + '/abuse'
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a wrong video', async function () {
      const wrongPath = '/api/v1/videos/blabla/abuse'
      const fields = {}
      await makePostBodyRequest({ url: server.url, path: wrongPath, token: server.accessToken, fields })
    })

    it('Should fail with a non authenticated user', async function () {
      const fields = {}
      const path = basePath + server.video.id + '/abuse'
      await makePostBodyRequest({ url: server.url, path, token: 'hello', fields, statusCodeExpected: 401 })
    })

    it('Should fail with a reason too short', async function () {
      const fields = {
        reason: 'h'
      }
      const path = basePath + server.video.id + '/abuse'
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a reason too big', async function () {
      const fields = {
        reason: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' +
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' +
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' +
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      }
      const path = basePath + server.video.id + '/abuse'
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
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
