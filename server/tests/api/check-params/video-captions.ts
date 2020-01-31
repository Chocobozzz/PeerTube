/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import {
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
import { join } from 'path'
import { createVideoCaption } from '../../../../shared/extra-utils/videos/video-captions'

describe('Test video captions API validator', function () {
  const path = '/api/v1/videos/'

  let server: ServerInfo
  let userAccessToken: string
  let videoUUID: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    {
      const res = await uploadVideo(server.url, server.accessToken, {})
      videoUUID = res.body.video.uuid
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
      captionfile: join(__dirname, '..', '..', 'fixtures', 'subtitle-good1.vtt')
    }

    it('Should fail without a valid uuid', async function () {
      await makeUploadRequest({
        method: 'PUT',
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df563d0b06/captions',
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail with an unknown id', async function () {
      await makeUploadRequest({
        method: 'PUT',
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df5630b06/captions',
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail with a missing language in path', async function () {
      const captionPath = path + videoUUID + '/captions'
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
      const captionPath = path + videoUUID + '/captions/15'
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
      const captionPath = path + videoUUID + '/captions/fr'
      await makeUploadRequest({
        method: 'PUT',
        url: server.url,
        path: captionPath,
        fields,
        attaches,
        statusCodeExpected: 401
      })
    })

    it('Should fail with a bad access token', async function () {
      const captionPath = path + videoUUID + '/captions/fr'
      await makeUploadRequest({
        method: 'PUT',
        url: server.url,
        path: captionPath,
        token: 'blabla',
        fields,
        attaches,
        statusCodeExpected: 401
      })
    })

    // We accept any file now
    // it('Should fail with an invalid captionfile extension', async function () {
    //   const attaches = {
    //     'captionfile': join(__dirname, '..', '..', 'fixtures', 'subtitle-bad.txt')
    //   }
    //
    //   const captionPath = path + videoUUID + '/captions/fr'
    //   await makeUploadRequest({
    //     method: 'PUT',
    //     url: server.url,
    //     path: captionPath,
    //     token: server.accessToken,
    //     fields,
    //     attaches,
    //     statusCodeExpected: 400
    //   })
    // })

    // We don't check the extension yet
    // it('Should fail with an invalid captionfile extension and octet-stream mime type', async function () {
    //   await createVideoCaption({
    //     url: server.url,
    //     accessToken: server.accessToken,
    //     language: 'zh',
    //     videoId: videoUUID,
    //     fixture: 'subtitle-bad.txt',
    //     mimeType: 'application/octet-stream',
    //     statusCodeExpected: 400
    //   })
    // })

    it('Should succeed with a valid captionfile extension and octet-stream mime type', async function () {
      await createVideoCaption({
        url: server.url,
        accessToken: server.accessToken,
        language: 'zh',
        videoId: videoUUID,
        fixture: 'subtitle-good.srt',
        mimeType: 'application/octet-stream'
      })
    })

    // We don't check the file validity yet
    // it('Should fail with an invalid captionfile srt', async function () {
    //   const attaches = {
    //     'captionfile': join(__dirname, '..', '..', 'fixtures', 'subtitle-bad.srt')
    //   }
    //
    //   const captionPath = path + videoUUID + '/captions/fr'
    //   await makeUploadRequest({
    //     method: 'PUT',
    //     url: server.url,
    //     path: captionPath,
    //     token: server.accessToken,
    //     fields,
    //     attaches,
    //     statusCodeExpected: 500
    //   })
    // })

    it('Should success with the correct parameters', async function () {
      const captionPath = path + videoUUID + '/captions/fr'
      await makeUploadRequest({
        method: 'PUT',
        url: server.url,
        path: captionPath,
        token: server.accessToken,
        fields,
        attaches,
        statusCodeExpected: 204
      })
    })
  })

  describe('When listing video captions', function () {
    it('Should fail without a valid uuid', async function () {
      await makeGetRequest({ url: server.url, path: path + '4da6fde3-88f7-4d16-b119-108df563d0b06/captions' })
    })

    it('Should fail with an unknown id', async function () {
      await makeGetRequest({ url: server.url, path: path + '4da6fde3-88f7-4d16-b119-108df5630b06/captions', statusCodeExpected: 404 })
    })

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path: path + videoUUID + '/captions', statusCodeExpected: 200 })
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
        statusCodeExpected: 404
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
      const captionPath = path + videoUUID + '/captions'
      await makeDeleteRequest({ url: server.url, path: captionPath, token: server.accessToken })
    })

    it('Should fail with an unknown language', async function () {
      const captionPath = path + videoUUID + '/captions/15'
      await makeDeleteRequest({ url: server.url, path: captionPath, token: server.accessToken })
    })

    it('Should fail without access token', async function () {
      const captionPath = path + videoUUID + '/captions/fr'
      await makeDeleteRequest({ url: server.url, path: captionPath, statusCodeExpected: 401 })
    })

    it('Should fail with a bad access token', async function () {
      const captionPath = path + videoUUID + '/captions/fr'
      await makeDeleteRequest({ url: server.url, path: captionPath, token: 'coucou', statusCodeExpected: 401 })
    })

    it('Should fail with another user', async function () {
      const captionPath = path + videoUUID + '/captions/fr'
      await makeDeleteRequest({ url: server.url, path: captionPath, token: userAccessToken, statusCodeExpected: 403 })
    })

    it('Should success with the correct parameters', async function () {
      const captionPath = path + videoUUID + '/captions/fr'
      await makeDeleteRequest({ url: server.url, path: captionPath, token: server.accessToken, statusCodeExpected: 204 })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
