/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { omit, randomInt } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  PeerTubeProblemDocument,
  VideoCommentPolicy,
  VideoCreateResult,
  VideoPrivacy
} from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  makeDeleteRequest,
  makeGetRequest,
  makePutBodyRequest,
  makeUploadRequest,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@tests/shared/checks.js'
import { checkUploadVideoParam } from '@tests/shared/videos.js'
import { expect } from 'chai'
import { join } from 'path'

describe('Test videos API validator', function () {
  const path = '/api/v1/videos/'
  let server: PeerTubeServer
  let userAccessToken = ''
  let accountName: string
  let channelId: number
  let channelName: string
  let video: VideoCreateResult
  let privateVideo: VideoCreateResult

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    userAccessToken = await server.users.generateUserAndToken('user1')

    {
      const body = await server.users.getMyInfo()
      channelId = body.videoChannels[0].id
      channelName = body.videoChannels[0].name
      accountName = body.account.name + '@' + body.account.host
    }

    {
      privateVideo = await server.videos.quickUpload({ name: 'private video', privacy: VideoPrivacy.PRIVATE })
    }
  })

  describe('When listing videos', function () {
    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path)
    })

    it('Should fail with a bad skipVideos query', async function () {
      await makeGetRequest({ url: server.url, path, expectedStatus: HttpStatusCode.OK_200, query: { skipCount: 'toto' } })
    })

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path, expectedStatus: HttpStatusCode.OK_200, query: { skipCount: false } })
    })
  })

  describe('When searching a video', function () {

    it('Should fail with nothing', async function () {
      await makeGetRequest({
        url: server.url,
        path: join(path, 'search'),
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
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

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path, expectedStatus: HttpStatusCode.OK_200 })
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

    it('Should fail with an invalid channel', async function () {
      await makeGetRequest({ url: server.url, token: server.accessToken, path, query: { channelId: 'toto' } })
    })

    it('Should fail with an unknown channel', async function () {
      await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path,
        query: { channelId: 89898 },
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, token: server.accessToken, path, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('When listing account videos', function () {
    let path: string

    before(async function () {
      path = '/api/v1/accounts/' + accountName + '/videos'
    })

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, server.accessToken)
    })

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('When listing video channel videos', function () {
    let path: string

    before(async function () {
      path = '/api/v1/video-channels/' + channelName + '/videos'
    })

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, server.accessToken)
    })

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('When adding a video', function () {
    const baseCorrectParams = {
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
      channelId: -1,
      originallyPublishedAt: new Date().toISOString()
    }

    const baseCorrectAttaches = {
      fixture: buildAbsoluteFixturePath('video_short.webm')
    }

    before(function () {
      // Put in before to have channelId
      baseCorrectParams.channelId = channelId
    })

    function runSuite (mode: 'legacy' | 'resumable') {

      const baseOptions = () => {
        return {
          server,
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400,
          mode
        }
      }

      it('Should fail with nothing', async function () {
        const fields = {}
        const attaches = {}
        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail without name', async function () {
        const fields = omit(baseCorrectParams, [ 'name' ])
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a long name', async function () {
        const fields = { ...baseCorrectParams, name: 'super'.repeat(65) }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a bad category', async function () {
        const fields = { ...baseCorrectParams, category: 125 }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a bad licence', async function () {
        const fields = { ...baseCorrectParams, licence: 125 }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a bad language', async function () {
        const fields = { ...baseCorrectParams, language: 'a'.repeat(15) }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with bad commentsPolicy', async function () {
        const fields = { ...baseCorrectParams, commentsPolicy: 42 as any }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a long description', async function () {
        const fields = { ...baseCorrectParams, description: 'super'.repeat(2500) }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a long support text', async function () {
        const fields = { ...baseCorrectParams, support: 'super'.repeat(201) }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail without a channel', async function () {
        const fields = omit(baseCorrectParams, [ 'channelId' ])
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a bad channel', async function () {
        const fields = { ...baseCorrectParams, channelId: 545454 }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with another user channel', async function () {
        const user = {
          username: 'fake' + randomInt(0, 1500),
          password: 'fake_password'
        }
        await server.users.create({ username: user.username, password: user.password })

        const accessTokenUser = await server.login.getAccessToken(user)
        const { videoChannels } = await server.users.getMyInfo({ token: accessTokenUser })
        const customChannelId = videoChannels[0].id

        const fields = { ...baseCorrectParams, channelId: customChannelId }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({
          ...baseOptions(),
          token: userAccessToken,
          attributes: { ...fields, ...attaches }
        })
      })

      it('Should fail with too many tags', async function () {
        const fields = { ...baseCorrectParams, tags: [ 'tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6' ] }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a tag length too low', async function () {
        const fields = { ...baseCorrectParams, tags: [ 'tag1', 't' ] }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a tag length too big', async function () {
        const fields = { ...baseCorrectParams, tags: [ 'tag1', 'my_super_tag_too_long_long_long_long_long_long' ] }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a bad schedule update (miss updateAt)', async function () {
        const fields = { ...baseCorrectParams, scheduleUpdate: { privacy: VideoPrivacy.PUBLIC } as any }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a bad schedule update (wrong updateAt)', async function () {
        const fields = {
          ...baseCorrectParams,

          scheduleUpdate: {
            privacy: VideoPrivacy.PUBLIC,
            updateAt: 'toto'
          }
        }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a bad originally published at attribute', async function () {
        const fields = { ...baseCorrectParams, originallyPublishedAt: 'toto' }
        const attaches = baseCorrectAttaches

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail without an input file', async function () {
        const fields = baseCorrectParams
        const attaches = {}
        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with an incorrect input file', async function () {
        const fields = baseCorrectParams
        let attaches = { fixture: buildAbsoluteFixturePath('video_short_fake.webm') }

        await checkUploadVideoParam({
          ...baseOptions(),
          attributes: { ...fields, ...attaches },
          // 200 for the init request, 422 when the file has finished being uploaded
          expectedStatus: undefined,
          completedExpectedStatus: HttpStatusCode.UNPROCESSABLE_ENTITY_422
        })

        attaches = { fixture: buildAbsoluteFixturePath('video_short.mkv') }
        await checkUploadVideoParam({
          ...baseOptions(),
          attributes: { ...fields, ...attaches },
          expectedStatus: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415
        })
      })

      it('Should fail with an incorrect thumbnail file', async function () {
        const fields = baseCorrectParams
        const attaches = {
          thumbnailfile: buildAbsoluteFixturePath('video_short.mp4'),
          fixture: buildAbsoluteFixturePath('video_short.mp4')
        }

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a big thumbnail file', async function () {
        const fields = baseCorrectParams
        const attaches = {
          thumbnailfile: buildAbsoluteFixturePath('custom-preview-big.png'),
          fixture: buildAbsoluteFixturePath('video_short.mp4')
        }

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with an incorrect preview file', async function () {
        const fields = baseCorrectParams
        const attaches = {
          previewfile: buildAbsoluteFixturePath('video_short.mp4'),
          fixture: buildAbsoluteFixturePath('video_short.mp4')
        }

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should fail with a big preview file', async function () {
        const fields = baseCorrectParams
        const attaches = {
          previewfile: buildAbsoluteFixturePath('custom-preview-big.png'),
          fixture: buildAbsoluteFixturePath('video_short.mp4')
        }

        await checkUploadVideoParam({ ...baseOptions(), attributes: { ...fields, ...attaches } })
      })

      it('Should report the appropriate error', async function () {
        const fields = { ...baseCorrectParams, language: 'a'.repeat(15) }
        const attaches = baseCorrectAttaches

        const attributes = { ...fields, ...attaches }
        const body = await checkUploadVideoParam({ ...baseOptions(), attributes })

        const error = body as unknown as PeerTubeProblemDocument

        if (mode === 'legacy') {
          expect(error.docs).to.equal('https://docs.joinpeertube.org/api-rest-reference.html#operation/uploadLegacy')
        } else {
          expect(error.docs).to.equal('https://docs.joinpeertube.org/api-rest-reference.html#operation/uploadResumableInit')
        }

        expect(error.type).to.equal('about:blank')
        expect(error.title).to.equal('Bad Request')

        expect(error.detail).to.equal('Incorrect request parameters: language')
        expect(error.error).to.equal('Incorrect request parameters: language')

        expect(error.status).to.equal(HttpStatusCode.BAD_REQUEST_400)
        expect(error['invalid-params'].language).to.exist
      })

      it('Should succeed with the correct parameters', async function () {
        this.timeout(30000)

        const fields = baseCorrectParams

        {
          const attaches = baseCorrectAttaches
          await checkUploadVideoParam({
            ...baseOptions(),
            attributes: { ...fields, ...attaches },
            expectedStatus: HttpStatusCode.OK_200
          })
        }

        {
          const attaches = {
            ...baseCorrectAttaches,

            videofile: buildAbsoluteFixturePath('video_short.mp4')
          }

          await checkUploadVideoParam({
            ...baseOptions(),
            attributes: { ...fields, ...attaches },
            expectedStatus: HttpStatusCode.OK_200
          })
        }

        {
          const attaches = {
            ...baseCorrectAttaches,

            videofile: buildAbsoluteFixturePath('video_short.ogv')
          }

          await checkUploadVideoParam({
            ...baseOptions(),
            attributes: { ...fields, ...attaches },
            expectedStatus: HttpStatusCode.OK_200
          })
        }
      })
    }

    describe('Resumable upload', function () {
      runSuite('resumable')
    })

    describe('Legacy upload', function () {
      runSuite('legacy')
    })
  })

  describe('When updating a video', function () {
    const baseCorrectParams = {
      name: 'my super name',
      category: 5,
      licence: 2,
      language: 'pt',
      nsfw: false,
      commentsPolicy: VideoCommentPolicy.DISABLED,
      downloadEnabled: false,
      description: 'my super description',
      privacy: VideoPrivacy.PUBLIC,
      tags: [ 'tag1', 'tag2' ]
    }

    before(async function () {
      const { data } = await server.videos.list()
      video = data[0]
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
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a long name', async function () {
      const fields = { ...baseCorrectParams, name: 'super'.repeat(65) }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with a bad category', async function () {
      const fields = { ...baseCorrectParams, category: 125 }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with a bad licence', async function () {
      const fields = { ...baseCorrectParams, licence: 125 }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with a bad language', async function () {
      const fields = { ...baseCorrectParams, language: 'a'.repeat(15) }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = { ...baseCorrectParams, description: 'super'.repeat(2500) }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with a long support text', async function () {
      const fields = { ...baseCorrectParams, support: 'super'.repeat(201) }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with a bad channel', async function () {
      const fields = { ...baseCorrectParams, channelId: 545454 }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with too many tags', async function () {
      const fields = { ...baseCorrectParams, tags: [ 'tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6' ] }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with a tag length too low', async function () {
      const fields = { ...baseCorrectParams, tags: [ 'tag1', 't' ] }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with a tag length too big', async function () {
      const fields = { ...baseCorrectParams, tags: [ 'tag1', 'my_super_tag_too_long_long_long_long_long_long' ] }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with a bad schedule update (miss updateAt)', async function () {
      const fields = { ...baseCorrectParams, scheduleUpdate: { privacy: VideoPrivacy.PUBLIC } }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with a bad schedule update (wrong updateAt)', async function () {
      const fields = { ...baseCorrectParams, scheduleUpdate: { updateAt: 'toto', privacy: VideoPrivacy.PUBLIC } }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with a bad originally published at param', async function () {
      const fields = { ...baseCorrectParams, originallyPublishedAt: 'toto' }

      await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect thumbnail file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        thumbnailfile: buildAbsoluteFixturePath('video_short.mp4')
      }

      await makeUploadRequest({
        url: server.url,
        method: 'PUT',
        path: path + video.shortUUID,
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail with a big thumbnail file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        thumbnailfile: buildAbsoluteFixturePath('custom-preview-big.png')
      }

      await makeUploadRequest({
        url: server.url,
        method: 'PUT',
        path: path + video.shortUUID,
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail with an incorrect preview file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        previewfile: buildAbsoluteFixturePath('video_short.mp4')
      }

      await makeUploadRequest({
        url: server.url,
        method: 'PUT',
        path: path + video.shortUUID,
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail with a big preview file', async function () {
      const fields = baseCorrectParams
      const attaches = {
        previewfile: buildAbsoluteFixturePath('custom-preview-big.png')
      }

      await makeUploadRequest({
        url: server.url,
        method: 'PUT',
        path: path + video.shortUUID,
        token: server.accessToken,
        fields,
        attaches
      })
    })

    it('Should fail with a video of another user without the appropriate right', async function () {
      const fields = baseCorrectParams

      await makePutBodyRequest({
        url: server.url,
        path: path + video.shortUUID,
        token: userAccessToken,
        fields,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with a video of another server')

    it('Shoud report the appropriate error', async function () {
      const fields = { ...baseCorrectParams, licence: 125 }

      const res = await makePutBodyRequest({ url: server.url, path: path + video.shortUUID, token: server.accessToken, fields })
      const error = res.body as PeerTubeProblemDocument

      expect(error.docs).to.equal('https://docs.joinpeertube.org/api-rest-reference.html#operation/putVideo')

      expect(error.type).to.equal('about:blank')
      expect(error.title).to.equal('Bad Request')

      expect(error.detail).to.equal('Incorrect request parameters: licence')
      expect(error.error).to.equal('Incorrect request parameters: licence')

      expect(error.status).to.equal(HttpStatusCode.BAD_REQUEST_400)
      expect(error['invalid-params'].licence).to.exist
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = baseCorrectParams

      await makePutBodyRequest({
        url: server.url,
        path: path + video.shortUUID,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When getting a video', function () {
    it('Should return the list of the videos with nothing', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path,
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(6)
    })

    it('Should fail without a correct uuid', async function () {
      await server.videos.get({ id: 'coucou', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should return 404 with an incorrect video', async function () {
      await server.videos.get({ id: '4da6fde3-88f7-4d16-b119-108df5630b06', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Shoud report the appropriate error', async function () {
      const body = await server.videos.get({ id: 'hi', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      const error = body as unknown as PeerTubeProblemDocument

      expect(error.docs).to.equal('https://docs.joinpeertube.org/api-rest-reference.html#operation/getVideo')

      expect(error.type).to.equal('about:blank')
      expect(error.title).to.equal('Bad Request')

      expect(error.detail).to.equal('Incorrect request parameters: id')
      expect(error.error).to.equal('Incorrect request parameters: id')

      expect(error.status).to.equal(HttpStatusCode.BAD_REQUEST_400)
      expect(error['invalid-params'].id).to.exist
    })

    it('Should succeed with the correct parameters', async function () {
      await server.videos.get({ id: video.shortUUID })
    })
  })

  describe('When rating a video', function () {
    let videoId: number

    before(async function () {
      const { data } = await server.videos.list()
      videoId = data[0].id
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
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a wrong rating', async function () {
      const fields = {
        rating: 'likes'
      }
      await makePutBodyRequest({ url: server.url, path: path + videoId + '/rate', token: server.accessToken, fields })
    })

    it('Should fail with a private video of another user', async function () {
      const fields = {
        rating: 'like'
      }
      await makePutBodyRequest({
        url: server.url,
        path: path + privateVideo.uuid + '/rate',
        token: userAccessToken,
        fields,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
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
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When removing a video', function () {
    it('Should have 404 with nothing', async function () {
      await makeDeleteRequest({
        url: server.url,
        path,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail without a correct uuid', async function () {
      await server.videos.remove({ id: 'hello', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with a video which does not exist', async function () {
      await server.videos.remove({ id: '4da6fde3-88f7-4d16-b119-108df5630b06', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a video of another user without the appropriate right', async function () {
      await server.videos.remove({ token: userAccessToken, id: video.uuid, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with a video of another server')

    it('Shoud report the appropriate error', async function () {
      const body = await server.videos.remove({ id: 'hello', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      const error = body as PeerTubeProblemDocument

      expect(error.docs).to.equal('https://docs.joinpeertube.org/api-rest-reference.html#operation/delVideo')

      expect(error.type).to.equal('about:blank')
      expect(error.title).to.equal('Bad Request')

      expect(error.detail).to.equal('Incorrect request parameters: id')
      expect(error.error).to.equal('Incorrect request parameters: id')

      expect(error.status).to.equal(HttpStatusCode.BAD_REQUEST_400)
      expect(error['invalid-params'].id).to.exist
    })

    it('Should succeed with the correct parameters', async function () {
      await server.videos.remove({ id: video.uuid })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
