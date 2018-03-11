/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import { omit } from 'lodash'
import 'mocha'
import { join } from 'path'
import { VideoPrivacy } from '../../../../shared/models/videos/video-privacy.enum'
import {
  createUser, flushTests, getMyUserInformation, getVideo, getVideosList, immutableAssign, killallServers, makeDeleteRequest,
  makeGetRequest, makeUploadRequest, makePutBodyRequest, removeVideo, runServer, ServerInfo, setAccessTokensToServers, userLogin
} from '../../utils'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '../../utils/requests/check-api-params'

const expect = chai.expect

describe('Test videos API validator', function () {
  const path = '/api/v1/videos/'
  let server: ServerInfo
  let userAccessToken = ''
  let channelId: number
  let videoId

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

    const res = await getMyUserInformation(server.url, server.accessToken)
    channelId = res.body.videoChannels[0].id
  })

  describe('When listing a video', function () {
    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path)
    })
  })

  describe('When searching a video', function () {

    it('Should fail with nothing', async function () {
      await makeGetRequest({
        url: server.url,
        path: join(path, 'search'),
        statusCodeExpected: 400
      })
    })

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, join(path, 'search', 'test'))
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, join(path, 'search', 'test'))
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, join(path, 'search', 'test'))
    })
  })

  describe('When listing my videos', function () {
    const path = '/api/v1/users/me/videos'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, server.accessToken)
    })
  })

  describe('When adding a video', function () {
    let baseCorrectParams
    const baseCorrectAttaches = {
      'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
    }

    before(function () {
      // Put in before to have channelId
      baseCorrectParams = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        commentsEnabled: true,
        description: 'my super description',
        support: 'my super support text',
        tags: [ 'tag1', 'tag2' ],
        privacy: VideoPrivacy.PUBLIC,
        channelId
      }
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      const attaches = {}
      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without name', async function () {
      const fields = omit(baseCorrectParams, 'name')
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a long name', async function () {
      const fields = immutableAssign(baseCorrectParams, { name: 'super'.repeat(65) })
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad category', async function () {
      const fields = immutableAssign(baseCorrectParams, { category: 125 })
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad licence', async function () {
      const fields = immutableAssign(baseCorrectParams, { licence: 125 })
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad language', async function () {
      const fields = immutableAssign(baseCorrectParams, { language: 125 })
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without nsfw attribute', async function () {
      const fields = omit(baseCorrectParams, 'nsfw')
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad nsfw attribute', async function () {
      const fields = immutableAssign(baseCorrectParams, { nsfw: 2 })
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without commentsEnabled attribute', async function () {
      const fields = omit(baseCorrectParams, 'commentsEnabled')
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad commentsEnabled attribute', async function () {
      const fields = immutableAssign(baseCorrectParams, { commentsEnabled: 2 })
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a long description', async function () {
      const fields = immutableAssign(baseCorrectParams, { description: 'super'.repeat(2500) })
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a long support text', async function () {
      const fields = immutableAssign(baseCorrectParams, { support: 'super'.repeat(70) })
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without a channel', async function () {
      const fields = omit(baseCorrectParams, 'channelId')
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad channel', async function () {
      const fields = immutableAssign(baseCorrectParams, { channelId: 545454 })
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
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
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with too many tags', async function () {
      const fields = immutableAssign(baseCorrectParams, { tags: [ 'tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6' ] })
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a tag length too low', async function () {
      const fields = immutableAssign(baseCorrectParams, { tags: [ 'tag1', 't' ] })
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a tag length too big', async function () {
      const fields = immutableAssign(baseCorrectParams, { tags: [ 'tag1', 'my_super_tag_too_long_long_long_long_long_long' ] })
      const attaches = baseCorrectAttaches

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without an input file', async function () {
      const fields = baseCorrectParams
      const attaches = {}
      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without an incorrect input file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short_fake.webm')
      }
      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with an incorrect thumbnail file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        'thumbnailfile': join(__dirname, '..', 'fixtures', 'avatar.png'),
        'videofile': join(__dirname, '..', 'fixtures', 'video_short_fake.webm')
      }

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a big thumbnail file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        'thumbnailfile': join(__dirname, '..', 'fixtures', 'avatar-big.png'),
        'videofile': join(__dirname, '..', 'fixtures', 'video_short_fake.webm')
      }

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with an incorrect preview file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        'previewfile': join(__dirname, '..', 'fixtures', 'avatar.png'),
        'videofile': join(__dirname, '..', 'fixtures', 'video_short_fake.webm')
      }

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a big preview file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        'previewfile': join(__dirname, '..', 'fixtures', 'avatar-big.png'),
        'videofile': join(__dirname, '..', 'fixtures', 'video_short_fake.webm')
      }

      await makeUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should succeed with the correct parameters', async function () {
      this.timeout(10000)

      const fields = baseCorrectParams

      {
        const attaches = baseCorrectAttaches
        await makeUploadRequest({
          url: server.url,
          path: path + '/upload',
          token: server.accessToken,
          fields,
          attaches,
          statusCodeExpected: 200
        })
      }

      {
        const attaches = immutableAssign(baseCorrectAttaches, {
          videofile: join(__dirname, '..', 'fixtures', 'video_short.mp4')
        })

        await makeUploadRequest({
          url: server.url,
          path: path + '/upload',
          token: server.accessToken,
          fields,
          attaches,
          statusCodeExpected: 200
        })
      }

      {
        const attaches = immutableAssign(baseCorrectAttaches, {
          videofile: join(__dirname, '..', 'fixtures', 'video_short.ogv')
        })

        await makeUploadRequest({
          url: server.url,
          path: path + '/upload',
          token: server.accessToken,
          fields,
          attaches,
          statusCodeExpected: 200
        })
      }
    })
  })

  describe('When updating a video', function () {
    const baseCorrectParams = {
      name: 'my super name',
      category: 5,
      licence: 2,
      language: 6,
      nsfw: false,
      commentsEnabled: false,
      description: 'my super description',
      privacy: VideoPrivacy.PUBLIC,
      tags: [ 'tag1', 'tag2' ]
    }

    before(async function () {
      const res = await getVideosList(server.url)
      videoId = res.body.data[0].uuid
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail without a valid uuid', async function () {
      const fields = baseCorrectParams
      await makePutBodyRequest({ url: server.url, path: path + 'blabla', token: server.accessToken, fields })
    })

    it('Should fail with an unknown id', async function () {
      const fields = baseCorrectParams

      await makePutBodyRequest({
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df5630b06',
        token: server.accessToken,
        fields,
        statusCodeExpected: 404
      })
    })

    it('Should fail with a long name', async function () {
      const fields = immutableAssign(baseCorrectParams, { name: 'super'.repeat(65) })

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad category', async function () {
      const fields = immutableAssign(baseCorrectParams, { category: 125 })

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad licence', async function () {
      const fields = immutableAssign(baseCorrectParams, { licence: 125 })

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad language', async function () {
      const fields = immutableAssign(baseCorrectParams, { language: 125 })

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad nsfw attribute', async function () {
      const fields = immutableAssign(baseCorrectParams, { nsfw: 2 })

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad commentsEnabled attribute', async function () {
      const fields = immutableAssign(baseCorrectParams, { commentsEnabled: 2 })

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = immutableAssign(baseCorrectParams, { description: 'super'.repeat(2500) })

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a long support text', async function () {
      const fields = immutableAssign(baseCorrectParams, { support: 'super'.repeat(70) })

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with too many tags', async function () {
      const fields = immutableAssign(baseCorrectParams, { tags: [ 'tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6' ] })

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a tag length too low', async function () {
      const fields = immutableAssign(baseCorrectParams, { tags: [ 'tag1', 't' ] })

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a tag length too big', async function () {
      const fields = immutableAssign(baseCorrectParams, { tags: [ 'tag1', 'my_super_tag_too_long_long_long_long_long_long' ] })

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect thumbnail file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        'thumbnailfile': join(__dirname, '..', 'fixtures', 'avatar.png')
      }

      await makeUploadRequest({
        url: server.url,
        method: 'PUT',
        path: path + videoId,
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail with a big thumbnail file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        'thumbnailfile': join(__dirname, '..', 'fixtures', 'avatar-big.png')
      }

      await makeUploadRequest({
        url: server.url,
        method: 'PUT',
        path: path + videoId,
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail with an incorrect preview file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        'previewfile': join(__dirname, '..', 'fixtures', 'avatar.png')
      }

      await makeUploadRequest({
        url: server.url,
        method: 'PUT',
        path: path + videoId,
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail with a big preview file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        'previewfile': join(__dirname, '..', 'fixtures', 'avatar-big.png')
      }

      await makeUploadRequest({
        url: server.url,
        method: 'PUT',
        path: path + videoId,
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail with a video of another user without the appropriate right', async function () {
      const fields = baseCorrectParams

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: userAccessToken, fields, statusCodeExpected: 403 })
    })

    it('Should fail with a video of another server')

    it('Should succeed with the correct parameters', async function () {
      const fields = baseCorrectParams

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields, statusCodeExpected: 204 })
    })
  })

  describe('When getting a video', function () {
    it('Should return the list of the videos with nothing', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path,
        statusCodeExpected: 200
      })

      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(3)
    })

    it('Should fail without a correct uuid', async function () {
      await getVideo(server.url, 'coucou', 400)
    })

    it('Should return 404 with an incorrect video', async function () {
      await getVideo(server.url, '4da6fde3-88f7-4d16-b119-108df5630b06', 404)
    })

    it('Should succeed with the correct parameters', async function () {
      await getVideo(server.url, videoId)
    })
  })

  describe('When rating a video', function () {
    let videoId

    before(async function () {
      const res = await getVideosList(server.url)
      videoId = res.body.data[0].id
    })

    it('Should fail without a valid uuid', async function () {
      const fields = {
        rating: 'like'
      }
      await makePutBodyRequest({ url: server.url, path: path + 'blabla/rate', token: server.accessToken, fields })
    })

    it('Should fail with an unknown id', async function () {
      const fields = {
        rating: 'like'
      }
      await makePutBodyRequest({
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df5630b06/rate',
        token: server.accessToken,
        fields,
        statusCodeExpected: 404
      })
    })

    it('Should fail with a wrong rating', async function () {
      const fields = {
        rating: 'likes'
      }
      await makePutBodyRequest({ url: server.url, path: path + videoId + '/rate', token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = {
        rating: 'like'
      }
      await makePutBodyRequest({
        url: server.url,
        path: path + videoId + '/rate',
        token: server.accessToken,
        fields,
        statusCodeExpected: 204
      })
    })
  })

  describe('When removing a video', function () {
    it('Should have 404 with nothing', async function () {
      await makeDeleteRequest({
        url: server.url,
        path,
        statusCodeExpected: 400
      })
    })

    it('Should fail without a correct uuid', async function () {
      await removeVideo(server.url, server.accessToken, 'hello', 400)
    })

    it('Should fail with a video which does not exist', async function () {
      await removeVideo(server.url, server.accessToken, '4da6fde3-88f7-4d16-b119-108df5630b06', 404)
    })

    it('Should fail with a video of another user without the appropriate right', async function () {
      await removeVideo(server.url, userAccessToken, videoId, 403)
    })

    it('Should fail with a video of another server')

    it('Should succeed with the correct parameters', async function () {
      await removeVideo(server.url, server.accessToken, videoId)
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
