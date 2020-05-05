/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  cleanupTests,
  createUser,
  flushAndRunServer,
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  userLogin
} from '../../../../shared/extra-utils'
import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination
} from '../../../../shared/extra-utils/requests/check-api-params'
import { addVideoCommentThread } from '../../../../shared/extra-utils/videos/video-comments'

const expect = chai.expect

describe('Test video comments API validator', function () {
  let pathThread: string
  let pathComment: string
  let server: ServerInfo
  let videoUUID: string
  let userAccessToken: string
  let userAccessToken2: string
  let commentId: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    {
      const res = await uploadVideo(server.url, server.accessToken, {})
      videoUUID = res.body.video.uuid
      pathThread = '/api/v1/videos/' + videoUUID + '/comment-threads'
    }

    {
      const res = await addVideoCommentThread(server.url, server.accessToken, videoUUID, 'coucou')
      commentId = res.body.comment.id
      pathComment = '/api/v1/videos/' + videoUUID + '/comments/' + commentId
    }

    {
      const user = { username: 'user1', password: 'my super password' }
      await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })
      userAccessToken = await userLogin(server, user)
    }

    {
      const user = { username: 'user2', password: 'my super password' }
      await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })
      userAccessToken2 = await userLogin(server, user)
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
        statusCodeExpected: 404
      })
    })
  })

  describe('When listing comments of a thread', function () {
    it('Should fail with an incorrect video', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comment-threads/' + commentId,
        statusCodeExpected: 404
      })
    })

    it('Should fail with an incorrect thread id', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/api/v1/videos/' + videoUUID + '/comment-threads/156',
        statusCodeExpected: 404
      })
    })

    it('Should success with the correct params', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/api/v1/videos/' + videoUUID + '/comment-threads/' + commentId,
        statusCodeExpected: 200
      })
    })
  })

  describe('When adding a video thread', function () {

    it('Should fail with a non authenticated user', async function () {
      const fields = {
        text: 'text'
      }
      await makePostBodyRequest({ url: server.url, path: pathThread, token: 'none', fields, statusCodeExpected: 401 })
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
      const fields = {
        text: 'super comment'
      }
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 404 })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = {
        text: 'super comment'
      }
      await makePostBodyRequest({ url: server.url, path: pathThread, token: server.accessToken, fields, statusCodeExpected: 200 })
    })
  })

  describe('When adding a comment to a thread', function () {
    it('Should fail with a non authenticated user', async function () {
      const fields = {
        text: 'text'
      }
      await makePostBodyRequest({ url: server.url, path: pathComment, token: 'none', fields, statusCodeExpected: 401 })
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
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 404 })
    })

    it('Should fail with an incorrect comment', async function () {
      const path = '/api/v1/videos/' + videoUUID + '/comments/124'
      const fields = {
        text: 'super comment'
      }
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 404 })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = {
        text: 'super comment'
      }
      await makePostBodyRequest({ url: server.url, path: pathComment, token: server.accessToken, fields, statusCodeExpected: 200 })
    })
  })

  describe('When removing video comments', function () {
    it('Should fail with a non authenticated user', async function () {
      await makeDeleteRequest({ url: server.url, path: pathComment, token: 'none', statusCodeExpected: 401 })
    })

    it('Should fail with another user', async function () {
      await makeDeleteRequest({ url: server.url, path: pathComment, token: userAccessToken, statusCodeExpected: 403 })
    })

    it('Should fail with an incorrect video', async function () {
      const path = '/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comments/' + commentId
      await makeDeleteRequest({ url: server.url, path, token: server.accessToken, statusCodeExpected: 404 })
    })

    it('Should fail with an incorrect comment', async function () {
      const path = '/api/v1/videos/' + videoUUID + '/comments/124'
      await makeDeleteRequest({ url: server.url, path, token: server.accessToken, statusCodeExpected: 404 })
    })

    it('Should succeed with the same user', async function () {
      let commentToDelete: number

      {
        const res = await addVideoCommentThread(server.url, userAccessToken, videoUUID, 'hello')
        commentToDelete = res.body.comment.id
      }

      const path = '/api/v1/videos/' + videoUUID + '/comments/' + commentToDelete

      await makeDeleteRequest({ url: server.url, path, token: userAccessToken2, statusCodeExpected: 403 })
      await makeDeleteRequest({ url: server.url, path, token: userAccessToken, statusCodeExpected: 204 })
    })

    it('Should succeed with the owner of the video', async function () {
      let commentToDelete: number
      let anotherVideoUUID: string

      {
        const res = await uploadVideo(server.url, userAccessToken, { name: 'video' })
        anotherVideoUUID = res.body.video.uuid
      }

      {
        const res = await addVideoCommentThread(server.url, server.accessToken, anotherVideoUUID, 'hello')
        commentToDelete = res.body.comment.id
      }

      const path = '/api/v1/videos/' + anotherVideoUUID + '/comments/' + commentToDelete

      await makeDeleteRequest({ url: server.url, path, token: userAccessToken2, statusCodeExpected: 403 })
      await makeDeleteRequest({ url: server.url, path, token: userAccessToken, statusCodeExpected: 204 })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeDeleteRequest({ url: server.url, path: pathComment, token: server.accessToken, statusCodeExpected: 204 })
    })
  })

  describe('When a video has comments disabled', function () {
    before(async function () {
      const res = await uploadVideo(server.url, server.accessToken, { commentsEnabled: false })
      videoUUID = res.body.video.uuid
      pathThread = '/api/v1/videos/' + videoUUID + '/comment-threads'
    })

    it('Should return an empty thread list', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: pathThread,
        statusCodeExpected: 200
      })
      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    })

    it('Should return an thread comments list')

    it('Should return conflict on thread add', async function () {
      const fields = {
        text: 'super comment'
      }
      await makePostBodyRequest({ url: server.url, path: pathThread, token: server.accessToken, fields, statusCodeExpected: 409 })
    })

    it('Should return conflict on comment thread add')
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
