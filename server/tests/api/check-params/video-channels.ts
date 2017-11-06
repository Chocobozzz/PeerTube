/* tslint:disable:no-unused-expression */

import * as request from 'supertest'
import 'mocha'
import * as chai from 'chai'
const expect = chai.expect

import {
  ServerInfo,
  flushTests,
  runServer,
  makePutBodyRequest,
  setAccessTokensToServers,
  killallServers,
  makePostBodyRequest,
  getVideoChannelsList,
  createUser,
  getUserAccessToken
} from '../../utils'

describe('Test videos API validator', function () {
  const path = '/api/v1/videos/channels'
  let server: ServerInfo
  let accessTokenUser: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(20000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    const user = {
      username: 'fake',
      password: 'fake_password'
    }
    await createUser(server.url, server.accessToken, user.username, user.password)

    accessTokenUser = await getUserAccessToken(server, user)
  })

  describe('When listing a video channels', function () {
    it('Should fail with a bad start pagination', async function () {
      await request(server.url)
              .get(path)
              .query({ start: 'hello' })
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should fail with a bad count pagination', async function () {
      await request(server.url)
              .get(path)
              .query({ count: 'hello' })
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should fail with an incorrect sort', async function () {
      await request(server.url)
              .get(path)
              .query({ sort: 'hello' })
              .set('Accept', 'application/json')
              .expect(400)
    })
  })

  describe('When listing author video channels', function () {
    it('Should fail with bad author', async function () {
      const path = '/api/v1/videos/authors/hello/channels'

      await request(server.url)
        .get(path)
        .set('Accept', 'application/json')
        .expect(400)
    })

    it('Should fail with a unknown author', async function () {
      const path = '/api/v1/videos/authors/156/channels'

      await request(server.url)
        .get(path)
        .set('Accept', 'application/json')
        .expect(404)
    })
  })

  describe('When adding a video channel', function () {

    it('Should fail with a non authenticated user', async function () {
      const fields = {
        name: 'hello',
        description: 'super description'
      }
      await makePostBodyRequest({ url: server.url, path, token: 'none', fields, statusCodeExpected: 401 })
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail without name', async function () {
      const fields = {
        description: 'super description'
      }
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long name', async function () {
      const fields = {
        name: 'hello tooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo' +
              'oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo' +
              'oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo' +
              'oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo' +
              'oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo long',
        description: 'super description'
      }
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = {
        name: 'hello',
        description: 'super toooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo' +
                     'oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo0' +
                     'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo' +
                     'oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo long description'
      }
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = {
        name: 'hello',
        description: 'super description'
      }
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 204 })
    })
  })

  describe('When updating a video channel', function () {
    let videoChannelId

    before(async function () {
      const res = await getVideoChannelsList(server.url, 0, 1)
      videoChannelId = res.body.data[0].id
    })

    it('Should fail with a non authenticated user', async function () {
      const fields = {
        name: 'hello',
        description: 'super description'
      }
      await makePutBodyRequest({ url: server.url, path: path + '/' + videoChannelId, token: 'hi', fields, statusCodeExpected: 401 })
    })

    it('Should fail with another authenticated user', async function () {
      const fields = {
        name: 'hello',
        description: 'super description'
      }
      await makePutBodyRequest({
        url: server.url,
        path: path + '/' + videoChannelId,
        token: accessTokenUser,
        fields,
        statusCodeExpected: 403
      })
    })

    it('Should fail with a long name', async function () {
      const fields = {
        name: 'hello tooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo' +
        'oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo' +
        'oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo' +
        'oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo' +
        'oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo long',
        description: 'super description'
      }
      await makePutBodyRequest({ url: server.url, path: path + '/' + videoChannelId, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = {
        name: 'hello',
        description: 'super toooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo' +
        'oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo0' +
        'ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo' +
        'oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo long description'
      }
      await makePutBodyRequest({ url: server.url, path: path + '/' + videoChannelId, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = {
        name: 'hello 2',
        description: 'super description 2'
      }
      await makePutBodyRequest({
        url: server.url,
        path: path + '/' + videoChannelId,
        token: server.accessToken,
        fields,
        statusCodeExpected: 204
      })
    })
  })

  describe('When getting a video channel', function () {
    let videoChannelId: number

    before(async function () {
      const res = await getVideoChannelsList(server.url, 0, 1)
      videoChannelId = res.body.data[0].id
    })

    it('Should return the list of the video channels with nothing', async function () {
      const res = await request(server.url)
                          .get(path)
                          .set('Accept', 'application/json')
                          .expect(200)
                          .expect('Content-Type', /json/)

      expect(res.body.data).to.be.an('array')
    })

    it('Should fail without a correct uuid', async function () {
      await request(server.url)
              .get(path + '/coucou')
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should return 404 with an incorrect video channel', async function () {
      await request(server.url)
              .get(path + '/4da6fde3-88f7-4d16-b119-108df5630b06')
              .set('Accept', 'application/json')
              .expect(404)
    })

    it('Should succeed with the correct parameters', async function () {
      await request(server.url)
        .get(path + '/' + videoChannelId)
        .set('Accept', 'application/json')
        .expect(200)
    })
  })

  describe('When deleting a video channel', function () {
    let videoChannelId: number

    before(async function () {
      const res = await getVideoChannelsList(server.url, 0, 1)
      videoChannelId = res.body.data[0].id
    })

    it('Should fail with a non authenticated user', async function () {
      await request(server.url)
        .delete(path + '/' + videoChannelId)
        .set('Authorization', 'Bearer coucou')
        .expect(401)
    })

    it('Should fail with another authenticated user', async function () {
      await request(server.url)
        .delete(path + '/' + videoChannelId)
        .set('Authorization', 'Bearer ' + accessTokenUser)
        .expect(403)
    })

    it('Should fail with an unknown id', async function () {
      await request(server.url)
        .delete(path + '/454554')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(404)
    })

    it('Should succeed with the correct parameters', async function () {
      await request(server.url)
        .delete(path + '/' + videoChannelId)
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(204)
    })

    it('Should fail to delete the last user video channel', async function () {
      const res = await getVideoChannelsList(server.url, 0, 1)
      videoChannelId = res.body.data[0].id

      await request(server.url)
        .delete(path + '/' + videoChannelId)
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(409
        )
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
