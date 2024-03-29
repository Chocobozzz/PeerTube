/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { omit } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  LiveVideoCreate,
  LiveVideoLatencyMode,
  VideoCommentPolicy,
  VideoCreateResult,
  VideoPrivacy
} from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  LiveCommand,
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  makePostBodyRequest,
  makeUploadRequest,
  sendRTMPStream,
  setAccessTokensToServers,
  stopFfmpeg
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test video lives API validator', function () {
  const path = '/api/v1/videos/live'
  let server: PeerTubeServer
  let userAccessToken = ''
  let channelId: number
  let video: VideoCreateResult
  let videoIdNotLive: number
  let command: LiveCommand

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    await server.config.enableMinimumTranscoding()
    await server.config.updateExistingConfig({
      newConfig: {
        live: {
          enabled: true,
          latencySetting: {
            enabled: false
          },
          maxInstanceLives: 20,
          maxUserLives: 20,
          allowReplay: true
        }
      }
    })

    const username = 'user1'
    const password = 'my super password'
    await server.users.create({ username, password })
    userAccessToken = await server.login.getAccessToken({ username, password })

    {
      const { videoChannels } = await server.users.getMyInfo()
      channelId = videoChannels[0].id
    }

    {
      videoIdNotLive = (await server.videos.quickUpload({ name: 'not live' })).id
    }

    command = server.live
  })

  describe('When creating a live', function () {
    let baseCorrectParams: LiveVideoCreate

    before(function () {
      baseCorrectParams = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 'pt',
        nsfw: false,
        commentsPolicy: VideoCommentPolicy.ENABLED,
        downloadEnabled: true,
        waitTranscoding: true,
        description: 'my super description',
        support: 'my super support text',
        tags: [ 'tag1', 'tag2' ],
        privacy: VideoPrivacy.PUBLIC,
        channelId,
        saveReplay: false,
        replaySettings: undefined,
        permanentLive: true,
        latencyMode: LiveVideoLatencyMode.DEFAULT
      }
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long name', async function () {
      const fields = { ...baseCorrectParams, name: 'super'.repeat(65) }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a bad category', async function () {
      const fields = { ...baseCorrectParams, category: 125 }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a bad licence', async function () {
      const fields = { ...baseCorrectParams, licence: 125 }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a bad language', async function () {
      const fields = { ...baseCorrectParams, language: 'a'.repeat(15) }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with bad comments policy', async function () {
      const fields = { ...baseCorrectParams, commentsPolicy: 42 }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = { ...baseCorrectParams, description: 'super'.repeat(2500) }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a long support text', async function () {
      const fields = { ...baseCorrectParams, support: 'super'.repeat(201) }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail without a channel', async function () {
      const fields = omit(baseCorrectParams, [ 'channelId' ])

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a bad channel', async function () {
      const fields = { ...baseCorrectParams, channelId: 545454 }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a bad privacy for replay settings', async function () {
      const fields = { ...baseCorrectParams, saveReplay: true, replaySettings: { privacy: 999 } }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with another user channel', async function () {
      const user = {
        username: 'fake',
        password: 'fake_password'
      }
      await server.users.create({ username: user.username, password: user.password })

      const accessTokenUser = await server.login.getAccessToken(user)
      const { videoChannels } = await server.users.getMyInfo({ token: accessTokenUser })
      const customChannelId = videoChannels[0].id

      const fields = { ...baseCorrectParams, channelId: customChannelId }

      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields })
    })

    it('Should fail with too many tags', async function () {
      const fields = { ...baseCorrectParams, tags: [ 'tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6' ] }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a tag length too low', async function () {
      const fields = { ...baseCorrectParams, tags: [ 'tag1', 't' ] }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a tag length too big', async function () {
      const fields = { ...baseCorrectParams, tags: [ 'tag1', 'my_super_tag_too_long_long_long_long_long_long' ] }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect thumbnail file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        thumbnailfile: buildAbsoluteFixturePath('video_short.mp4')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a big thumbnail file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        thumbnailfile: buildAbsoluteFixturePath('custom-preview-big.png')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with an incorrect preview file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        previewfile: buildAbsoluteFixturePath('video_short.mp4')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a big preview file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        previewfile: buildAbsoluteFixturePath('custom-preview-big.png')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with bad latency setting', async function () {
      const fields = { ...baseCorrectParams, latencyMode: 42 }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail to set latency if the server does not allow it', async function () {
      const fields = { ...baseCorrectParams, latencyMode: LiveVideoLatencyMode.HIGH_LATENCY }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the correct parameters', async function () {
      this.timeout(30000)

      const res = await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        expectedStatus: HttpStatusCode.OK_200
      })

      video = res.body.video
    })

    it('Should forbid if live is disabled', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          live: {
            enabled: false
          }
        }
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should forbid to save replay if not enabled by the admin', async function () {
      const fields = { ...baseCorrectParams, saveReplay: true, replaySettings: { privacy: VideoPrivacy.PUBLIC } }

      await server.config.enableLive({ allowReplay: false, transcoding: false })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should allow to save replay if enabled by the admin', async function () {
      const fields = { ...baseCorrectParams, saveReplay: true, replaySettings: { privacy: VideoPrivacy.PUBLIC } }

      await server.config.enableLive({ allowReplay: true, transcoding: false })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.OK_200
      })
    })

    it('Should not allow live if max instance lives is reached', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          live: {
            enabled: true,
            maxInstanceLives: 1
          }
        }
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should not allow live if max user lives is reached', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          live: {
            enabled: true,
            maxInstanceLives: 20,
            maxUserLives: 1
          }
        }
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  describe('When getting live information', function () {

    it('Should fail with a bad access token', async function () {
      await command.get({ token: 'toto', videoId: video.id, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should not display private information without access token', async function () {
      const live = await command.get({ token: '', videoId: video.id })

      expect(live.rtmpUrl).to.not.exist
      expect(live.streamKey).to.not.exist
      expect(live.latencyMode).to.exist
    })

    it('Should not display private information with token of another user', async function () {
      const live = await command.get({ token: userAccessToken, videoId: video.id })

      expect(live.rtmpUrl).to.not.exist
      expect(live.streamKey).to.not.exist
      expect(live.latencyMode).to.exist
    })

    it('Should display private information with appropriate token', async function () {
      const live = await command.get({ videoId: video.id })

      expect(live.rtmpUrl).to.exist
      expect(live.streamKey).to.exist
      expect(live.latencyMode).to.exist
    })

    it('Should fail with a bad video id', async function () {
      await command.get({ videoId: 'toto', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an unknown video id', async function () {
      await command.get({ videoId: 454555, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a non live video', async function () {
      await command.get({ videoId: videoIdNotLive, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct params', async function () {
      await command.get({ videoId: video.id })
      await command.get({ videoId: video.uuid })
      await command.get({ videoId: video.shortUUID })
    })
  })

  describe('When getting live sessions', function () {

    it('Should fail with a bad access token', async function () {
      await command.listSessions({ token: 'toto', videoId: video.id, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail without token', async function () {
      await command.listSessions({ token: null, videoId: video.id, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with the token of another user', async function () {
      await command.listSessions({ token: userAccessToken, videoId: video.id, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with a bad video id', async function () {
      await command.listSessions({ videoId: 'toto', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an unknown video id', async function () {
      await command.listSessions({ videoId: 454555, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a non live video', async function () {
      await command.listSessions({ videoId: videoIdNotLive, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct params', async function () {
      await command.listSessions({ videoId: video.id })
    })
  })

  describe('When getting live session of a replay', function () {

    it('Should fail with a bad video id', async function () {
      await command.getReplaySession({ videoId: 'toto', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an unknown video id', async function () {
      await command.getReplaySession({ videoId: 454555, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a non replay video', async function () {
      await command.getReplaySession({ videoId: videoIdNotLive, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })
  })

  describe('When updating live information', async function () {

    it('Should fail without access token', async function () {
      await command.update({ token: '', videoId: video.id, fields: {}, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a bad access token', async function () {
      await command.update({ token: 'toto', videoId: video.id, fields: {}, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with access token of another user', async function () {
      await command.update({ token: userAccessToken, videoId: video.id, fields: {}, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with a bad video id', async function () {
      await command.update({ videoId: 'toto', fields: {}, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an unknown video id', async function () {
      await command.update({ videoId: 454555, fields: {}, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a non live video', async function () {
      await command.update({ videoId: videoIdNotLive, fields: {}, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with bad latency setting', async function () {
      const fields = { latencyMode: 42 as any }

      await command.update({ videoId: video.id, fields, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with a bad privacy for replay settings', async function () {
      const fields = { saveReplay: true, replaySettings: { privacy: 999 as any } }

      await command.update({ videoId: video.id, fields, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with save replay enabled but without replay settings', async function () {
      await server.config.enableLive({ allowReplay: true, transcoding: false })

      const fields = { saveReplay: true }

      await command.update({ videoId: video.id, fields, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with save replay disabled and replay settings', async function () {
      const fields = { saveReplay: false, replaySettings: { privacy: VideoPrivacy.INTERNAL } }

      await command.update({ videoId: video.id, fields, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with only replay settings when save replay is disabled', async function () {
      const fields = { replaySettings: { privacy: VideoPrivacy.INTERNAL } }

      await command.update({ videoId: video.id, fields, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail to set latency if the server does not allow it', async function () {
      const fields = { latencyMode: LiveVideoLatencyMode.HIGH_LATENCY }

      await command.update({ videoId: video.id, fields, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the correct params', async function () {
      await command.update({ videoId: video.id, fields: { saveReplay: false } })
      await command.update({ videoId: video.uuid, fields: { saveReplay: false } })
      await command.update({ videoId: video.shortUUID, fields: { saveReplay: false } })

      await command.update({ videoId: video.id, fields: { saveReplay: true, replaySettings: { privacy: VideoPrivacy.PUBLIC } } })

    })

    it('Should fail to update replay status if replay is not allowed on the instance', async function () {
      await server.config.enableLive({ allowReplay: false, transcoding: false })

      await command.update({ videoId: video.id, fields: { saveReplay: true }, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed to live attributes if it has already started', async function () {
      this.timeout(40000)

      const live = await command.get({ videoId: video.id })

      const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })

      await command.waitUntilPublished({ videoId: video.id })
      await command.update({ videoId: video.id, fields: { permanentLive: false }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      await stopFfmpeg(ffmpegCommand)
    })

    it('Should fail to change live privacy if it has already started', async function () {
      this.timeout(40000)

      const live = await command.get({ videoId: video.id })

      const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })

      await command.waitUntilPublished({ videoId: video.id })

      await server.videos.update({
        id: video.id,
        attributes: { privacy: VideoPrivacy.PUBLIC } // Same privacy, it's fine
      })

      await server.videos.update({
        id: video.id,
        attributes: { privacy: VideoPrivacy.UNLISTED },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await stopFfmpeg(ffmpegCommand)
    })

    it('Should fail to stream twice in the save live', async function () {
      this.timeout(40000)

      const live = await command.get({ videoId: video.id })

      const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })

      await command.waitUntilPublished({ videoId: video.id })

      await command.runAndTestStreamError({ videoId: video.id, shouldHaveError: true })

      await stopFfmpeg(ffmpegCommand)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
