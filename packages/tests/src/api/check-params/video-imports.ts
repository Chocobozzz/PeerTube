/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { omit } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoCommentPolicy, VideoImportCreate, VideoPrivacy } from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  makePostBodyRequest,
  makeUploadRequest,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@tests/shared/checks.js'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'

describe('Test video imports API validator', function () {
  const path = '/api/v1/videos/imports'
  let server: PeerTubeServer
  let userAccessToken = ''
  let channelId: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    const username = 'user1'
    const password = 'my super password'
    await server.users.create({ username, password })
    userAccessToken = await server.login.getAccessToken({ username, password })

    {
      const { videoChannels } = await server.users.getMyInfo()
      channelId = videoChannels[0].id
    }
  })

  describe('When listing my video imports', function () {
    const myPath = '/api/v1/users/me/videos/imports'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, myPath, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, myPath, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, myPath, server.accessToken)
    })

    it('Should fail with a bad videoChannelSyncId param', async function () {
      await makeGetRequest({
        url: server.url,
        path: myPath,
        query: { videoChannelSyncId: 'toto' },
        token: server.accessToken
      })
    })

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path: myPath, expectedStatus: HttpStatusCode.OK_200, token: server.accessToken })
    })
  })

  describe('When adding a video import', function () {
    let baseCorrectParams: VideoImportCreate

    before(function () {
      baseCorrectParams = {
        targetUrl: FIXTURE_URLS.goodVideo,
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
        channelId
      }
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail without a target url', async function () {
      const fields = omit(baseCorrectParams, [ 'targetUrl' ])
      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad target url', async function () {
      const fields = { ...baseCorrectParams, targetUrl: 'htt://hello' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with localhost', async function () {
      const fields = { ...baseCorrectParams, targetUrl: 'http://localhost:8000' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a private IP target urls', async function () {
      const targetUrls = [
        'http://127.0.0.1:8000',
        'http://127.0.0.1',
        'http://127.0.0.1/hello',
        'https://192.168.1.42',
        'http://192.168.1.42',
        'http://127.0.0.1.cpy.re'
      ]

      for (const targetUrl of targetUrls) {
        const fields = { ...baseCorrectParams, targetUrl }

        await makePostBodyRequest({
          url: server.url,
          path,
          token: server.accessToken,
          fields,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
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

    it('Should fail with a bad commentsPolicy', async function () {
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

    it('Should fail with an invalid torrent file', async function () {
      const fields = omit(baseCorrectParams, [ 'targetUrl' ])
      const attaches = {
        torrentfile: buildAbsoluteFixturePath('avatar-big.png')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with an invalid magnet URI', async function () {
      let fields = omit(baseCorrectParams, [ 'targetUrl' ])
      fields = { ...fields, magnetUri: 'blabla' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      this.timeout(120000)

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        expectedStatus: HttpStatusCode.OK_200
      })
    })

    it('Should forbid to import http videos', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          import: {
            videos: {
              http: {
                enabled: false
              },
              torrent: {
                enabled: true
              }
            }
          }
        }
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should forbid to import torrent videos', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          import: {
            videos: {
              http: {
                enabled: true
              },
              torrent: {
                enabled: false
              }
            }
          }
        }
      })

      let fields = omit(baseCorrectParams, [ 'targetUrl' ])
      fields = { ...fields, magnetUri: FIXTURE_URLS.magnet }

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })

      fields = omit(fields, [ 'magnetUri' ])
      const attaches = {
        torrentfile: buildAbsoluteFixturePath('video-720p.torrent')
      }

      await makeUploadRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        attaches,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })
  })

  describe('Deleting/cancelling a video import', function () {
    let importId: number

    async function importVideo () {
      const attributes = { channelId: server.store.channel.id, targetUrl: FIXTURE_URLS.goodVideo }
      const res = await server.videoImports.importVideo({ attributes })

      return res.id
    }

    before(async function () {
      importId = await importVideo()
    })

    it('Should fail with an invalid import id', async function () {
      await server.videoImports.cancel({ importId: 'artyom' as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await server.videoImports.delete({ importId: 'artyom' as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an unknown import id', async function () {
      await server.videoImports.cancel({ importId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await server.videoImports.delete({ importId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail without token', async function () {
      await server.videoImports.cancel({ importId, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      await server.videoImports.delete({ importId, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with another user token', async function () {
      await server.videoImports.cancel({ importId, token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await server.videoImports.delete({ importId, token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail to cancel non pending import', async function () {
      this.timeout(60000)

      await waitJobs([ server ])

      await server.videoImports.cancel({ importId, expectedStatus: HttpStatusCode.CONFLICT_409 })
    })

    it('Should succeed to delete an import', async function () {
      await server.videoImports.delete({ importId })
    })

    it('Should fail to delete a pending import', async function () {
      await server.jobs.pauseJobQueue()

      importId = await importVideo()

      await server.videoImports.delete({ importId, expectedStatus: HttpStatusCode.CONFLICT_409 })
    })

    it('Should succeed to cancel an import', async function () {
      importId = await importVideo()

      await server.videoImports.cancel({ importId })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
