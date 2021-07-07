/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { omit } from 'lodash'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import {
  buildAbsoluteFixturePath,
  cleanupTests,
  createUser,
  deleteVideoChannel,
  flushAndRunServer,
  getAccountVideoChannelsList,
  immutableAssign,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  makeUploadRequest,
  ServerInfo,
  setAccessTokensToServers,
  userLogin
} from '../../../../shared/extra-utils'
import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination
} from '../../../../shared/extra-utils/requests/check-api-params'
import { VideoChannelUpdate } from '../../../../shared/models/videos'

const expect = chai.expect

describe('Test video channels API validator', function () {
  const videoChannelPath = '/api/v1/video-channels'
  let server: ServerInfo
  let accessTokenUser: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    const user = {
      username: 'fake',
      password: 'fake_password'
    }

    {
      await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })
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
    const accountChannelPath = '/api/v1/accounts/fake/video-channels'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, accountChannelPath, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, accountChannelPath, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, accountChannelPath, server.accessToken)
    })

    it('Should fail with a unknown account', async function () {
      await getAccountVideoChannelsList({ url: server.url, accountName: 'unknown', specialStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path: accountChannelPath,
        statusCodeExpected: HttpStatusCode.OK_200
      })
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
        statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401
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
      const fields = immutableAssign(baseCorrectParams, { description: 'super'.repeat(201) })
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should fail with a long support text', async function () {
      const fields = immutableAssign(baseCorrectParams, { support: 'super'.repeat(201) })
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePostBodyRequest({
        url: server.url,
        path: videoChannelPath,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: HttpStatusCode.OK_200
      })
    })

    it('Should fail when adding a channel with the same username', async function () {
      await makePostBodyRequest({
        url: server.url,
        path: videoChannelPath,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: HttpStatusCode.CONFLICT_409
      })
    })
  })

  describe('When updating a video channel', function () {
    const baseCorrectParams: VideoChannelUpdate = {
      displayName: 'hello',
      description: 'super description',
      support: 'toto',
      bulkVideosSupportUpdate: false
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
        statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with another authenticated user', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        token: accessTokenUser,
        fields: baseCorrectParams,
        statusCodeExpected: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with a long name', async function () {
      const fields = immutableAssign(baseCorrectParams, { displayName: 'super'.repeat(25) })
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = immutableAssign(baseCorrectParams, { description: 'super'.repeat(201) })
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long support text', async function () {
      const fields = immutableAssign(baseCorrectParams, { support: 'super'.repeat(201) })
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a bad bulkVideosSupportUpdate field', async function () {
      const fields = immutableAssign(baseCorrectParams, { bulkVideosSupportUpdate: 'super' })
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When updating video channel avatar/banner', function () {
    const types = [ 'avatar', 'banner' ]
    let path: string

    before(async function () {
      path = videoChannelPath + '/super_channel'
    })

    it('Should fail with an incorrect input file', async function () {
      for (const type of types) {
        const fields = {}
        const attaches = {
          [type + 'file']: buildAbsoluteFixturePath('video_short.mp4')
        }

        await makeUploadRequest({ url: server.url, path: `${path}/${type}/pick`, token: server.accessToken, fields, attaches })
      }
    })

    it('Should fail with a big file', async function () {
      for (const type of types) {
        const fields = {}
        const attaches = {
          [type + 'file']: buildAbsoluteFixturePath('avatar-big.png')
        }
        await makeUploadRequest({ url: server.url, path: `${path}/${type}/pick`, token: server.accessToken, fields, attaches })
      }
    })

    it('Should fail with an unauthenticated user', async function () {
      for (const type of types) {
        const fields = {}
        const attaches = {
          [type + 'file']: buildAbsoluteFixturePath('avatar.png')
        }
        await makeUploadRequest({
          url: server.url,
          path: `${path}/${type}/pick`,
          fields,
          attaches,
          statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401
        })
      }
    })

    it('Should succeed with the correct params', async function () {
      for (const type of types) {
        const fields = {}
        const attaches = {
          [type + 'file']: buildAbsoluteFixturePath('avatar.png')
        }
        await makeUploadRequest({
          url: server.url,
          path: `${path}/${type}/pick`,
          token: server.accessToken,
          fields,
          attaches,
          statusCodeExpected: HttpStatusCode.OK_200
        })
      }
    })
  })

  describe('When getting a video channel', function () {
    it('Should return the list of the video channels with nothing', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: videoChannelPath,
        statusCodeExpected: HttpStatusCode.OK_200
      })

      expect(res.body.data).to.be.an('array')
    })

    it('Should return 404 with an incorrect video channel', async function () {
      await makeGetRequest({
        url: server.url,
        path: videoChannelPath + '/super_channel2',
        statusCodeExpected: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path: videoChannelPath + '/super_channel',
        statusCodeExpected: HttpStatusCode.OK_200
      })
    })
  })

  describe('When deleting a video channel', function () {
    it('Should fail with a non authenticated user', async function () {
      await deleteVideoChannel(server.url, 'coucou', 'super_channel', HttpStatusCode.UNAUTHORIZED_401)
    })

    it('Should fail with another authenticated user', async function () {
      await deleteVideoChannel(server.url, accessTokenUser, 'super_channel', HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with an unknown video channel id', async function () {
      await deleteVideoChannel(server.url, server.accessToken, 'super_channel2', HttpStatusCode.NOT_FOUND_404)
    })

    it('Should succeed with the correct parameters', async function () {
      await deleteVideoChannel(server.url, server.accessToken, 'super_channel')
    })

    it('Should fail to delete the last user video channel', async function () {
      await deleteVideoChannel(server.url, server.accessToken, 'root_channel', HttpStatusCode.CONFLICT_409)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
