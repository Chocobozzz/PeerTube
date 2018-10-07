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
  makeUploadRequest,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  userLogin
} from '../../utils'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '../../utils/requests/check-api-params'
import { User } from '../../../../shared/models/users'
import { join } from 'path'

const expect = chai.expect

describe('Test video channels API validator', function () {
  const videoChannelPath = '/api/v1/video-channels'
  let server: ServerInfo
  let accessTokenUser: string

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
      name: 'super_channel',
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
      const fields = omit(baseCorrectParams, 'name')
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should fail with a bad name', async function () {
      const fields = immutableAssign(baseCorrectParams, { name: 'super name' })
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

    it('Should fail when adding a channel with the same username', async function () {
      await makePostBodyRequest({
        url: server.url,
        path: videoChannelPath,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: 409
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
      path = videoChannelPath + '/super_channel'
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

  describe('When updating video channel avatar', function () {
    let path: string

    before(async function () {
      path = videoChannelPath + '/super_channel'
    })

    it('Should fail with an incorrect input file', async function () {
      const fields = {}
      const attaches = {
        'avatarfile': join(__dirname, '..', '..', 'fixtures', 'video_short.mp4')
      }
      await makeUploadRequest({ url: server.url, path: path + '/avatar/pick', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a big file', async function () {
      const fields = {}
      const attaches = {
        'avatarfile': join(__dirname, '..', '..', 'fixtures', 'avatar-big.png')
      }
      await makeUploadRequest({ url: server.url, path: path + '/avatar/pick', token: server.accessToken, fields, attaches })
    })

    it('Should fail with an unauthenticated user', async function () {
      const fields = {}
      const attaches = {
        'avatarfile': join(__dirname, '..', '..', 'fixtures', 'avatar.png')
      }
      await makeUploadRequest({
        url: server.url,
        path: path + '/avatar/pick',
        fields,
        attaches,
        statusCodeExpected: 401
      })
    })

    it('Should succeed with the correct params', async function () {
      const fields = {}
      const attaches = {
        'avatarfile': join(__dirname, '..', '..', 'fixtures', 'avatar.png')
      }
      await makeUploadRequest({
        url: server.url,
        path: path + '/avatar/pick',
        token: server.accessToken,
        fields,
        attaches,
        statusCodeExpected: 200
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

    it('Should return 404 with an incorrect video channel', async function () {
      await makeGetRequest({
        url: server.url,
        path: videoChannelPath + '/super_channel2',
        statusCodeExpected: 404
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path: videoChannelPath + '/super_channel',
        statusCodeExpected: 200
      })
    })
  })

  describe('When deleting a video channel', function () {
    it('Should fail with a non authenticated user', async function () {
      await deleteVideoChannel(server.url, 'coucou', 'super_channel', 401)
    })

    it('Should fail with another authenticated user', async function () {
      await deleteVideoChannel(server.url, accessTokenUser, 'super_channel', 403)
    })

    it('Should fail with an unknown video channel id', async function () {
      await deleteVideoChannel(server.url, server.accessToken,'super_channel2', 404)
    })

    it('Should succeed with the correct parameters', async function () {
      await deleteVideoChannel(server.url, server.accessToken, 'super_channel')
    })

    it('Should fail to delete the last user video channel', async function () {
      await deleteVideoChannel(server.url, server.accessToken, 'root_channel', 409)
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
