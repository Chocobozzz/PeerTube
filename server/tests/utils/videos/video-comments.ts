import * as request from 'supertest'
import { makeDeleteRequest } from '../'

function getVideoCommentThreads (url: string, videoId: number | string, start: number, count: number, sort?: string, token?: string) {
  const path = '/api/v1/videos/' + videoId + '/comment-threads'

  const req = request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })

  if (sort) req.query({ sort })
  if (token) req.set('Authorization', 'Bearer ' + token)

  return req.set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

function getVideoThreadComments (url: string, videoId: number | string, threadId: number, token?: string) {
  const path = '/api/v1/videos/' + videoId + '/comment-threads/' + threadId

  const req = request(url)
    .get(path)
    .set('Accept', 'application/json')

  if (token) req.set('Authorization', 'Bearer ' + token)

  return req.expect(200)
            .expect('Content-Type', /json/)
}

function addVideoCommentThread (url: string, token: string, videoId: number | string, text: string, expectedStatus = 200) {
  const path = '/api/v1/videos/' + videoId + '/comment-threads'

  return request(url)
    .post(path)
    .send({ text })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
}

function addVideoCommentReply (
  url: string,
  token: string,
  videoId: number | string,
  inReplyToCommentId: number,
  text: string,
  expectedStatus = 200
) {
  const path = '/api/v1/videos/' + videoId + '/comments/' + inReplyToCommentId

  return request(url)
    .post(path)
    .send({ text })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
}

function deleteVideoComment (
  url: string,
  token: string,
  videoId: number | string,
  commentId: number,
  statusCodeExpected = 204
) {
  const path = '/api/v1/videos/' + videoId + '/comments/' + commentId

  return makeDeleteRequest({
    url,
    path,
    token,
    statusCodeExpected
  })
}

// ---------------------------------------------------------------------------

export {
  getVideoCommentThreads,
  getVideoThreadComments,
  addVideoCommentThread,
  addVideoCommentReply,
  deleteVideoComment
}
