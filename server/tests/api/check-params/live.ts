/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { omit } from 'lodash'
import { join } from 'path'
import { LiveVideo, VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  createUser,
  flushAndRunServer,
  getLive,
  getMyUserInformation,
  immutableAssign,
  makePostBodyRequest,
  makeUploadRequest,
  runAndTestFfmpegStreamError,
  sendRTMPStream,
  ServerInfo,
  setAccessTokensToServers,
  stopFfmpeg,
  updateCustomSubConfig,
  updateLive,
  uploadVideoAndGetId,
  userLogin,
  waitUntilLivePublished
} from '../../../../shared/extra-utils'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

describe('Test video lives API validator', function () {
  const path = '/api/v1/videos/live'
  let server: ServerInfo
  let userAccessToken = ''
  let channelId: number
  let videoId: number
  let videoIdNotLive: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    await updateCustomSubConfig(server.url, server.accessToken, {
      live: {
        enabled: true,
        maxInstanceLives: 20,
        maxUserLives: 20,
        allowReplay: true
      }
    })

    const username = 'user1'
    const password = 'my super password'
    await createUser({ url: server.url, accessToken: server.accessToken, username: username, password: password })
    userAccessToken = await userLogin(server, { username, password })

    {
      const res = await getMyUserInformation(server.url, server.accessToken)
      channelId = res.body.videoChannels[0].id
    }

    {
      videoIdNotLive = (await uploadVideoAndGetId({ server, videoName: 'not live' })).id
    }
  })

  describe('When creating a live', function () {
    let baseCorrectParams

    before(function () {
      baseCorrectParams = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 'pt',
        nsfw: false,
        commentsEnabled: true,
        downloadEnabled: true,
        waitTranscoding: true,
        description: 'my super description',
        support: 'my super support text',
        tags: [ 'tag1', 'tag2' ],
        privacy: VideoPrivacy.PUBLIC,
        channelId,
        saveReplay: false,
        permanentLive: false
      }
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long name', async function () {
      const fields = immutableAssign(baseCorrectParams, { name: 'super'.repeat(65) })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a bad category', async function () {
      const fields = immutableAssign(baseCorrectParams, { category: 125 })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a bad licence', async function () {
      const fields = immutableAssign(baseCorrectParams, { licence: 125 })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a bad language', async function () {
      const fields = immutableAssign(baseCorrectParams, { language: 'a'.repeat(15) })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = immutableAssign(baseCorrectParams, { description: 'super'.repeat(2500) })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long support text', async function () {
      const fields = immutableAssign(baseCorrectParams, { support: 'super'.repeat(201) })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail without a channel', async function () {
      const fields = omit(baseCorrectParams, 'channelId')

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a bad channel', async function () {
      const fields = immutableAssign(baseCorrectParams, { channelId: 545454 })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with another user channel', async function () {
      const user = {
        username: 'fake',
        password: 'fake_password'
      }
      await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })

      const accessTokenUser = await userLogin(server, user)
      const res = await getMyUserInformation(server.url, accessTokenUser)
      const customChannelId = res.body.videoChannels[0].id

      const fields = immutableAssign(baseCorrectParams, { channelId: customChannelId })

      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields })
    })

    it('Should fail with too many tags', async function () {
      const fields = immutableAssign(baseCorrectParams, { tags: [ 'tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6' ] })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a tag length too low', async function () {
      const fields = immutableAssign(baseCorrectParams, { tags: [ 'tag1', 't' ] })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a tag length too big', async function () {
      const fields = immutableAssign(baseCorrectParams, { tags: [ 'tag1', 'my_super_tag_too_long_long_long_long_long_long' ] })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect thumbnail file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        thumbnailfile: join(__dirname, '..', '..', 'fixtures', 'video_short.mp4')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a big thumbnail file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        thumbnailfile: join(__dirname, '..', '..', 'fixtures', 'preview-big.png')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with an incorrect preview file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        previewfile: join(__dirname, '..', '..', 'fixtures', 'video_short.mp4')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a big preview file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        previewfile: join(__dirname, '..', '..', 'fixtures', 'preview-big.png')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with save replay and permanent live set to true', async function () {
      const fields = immutableAssign(baseCorrectParams, { saveReplay: true, permanentLive: true })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      this.timeout(30000)

      const res = await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: HttpStatusCode.OK_200
      })

      videoId = res.body.video.id
    })

    it('Should forbid if live is disabled', async function () {
      await updateCustomSubConfig(server.url, server.accessToken, {
        live: {
          enabled: false
        }
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should forbid to save replay if not enabled by the admin', async function () {
      const fields = immutableAssign(baseCorrectParams, { saveReplay: true })

      await updateCustomSubConfig(server.url, server.accessToken, {
        live: {
          enabled: true,
          allowReplay: false
        }
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        statusCodeExpected: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should allow to save replay if enabled by the admin', async function () {
      const fields = immutableAssign(baseCorrectParams, { saveReplay: true })

      await updateCustomSubConfig(server.url, server.accessToken, {
        live: {
          enabled: true,
          allowReplay: true
        }
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        statusCodeExpected: HttpStatusCode.OK_200
      })
    })

    it('Should not allow live if max instance lives is reached', async function () {
      await updateCustomSubConfig(server.url, server.accessToken, {
        live: {
          enabled: true,
          maxInstanceLives: 1
        }
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should not allow live if max user lives is reached', async function () {
      await updateCustomSubConfig(server.url, server.accessToken, {
        live: {
          enabled: true,
          maxInstanceLives: 20,
          maxUserLives: 1
        }
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  describe('When getting live information', function () {

    it('Should fail without access token', async function () {
      await getLive(server.url, '', videoId, HttpStatusCode.UNAUTHORIZED_401)
    })

    it('Should fail with a bad access token', async function () {
      await getLive(server.url, 'toto', videoId, HttpStatusCode.UNAUTHORIZED_401)
    })

    it('Should fail with access token of another user', async function () {
      await getLive(server.url, userAccessToken, videoId, HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with a bad video id', async function () {
      await getLive(server.url, server.accessToken, 'toto', HttpStatusCode.BAD_REQUEST_400)
    })

    it('Should fail with an unknown video id', async function () {
      await getLive(server.url, server.accessToken, 454555, HttpStatusCode.NOT_FOUND_404)
    })

    it('Should fail with a non live video', async function () {
      await getLive(server.url, server.accessToken, videoIdNotLive, HttpStatusCode.NOT_FOUND_404)
    })

    it('Should succeed with the correct params', async function () {
      await getLive(server.url, server.accessToken, videoId)
    })
  })

  describe('When updating live information', async function () {

    it('Should fail without access token', async function () {
      await updateLive(server.url, '', videoId, {}, HttpStatusCode.UNAUTHORIZED_401)
    })

    it('Should fail with a bad access token', async function () {
      await updateLive(server.url, 'toto', videoId, {}, HttpStatusCode.UNAUTHORIZED_401)
    })

    it('Should fail with access token of another user', async function () {
      await updateLive(server.url, userAccessToken, videoId, {}, HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail with a bad video id', async function () {
      await updateLive(server.url, server.accessToken, 'toto', {}, HttpStatusCode.BAD_REQUEST_400)
    })

    it('Should fail with an unknown video id', async function () {
      await updateLive(server.url, server.accessToken, 454555, {}, HttpStatusCode.NOT_FOUND_404)
    })

    it('Should fail with a non live video', async function () {
      await updateLive(server.url, server.accessToken, videoIdNotLive, {}, HttpStatusCode.NOT_FOUND_404)
    })

    it('Should fail with save replay and permanent live set to true', async function () {
      const fields = { saveReplay: true, permanentLive: true }

      await updateLive(server.url, server.accessToken, videoId, fields, HttpStatusCode.BAD_REQUEST_400)
    })

    it('Should succeed with the correct params', async function () {
      await updateLive(server.url, server.accessToken, videoId, { saveReplay: false })
    })

    it('Should fail to update replay status if replay is not allowed on the instance', async function () {
      await updateCustomSubConfig(server.url, server.accessToken, {
        live: {
          enabled: true,
          allowReplay: false
        }
      })

      await updateLive(server.url, server.accessToken, videoId, { saveReplay: true }, HttpStatusCode.FORBIDDEN_403)
    })

    it('Should fail to update a live if it has already started', async function () {
      this.timeout(40000)

      const resLive = await getLive(server.url, server.accessToken, videoId)
      const live: LiveVideo = resLive.body

      const command = sendRTMPStream(live.rtmpUrl, live.streamKey)

      await waitUntilLivePublished(server.url, server.accessToken, videoId)
      await updateLive(server.url, server.accessToken, videoId, {}, HttpStatusCode.BAD_REQUEST_400)

      await stopFfmpeg(command)
    })

    it('Should fail to stream twice in the save live', async function () {
      this.timeout(40000)

      const resLive = await getLive(server.url, server.accessToken, videoId)
      const live: LiveVideo = resLive.body

      const command = sendRTMPStream(live.rtmpUrl, live.streamKey)

      await waitUntilLivePublished(server.url, server.accessToken, videoId)

      await runAndTestFfmpegStreamError(server.url, server.accessToken, videoId, true)

      await stopFfmpeg(command)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
