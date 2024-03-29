/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoCommentPolicy, VideoCreateResult, VideoPrivacy } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@tests/shared/checks.js'
import { expect } from 'chai'

describe('Test video comments API validator', function () {
  let pathThread: string
  let pathComment: string

  let server: PeerTubeServer

  let video: VideoCreateResult

  let userAccessToken: string
  let userAccessToken2: string

  let commentId: number
  let privateCommentId: number
  let privateVideo: VideoCreateResult

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    {
      video = await server.videos.upload({ attributes: {} })
      pathThread = '/api/v1/videos/' + video.uuid + '/comment-threads'
    }

    {
      privateVideo = await server.videos.upload({ attributes: { privacy: VideoPrivacy.PRIVATE } })
    }

    {
      const created = await server.comments.createThread({ videoId: video.uuid, text: 'coucou' })
      commentId = created.id
      pathComment = '/api/v1/videos/' + video.uuid + '/comments/' + commentId
    }

    {
      const created = await server.comments.createThread({ videoId: privateVideo.uuid, text: 'coucou' })
      privateCommentId = created.id
    }

    {
      const user = { username: 'user1', password: 'my super password' }
      await server.users.create({ username: user.username, password: user.password })
      userAccessToken = await server.login.getAccessToken(user)
    }

    {
      const user = { username: 'user2', password: 'my super password' }
      await server.users.create({ username: user.username, password: user.password })
      userAccessToken2 = await server.login.getAccessToken(user)
    }
  })

  describe('When listing video comment threads', function () {
    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, pathThread, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, pathThread, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, pathThread, server.accessToken)
    })

    it('Should fail with an incorrect video', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comment-threads',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a private video without token', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/api/v1/videos/' + privateVideo.shortUUID + '/comment-threads',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with another user token', async function () {
      await makeGetRequest({
        url: server.url,
        token: userAccessToken,
        path: '/api/v1/videos/' + privateVideo.shortUUID + '/comment-threads',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path: '/api/v1/videos/' + privateVideo.shortUUID + '/comment-threads',
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When listing comments of a thread', function () {
    it('Should fail with an incorrect video', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comment-threads/' + commentId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with an incorrect thread id', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/api/v1/videos/' + video.shortUUID + '/comment-threads/156',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a private video without token', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/api/v1/videos/' + privateVideo.shortUUID + '/comment-threads/' + privateCommentId,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with another user token', async function () {
      await makeGetRequest({
        url: server.url,
        token: userAccessToken,
        path: '/api/v1/videos/' + privateVideo.shortUUID + '/comment-threads/' + privateCommentId,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should success with the correct params', async function () {
      await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path: '/api/v1/videos/' + privateVideo.shortUUID + '/comment-threads/' + privateCommentId,
        expectedStatus: HttpStatusCode.OK_200
      })

      await makeGetRequest({
        url: server.url,
        path: '/api/v1/videos/' + video.shortUUID + '/comment-threads/' + commentId,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When adding a video thread', function () {

    it('Should fail with a non authenticated user', async function () {
      const fields = {
        text: 'text'
      }
      await makePostBodyRequest({
        url: server.url,
        path: pathThread,
        token: 'none',
        fields,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path: pathThread, token: server.accessToken, fields })
    })

    it('Should fail with a short comment', async function () {
      const fields = {
        text: ''
      }
      await makePostBodyRequest({ url: server.url, path: pathThread, token: server.accessToken, fields })
    })

    it('Should fail with a long comment', async function () {
      const fields = {
        text: 'h'.repeat(10001)
      }
      await makePostBodyRequest({ url: server.url, path: pathThread, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect video', async function () {
      const path = '/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comment-threads'
      const fields = { text: 'super comment' }

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a private video of another user', async function () {
      const fields = { text: 'super comment' }

      await makePostBodyRequest({
        url: server.url,
        path: '/api/v1/videos/' + privateVideo.shortUUID + '/comment-threads',
        token: userAccessToken,
        fields,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = { text: 'super comment' }

      await makePostBodyRequest({
        url: server.url,
        path: pathThread,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When adding a comment to a thread', function () {

    it('Should fail with a non authenticated user', async function () {
      const fields = {
        text: 'text'
      }
      await makePostBodyRequest({
        url: server.url,
        path: pathComment,
        token: 'none',
        fields,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path: pathComment, token: server.accessToken, fields })
    })

    it('Should fail with a short comment', async function () {
      const fields = {
        text: ''
      }
      await makePostBodyRequest({ url: server.url, path: pathComment, token: server.accessToken, fields })
    })

    it('Should fail with a long comment', async function () {
      const fields = {
        text: 'h'.repeat(10001)
      }
      await makePostBodyRequest({ url: server.url, path: pathComment, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect video', async function () {
      const path = '/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comments/' + commentId
      const fields = {
        text: 'super comment'
      }
      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a private video of another user', async function () {
      const fields = { text: 'super comment' }

      await makePostBodyRequest({
        url: server.url,
        path: '/api/v1/videos/' + privateVideo.uuid + '/comments/' + privateCommentId,
        token: userAccessToken,
        fields,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an incorrect comment', async function () {
      const path = '/api/v1/videos/' + video.uuid + '/comments/124'
      const fields = {
        text: 'super comment'
      }
      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = {
        text: 'super comment'
      }
      await makePostBodyRequest({
        url: server.url,
        path: pathComment,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When removing video comments', function () {
    it('Should fail with a non authenticated user', async function () {
      await makeDeleteRequest({ url: server.url, path: pathComment, token: 'none', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with another user', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: pathComment,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an incorrect video', async function () {
      const path = '/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comments/' + commentId
      await makeDeleteRequest({ url: server.url, path, token: server.accessToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with an incorrect comment', async function () {
      const path = '/api/v1/videos/' + video.uuid + '/comments/124'
      await makeDeleteRequest({ url: server.url, path, token: server.accessToken, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the same user', async function () {
      let commentToDelete: number

      {
        const created = await server.comments.createThread({ videoId: video.uuid, token: userAccessToken, text: 'hello' })
        commentToDelete = created.id
      }

      const path = '/api/v1/videos/' + video.uuid + '/comments/' + commentToDelete

      await makeDeleteRequest({ url: server.url, path, token: userAccessToken2, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await makeDeleteRequest({ url: server.url, path, token: userAccessToken, expectedStatus: HttpStatusCode.NO_CONTENT_204 })
    })

    it('Should succeed with the owner of the video', async function () {
      let commentToDelete: number
      let anotherVideoUUID: string

      {
        const { uuid } = await server.videos.upload({ token: userAccessToken, attributes: { name: 'video' } })
        anotherVideoUUID = uuid
      }

      {
        const created = await server.comments.createThread({ videoId: anotherVideoUUID, text: 'hello' })
        commentToDelete = created.id
      }

      const path = '/api/v1/videos/' + anotherVideoUUID + '/comments/' + commentToDelete

      await makeDeleteRequest({ url: server.url, path, token: userAccessToken2, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await makeDeleteRequest({ url: server.url, path, token: userAccessToken, expectedStatus: HttpStatusCode.NO_CONTENT_204 })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: pathComment,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When a video has comments disabled', function () {

    before(async function () {
      video = await server.videos.upload({ attributes: { commentsPolicy: VideoCommentPolicy.DISABLED } })
      pathThread = `/api/v1/videos/${video.uuid}/comment-threads`
    })

    it('Should return an empty thread list', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: pathThread,
        expectedStatus: HttpStatusCode.OK_200
      })
      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    })

    it('Should return an thread comments list')

    it('Should return conflict on thread add', async function () {
      const fields = {
        text: 'super comment'
      }
      await makePostBodyRequest({
        url: server.url,
        path: pathThread,
        token: server.accessToken,
        fields,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should return conflict on comment thread add')
  })

  describe('When listing admin/user comments', function () {
    const paths = [ '/api/v1/videos/comments', '/api/v1/users/me/videos/comments' ]

    it('Should fail with a bad start/count pagination of invalid sort', async function () {
      for (const path of paths) {
        await checkBadStartPagination(server.url, path, server.accessToken)
        await checkBadCountPagination(server.url, path, server.accessToken)
        await checkBadSortPagination(server.url, path, server.accessToken)
      }
    })

    it('Should fail with a non authenticated user', async function () {
      await server.comments.listForAdmin({ token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      await server.comments.listCommentsOnMyVideos({ token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail to list admin comments with a non admin user', async function () {
      await server.comments.listForAdmin({ token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with an invalid video', async function () {
      await server.comments.listForAdmin({ videoId: 'toto', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await server.comments.listCommentsOnMyVideos({ videoId: 'toto', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      await server.comments.listForAdmin({ videoId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await server.comments.listCommentsOnMyVideos({ videoId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with an invalid channel', async function () {
      await server.comments.listForAdmin({ videoChannelId: 'toto', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await server.comments.listCommentsOnMyVideos({ videoChannelId: 'toto', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      await server.comments.listForAdmin({ videoChannelId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await server.comments.listCommentsOnMyVideos({ videoChannelId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail to list comments on my videos with non owned video or channel', async function () {
      await server.comments.listCommentsOnMyVideos({
        videoId: video.uuid,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })

      await server.comments.listCommentsOnMyVideos({
        videoChannelId: server.store.channel.id,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with the correct params', async function () {
      const base = {
        search: 'toto',
        searchAccount: 'toto',
        searchVideo: 'toto',
        videoId: video.uuid,
        videoChannelId: server.store.channel.id,
        autoTagOneOf: [ 'external-link' ]
      }

      await server.comments.listForAdmin({ ...base, isLocal: false })
      await server.comments.listCommentsOnMyVideos(base)
    })
  })

  describe('When approving a comment', function () {
    let videoId: string
    let commentId: number
    let deletedCommentId: number

    before(async function () {
      {
        const res = await server.videos.upload({
          attributes: {
            name: 'review policy',
            commentsPolicy: VideoCommentPolicy.REQUIRES_APPROVAL
          }
        })

        videoId = res.uuid
      }

      {
        const res = await server.comments.createThread({ text: 'thread', videoId, token: userAccessToken })
        commentId = res.id
      }

      {
        const res = await server.comments.createThread({ text: 'deleted', videoId, token: userAccessToken })
        deletedCommentId = res.id

        await server.comments.delete({ commentId: deletedCommentId, videoId })
      }
    })

    it('Should fail with a non authenticated user', async function () {
      await server.comments.approve({ token: 'none', commentId, videoId, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with another user', async function () {
      await server.comments.approve({ token: userAccessToken2, commentId, videoId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with an incorrect video', async function () {
      await server.comments.approve({ token: userAccessToken2, commentId, videoId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with an incorrect comment', async function () {
      await server.comments.approve({ token: userAccessToken2, commentId: 42, videoId, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a deleted comment', async function () {
      await server.comments.approve({
        token: userAccessToken,
        commentId: deletedCommentId,
        videoId,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should succeed with the correct params', async function () {
      await server.comments.approve({ token: userAccessToken, commentId, videoId })
    })

    it('Should fail with an already held for review comment', async function () {
      await server.comments.approve({ token: userAccessToken, commentId, videoId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
