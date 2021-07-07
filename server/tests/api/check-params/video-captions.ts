/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { VideoCreateResult } from '@shared/models'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import {
  buildAbsoluteFixturePath,
  cleanupTests,
  createUser,
  flushAndRunServer,
  makeDeleteRequest,
  makeGetRequest,
  makeUploadRequest,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  userLogin
} from '../../../../shared/extra-utils'
import { createVideoCaption } from '../../../../shared/extra-utils/videos/video-captions'

describe('Test video captions API validator', function () {
  const path = '/api/v1/videos/'

  let server: ServerInfo
  let userAccessToken: string
  let video: VideoCreateResult

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    {
      const res = await uploadVideo(server.url, server.accessToken, {})
      video = res.body.video
    }

    {
      const user = {
        username: 'user1',
        password: 'my super password'
      }
      await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })
      userAccessToken = await userLogin(server, user)
    }
  })

  describe('When adding video caption', function () {
    const fields = { }
    const attaches = {
      captionfile: buildAbsoluteFixturePath('subtitle-good1.vtt')
    }

    it('Should fail without a valid uuid', async function () {
      await makeUploadRequest({
        method: 'PUT',
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df563d0b06/captions/fr',
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail with an unknown id', async function () {
      await makeUploadRequest({
        method: 'PUT',
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df5630b06/captions/fr',
        token: server.accessToken,
        fields,
        attaches,
        statusCodeExpected: 404
      })
    })

    it('Should fail with a missing language in path', async function () {
      const captionPath = path + video.uuid + '/captions'
      await makeUploadRequest({
        method: 'PUT',
        url: server.url,
        path: captionPath,
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail with an unknown language', async function () {
      const captionPath = path + video.uuid + '/captions/15'
      await makeUploadRequest({
        method: 'PUT',
        url: server.url,
        path: captionPath,
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail without access token', async function () {
      const captionPath = path + video.uuid + '/captions/fr'
      await makeUploadRequest({
        method: 'PUT',
        url: server.url,
        path: captionPath,
        fields,
        attaches,
        statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a bad access token', async function () {
      const captionPath = path + video.uuid + '/captions/fr'
      await makeUploadRequest({
        method: 'PUT',
        url: server.url,
        path: captionPath,
        token: 'blabla',
        fields,
        attaches,
        statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    // We accept any file now
    // it('Should fail with an invalid captionfile extension', async function () {
    //   const attaches = {
    //     'captionfile': buildAbsoluteFixturePath('subtitle-bad.txt')
    //   }
    //
    //   const captionPath = path + video.uuid + '/captions/fr'
    //   await makeUploadRequest({
    //     method: 'PUT',
    //     url: server.url,
    //     path: captionPath,
    //     token: server.accessToken,
    //     fields,
    //     attaches,
    //     statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
    //   })
    // })

    // We don't check the extension yet
    // it('Should fail with an invalid captionfile extension and octet-stream mime type', async function () {
    //   await createVideoCaption({
    //     url: server.url,
    //     accessToken: server.accessToken,
    //     language: 'zh',
    //     videoId: video.uuid,
    //     fixture: 'subtitle-bad.txt',
    //     mimeType: 'application/octet-stream',
    //     statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
    //   })
    // })

    it('Should succeed with a valid captionfile extension and octet-stream mime type', async function () {
      await createVideoCaption({
        url: server.url,
        accessToken: server.accessToken,
        language: 'zh',
        videoId: video.uuid,
        fixture: 'subtitle-good.srt',
        mimeType: 'application/octet-stream'
      })
    })

    // We don't check the file validity yet
    // it('Should fail with an invalid captionfile srt', async function () {
    //   const attaches = {
    //     'captionfile': buildAbsoluteFixturePath('subtitle-bad.srt')
    //   }
    //
    //   const captionPath = path + video.uuid + '/captions/fr'
    //   await makeUploadRequest({
    //     method: 'PUT',
    //     url: server.url,
    //     path: captionPath,
    //     token: server.accessToken,
    //     fields,
    //     attaches,
    //     statusCodeExpected: HttpStatusCode.INTERNAL_SERVER_ERROR_500
    //   })
    // })

    it('Should success with the correct parameters', async function () {
      const captionPath = path + video.uuid + '/captions/fr'
      await makeUploadRequest({
        method: 'PUT',
        url: server.url,
        path: captionPath,
        token: server.accessToken,
        fields,
        attaches,
        statusCodeExpected: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When listing video captions', function () {
    it('Should fail without a valid uuid', async function () {
      await makeGetRequest({ url: server.url, path: path + '4da6fde3-88f7-4d16-b119-108df563d0b06/captions' })
    })

    it('Should fail with an unknown id', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df5630b06/captions',
        statusCodeExpected: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path: path + video.shortUUID + '/captions', statusCodeExpected: HttpStatusCode.OK_200 })
    })
  })

  describe('When deleting video caption', function () {
    it('Should fail without a valid uuid', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df563d0b06/captions/fr',
        token: server.accessToken
      })
    })

    it('Should fail with an unknown id', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df5630b06/captions/fr',
        token: server.accessToken,
        statusCodeExpected: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with an invalid language', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df5630b06/captions/16',
        token: server.accessToken
      })
    })

    it('Should fail with a missing language', async function () {
      const captionPath = path + video.shortUUID + '/captions'
      await makeDeleteRequest({ url: server.url, path: captionPath, token: server.accessToken })
    })

    it('Should fail with an unknown language', async function () {
      const captionPath = path + video.shortUUID + '/captions/15'
      await makeDeleteRequest({ url: server.url, path: captionPath, token: server.accessToken })
    })

    it('Should fail without access token', async function () {
      const captionPath = path + video.shortUUID + '/captions/fr'
      await makeDeleteRequest({ url: server.url, path: captionPath, statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a bad access token', async function () {
      const captionPath = path + video.shortUUID + '/captions/fr'
      await makeDeleteRequest({ url: server.url, path: captionPath, token: 'coucou', statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with another user', async function () {
      const captionPath = path + video.shortUUID + '/captions/fr'
      await makeDeleteRequest({
        url: server.url,
        path: captionPath,
        token: userAccessToken,
        statusCodeExpected: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should success with the correct parameters', async function () {
      const captionPath = path + video.shortUUID + '/captions/fr'
      await makeDeleteRequest({
        url: server.url,
        path: captionPath,
        token: server.accessToken,
        statusCodeExpected: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
