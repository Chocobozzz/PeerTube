/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import { omit } from 'lodash'
import 'mocha'
import {
  createUser,
  deleteVideoChannel,
  flushTests,
  getAccountVideoChannelsList,
  getMyUserInformation,
  getVideoChannelsList,
  immutableAssign,
  killallServers,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  userLogin
} from '../../utils'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '../../utils/requests/check-api-params'
import { User } from '../../../../shared/models/users'

const expect = chai.expect

describe('Test video channels API validator', function () {
  const videoChannelPath = '/api/v1/video-channels'
  let server: ServerInfo
  let accessTokenUser: string
  let videoChannelUUID: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    const user = {
      username: 'fake',
      password: 'fake_password'
    }

    {
      await createUser(server.url, server.accessToken, user.username, user.password)
      accessTokenUser = await userLogin(server, user)
    }

    {
      const res = await getMyUserInformation(server.url, server.accessToken)
      const user: User = res.body
      videoChannelUUID = user.videoChannels[0].uuid
    }
  })

  describe('When listing a video channels', function () {
    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, videoChannelPath, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, videoChannelPath, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, videoChannelPath, server.accessToken)
    })
  })

  describe('When listing account video channels', function () {
    it('Should fail with a unknown account', async function () {
      await getAccountVideoChannelsList(server.url, 'unknown', 404)
    })
  })

  describe('When adding a video channel', function () {
    const baseCorrectParams = {
      displayName: 'hello',
      description: 'super description',
      support: 'super support text'
    }

    it('Should fail with a non authenticated user', async function () {
      await makePostBodyRequest({
        url: server.url,
        path: videoChannelPath,
        token: 'none',
        fields: baseCorrectParams,
        statusCodeExpected: 401
      })
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should fail without a name', async function () {
      const fields = omit(baseCorrectParams, 'displayName')
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should fail with a long name', async function () {
      const fields = immutableAssign(baseCorrectParams, { displayName: 'super'.repeat(25) })
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = immutableAssign(baseCorrectParams, { description: 'super'.repeat(150) })
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should fail with a long support text', async function () {
      const fields = immutableAssign(baseCorrectParams, { support: 'super'.repeat(150) })
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePostBodyRequest({
        url: server.url,
        path: videoChannelPath,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: 200
      })
    })
  })

  describe('When updating a video channel', function () {
    const baseCorrectParams = {
      displayName: 'hello',
      description: 'super description'
    }
    let path: string

    before(async function () {
      path = videoChannelPath + '/' + videoChannelUUID
    })

    it('Should fail with a non authenticated user', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        token: 'hi',
        fields: baseCorrectParams,
        statusCodeExpected: 401
      })
    })

    it('Should fail with another authenticated user', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        token: accessTokenUser,
        fields: baseCorrectParams,
        statusCodeExpected: 403
      })
    })

    it('Should fail with a long name', async function () {
      const fields = immutableAssign(baseCorrectParams, { displayName: 'super'.repeat(25) })
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = immutableAssign(baseCorrectParams, { description: 'super'.repeat(150) })
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long support text', async function () {
      const fields = immutableAssign(baseCorrectParams, { support: 'super'.repeat(150) })
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: 204
      })
    })
  })

  describe('When getting a video channel', function () {
    it('Should return the list of the video channels with nothing', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: videoChannelPath,
        statusCodeExpected: 200
      })

      expect(res.body.data).to.be.an('array')
    })

    it('Should fail without a correct uuid', async function () {
      await makeGetRequest({
        url: server.url,
        path: videoChannelPath + '/coucou',
        statusCodeExpected: 400
      })
    })

    it('Should return 404 with an incorrect video channel', async function () {
      await makeGetRequest({
        url: server.url,
        path: videoChannelPath + '/4da6fde3-88f7-4d16-b119-108df5630b06',
        statusCodeExpected: 404
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path: videoChannelPath + '/' + videoChannelUUID,
        statusCodeExpected: 200
      })
    })
  })

  describe('When deleting a video channel', function () {
    it('Should fail with a non authenticated user', async function () {
      await deleteVideoChannel(server.url, 'coucou', videoChannelUUID, 401)
    })

    it('Should fail with another authenticated user', async function () {
      await deleteVideoChannel(server.url, accessTokenUser, videoChannelUUID, 403)
    })

    it('Should fail with an unknown video channel id', async function () {
      await deleteVideoChannel(server.url, server.accessToken,454554, 404)
    })

    it('Should succeed with the correct parameters', async function () {
      await deleteVideoChannel(server.url, server.accessToken, videoChannelUUID)
    })

    it('Should fail to delete the last user video channel', async function () {
      const res = await getVideoChannelsList(server.url, 0, 1)
      const lastVideoChannelUUID = res.body.data[0].uuid

      await deleteVideoChannel(server.url, server.accessToken, lastVideoChannelUUID, 409)
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
