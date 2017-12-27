/* tslint:disable:no-unused-expression */

import 'mocha'
import * as request from 'supertest'
import {
  createUser, flushTests, getUserAccessToken, killallServers, makePostBodyRequest, runServer, ServerInfo, setAccessTokensToServers,
  uploadVideo
} from '../../utils'
import { addVideoCommentThread } from '../../utils/video-comments'

describe('Test video comments API validator', function () {
  let pathThread: string
  let pathComment: string
  let server: ServerInfo
  let accessTokenUser: string
  let videoUUID: string
  let commentId: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(20000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    {
      const user = {
        username: 'fake',
        password: 'fake_password'
      }
      await createUser(server.url, server.accessToken, user.username, user.password)

      accessTokenUser = await getUserAccessToken(server, user)
    }

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
  })

  describe('When listing video comment threads', function () {
    it('Should fail with a bad start pagination', async function () {
      await request(server.url)
              .get(pathThread)
              .query({ start: 'hello' })
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should fail with a bad count pagination', async function () {
      await request(server.url)
              .get(pathThread)
              .query({ count: 'hello' })
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should fail with an incorrect sort', async function () {
      await request(server.url)
              .get(pathThread)
              .query({ sort: 'hello' })
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should fail with an incorrect video', async function () {
      await request(server.url)
        .get('/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comment-threads')
        .set('Accept', 'application/json')
        .expect(404)
    })
  })

  describe('When listing comments of a thread', function () {
    it('Should fail with an incorrect video', async function () {
      await request(server.url)
        .get('/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comment-threads/' + commentId)
        .set('Accept', 'application/json')
        .expect(404)
    })

    it('Should fail with an incorrect thread id', async function () {
      await request(server.url)
        .get('/api/v1/videos/' + videoUUID + '/comment-threads/156')
        .set('Accept', 'application/json')
        .expect(404)
    })

    it('Should success with the correct params', async function () {
      await request(server.url)
        .get('/api/v1/videos/' + videoUUID + '/comment-threads/' + commentId)
        .set('Accept', 'application/json')
        .expect(200)
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
        text: 'h'.repeat(3001)
      }
      await makePostBodyRequest({ url: server.url, path: pathThread, token: server.accessToken, fields })
    })

    it('Should fail with a long comment', async function () {
      const fields = {
        text: 'h'.repeat(3001)
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
        text: 'h'.repeat(3001)
      }
      await makePostBodyRequest({ url: server.url, path: pathComment, token: server.accessToken, fields })
    })

    it('Should fail with a long comment', async function () {
      const fields = {
        text: 'h'.repeat(3001)
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

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
