/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { omit } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoChannelUpdate } from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  ChannelsCommand,
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  makeUploadRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSort, checkBadStartPagination } from '@tests/shared/checks.js'
import { expect } from 'chai'

describe('Test video channels API validator', function () {
  const videoChannelPath = '/api/v1/video-channels'
  let server: PeerTubeServer
  const userInfo = {
    accessToken: '',
    channelName: 'fake_channel',
    id: -1,
    videoQuota: -1,
    videoQuotaDaily: -1
  }
  let command: ChannelsCommand
  let editorToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    const userCreds = {
      username: 'fake',
      password: 'fake_password'
    }

    {
      const user = await server.users.create({ username: userCreds.username, password: userCreds.password })
      userInfo.id = user.id
      userInfo.accessToken = await server.login.getAccessToken(userCreds)
    }

    command = server.channels
  })

  describe('When listing a video channels', function () {
    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, videoChannelPath, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, videoChannelPath, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSort(server.url, videoChannelPath, server.accessToken)
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
      await checkBadSort(server.url, accountChannelPath, server.accessToken)
    })

    it('Should fail with a unknown account', async function () {
      await server.channels.listByAccount({ accountName: 'unknown', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path: accountChannelPath,
        expectedStatus: HttpStatusCode.OK_200
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
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should fail without a name', async function () {
      const fields = omit(baseCorrectParams, [ 'name' ])
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should fail with a bad name', async function () {
      const fields = { ...baseCorrectParams, name: 'super name' }
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should fail without a name', async function () {
      const fields = omit(baseCorrectParams, [ 'displayName' ])
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should fail with a long name', async function () {
      const fields = { ...baseCorrectParams, displayName: 'super'.repeat(25) }
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = { ...baseCorrectParams, description: 'super'.repeat(201) }
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should fail with a long support text', async function () {
      const fields = { ...baseCorrectParams, support: 'super'.repeat(201) }
      await makePostBodyRequest({ url: server.url, path: videoChannelPath, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePostBodyRequest({
        url: server.url,
        path: videoChannelPath,
        token: server.accessToken,
        fields: baseCorrectParams,
        expectedStatus: HttpStatusCode.OK_200
      })

      editorToken = await server.channelCollaborators.createEditor('editor', 'super_channel')
    })

    it('Should fail when adding a channel with the same username', async function () {
      await makePostBodyRequest({
        url: server.url,
        path: videoChannelPath,
        token: server.accessToken,
        fields: baseCorrectParams,
        expectedStatus: HttpStatusCode.CONFLICT_409
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
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with another authenticated user', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        token: userInfo.accessToken,
        fields: baseCorrectParams,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with a long name', async function () {
      const fields = { ...baseCorrectParams, displayName: 'super'.repeat(25) }
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = { ...baseCorrectParams, description: 'super'.repeat(201) }
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long support text', async function () {
      const fields = { ...baseCorrectParams, support: 'super'.repeat(201) }
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a bad bulkVideosSupportUpdate field', async function () {
      const fields = { ...baseCorrectParams, bulkVideosSupportUpdate: 'super' }
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      for (const token of [ server.accessToken, editorToken ]) {
        await makePutBodyRequest({
          url: server.url,
          path,
          token,
          fields: baseCorrectParams,
          expectedStatus: HttpStatusCode.NO_CONTENT_204
        })
      }
    })
  })

  describe('When updating video channel avatars/banners', function () {
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
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      }
    })

    it('Should succeed with the correct params', async function () {
      for (const token of [ server.accessToken, editorToken ]) {
        for (const type of types) {
          const fields = {}
          const attaches = { [type + 'file']: buildAbsoluteFixturePath('avatar.png') }

          await makeUploadRequest({
            url: server.url,
            path: `${path}/${type}/pick`,
            token,
            fields,
            attaches,
            expectedStatus: HttpStatusCode.OK_200
          })
        }
      }
    })
  })

  describe('When getting a video channel', function () {
    it('Should return the list of the video channels with nothing', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: videoChannelPath,
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.data).to.be.an('array')
    })

    it('Should return 404 with an incorrect video channel', async function () {
      await makeGetRequest({
        url: server.url,
        path: videoChannelPath + '/super_channel2',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path: videoChannelPath + '/super_channel',
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When getting channel followers', function () {
    const path = '/api/v1/video-channels/super_channel/followers'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSort(server.url, path, server.accessToken)
    })

    it('Should fail with a unauthenticated user', async function () {
      await makeGetRequest({ url: server.url, path, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a another user', async function () {
      await makeGetRequest({ url: server.url, path, token: userInfo.accessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the correct params', async function () {
      for (const token of [ server.accessToken, editorToken ]) {
        await makeGetRequest({ url: server.url, path, token, expectedStatus: HttpStatusCode.OK_200 })
      }
    })
  })

  describe('When deleting a video channel', function () {
    it('Should fail with a non authenticated user', async function () {
      await command.delete({ token: 'coucou', channelName: 'super_channel', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with another authenticated user', async function () {
      await command.delete({ token: userInfo.accessToken, channelName: 'super_channel', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with an unknown video channel id', async function () {
      await command.delete({ channelName: 'super_channel2', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a another user', async function () {
      await command.delete({ token: editorToken, channelName: 'super_channel', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the correct parameters', async function () {
      await command.delete({ channelName: 'super_channel' })
    })

    it('Should fail to delete the last user video channel', async function () {
      await command.delete({ channelName: 'root_channel', expectedStatus: HttpStatusCode.CONFLICT_409 })
    })

    it('Should fail to create a channel with the same name as the deleted one', async function () {
      await command.create({
        attributes: {
          name: 'super_channel'
        },
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
