/* tslint:disable:no-unused-expression */

import { omit } from 'lodash'
import 'mocha'
import { join } from 'path'
import { VideoPrivacy } from '../../../../shared/models/videos/video-privacy.enum'
import {
  createUser,
  flushTests,
  getMyUserInformation,
  immutableAssign,
  killallServers,
  makeGetRequest,
  makePostBodyRequest,
  makeUploadRequest,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  updateCustomSubConfig,
  userLogin
} from '../../utils'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '../../utils/requests/check-api-params'
import { getMagnetURI, getYoutubeVideoUrl } from '../../utils/videos/video-imports'

describe('Test video imports API validator', function () {
  const path = '/api/v1/videos/imports'
  let server: ServerInfo
  let userAccessToken = ''
  let accountName: string
  let channelId: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    const username = 'user1'
    const password = 'my super password'
    await createUser(server.url, server.accessToken, username, password)
    userAccessToken = await userLogin(server, { username, password })

    {
      const res = await getMyUserInformation(server.url, server.accessToken)
      channelId = res.body.videoChannels[ 0 ].id
      accountName = res.body.account.name + '@' + res.body.account.host
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

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path: myPath, statusCodeExpected: 200, token: server.accessToken })
    })
  })

  describe('When adding a video import', function () {
    let baseCorrectParams

    before(function () {
      baseCorrectParams = {
        targetUrl: getYoutubeVideoUrl(),
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 'pt',
        nsfw: false,
        commentsEnabled: true,
        waitTranscoding: true,
        description: 'my super description',
        support: 'my super support text',
        tags: [ 'tag1', 'tag2' ],
        privacy: VideoPrivacy.PUBLIC,
        channelId: channelId
      }
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail without a target url', async function () {
      const fields = omit(baseCorrectParams, 'targetUrl')
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 400 })
    })

    it('Should fail with a bad target url', async function () {
      const fields = immutableAssign(baseCorrectParams, { targetUrl: 'htt://hello' })

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
      const fields = immutableAssign(baseCorrectParams, { support: 'super'.repeat(150) })

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
      await createUser(server.url, server.accessToken, user.username, user.password)

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
        'thumbnailfile': join(__dirname, '..', '..', 'fixtures', 'avatar.png')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a big thumbnail file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        'thumbnailfile': join(__dirname, '..', '..', 'fixtures', 'avatar-big.png')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with an incorrect preview file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        'previewfile': join(__dirname, '..', '..', 'fixtures', 'avatar.png')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a big preview file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        'previewfile': join(__dirname, '..', '..', 'fixtures', 'avatar-big.png')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with an invalid torrent file', async function () {
      const fields = omit(baseCorrectParams, 'targetUrl')
      const attaches = {
        'torrentfile': join(__dirname, '..', '..', 'fixtures', 'avatar-big.png')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with an invalid magnet URI', async function () {
      let fields = omit(baseCorrectParams, 'targetUrl')
      fields = immutableAssign(fields, { magnetUri: 'blabla' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      this.timeout(30000)

      {
        await makePostBodyRequest({
          url: server.url,
          path,
          token: server.accessToken,
          fields: baseCorrectParams,
          statusCodeExpected: 200
        })
      }
    })

    it('Should forbid to import http videos', async function () {
      await updateCustomSubConfig(server.url, server.accessToken, {
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
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: 409
      })
    })

    it('Should forbid to import torrent videos', async function () {
      await updateCustomSubConfig(server.url, server.accessToken, {
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
      })

      let fields = omit(baseCorrectParams, 'targetUrl')
      fields = immutableAssign(fields, { magnetUri: getMagnetURI() })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 409 })

      fields = omit(fields, 'magnetUri')
      const attaches = {
        'torrentfile': join(__dirname, '..', '..', 'fixtures', 'video-720p.torrent')
      }

      await makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches, statusCodeExpected: 409 })
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
