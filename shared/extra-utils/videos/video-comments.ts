/* eslint-disable @typescript-eslint/no-floating-promises */

import * as request from 'supertest'
import { makeDeleteRequest, makeGetRequest } from '../requests/requests'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function getAdminVideoComments (options: {
  url: string
  token: string
  start: number
  count: number
  sort?: string
  isLocal?: boolean
  search?: string
  searchAccount?: string
  searchVideo?: string
}) {
  const { url, token, start, count, sort, isLocal, search, searchAccount, searchVideo } = options
  const path = '/api/v1/videos/comments'

  const query = {
    start,
    count,
    sort: sort || '-createdAt'
  }

  if (isLocal !== undefined) Object.assign(query, { isLocal })
  if (search !== undefined) Object.assign(query, { search })
  if (searchAccount !== undefined) Object.assign(query, { searchAccount })
  if (searchVideo !== undefined) Object.assign(query, { searchVideo })

  return makeGetRequest({
    url,
    path,
    token,
    query,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getVideoCommentThreads (url: string, videoId: number | string, start: number, count: number, sort?: string, token?: string) {
  const path = '/api/v1/videos/' + videoId + '/comment-threads'

  const req = request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })

  if (sort) req.query({ sort })
  if (token) req.set('Authorization', 'Bearer ' + token)

  return req.set('Accept', 'application/json')
    .expect(HttpStatusCode.OK_200)
    .expect('Content-Type', /json/)
}

function getVideoThreadComments (url: string, videoId: number | string, threadId: number, token?: string) {
  const path = '/api/v1/videos/' + videoId + '/comment-threads/' + threadId

  const req = request(url)
    .get(path)
    .set('Accept', 'application/json')

  if (token) req.set('Authorization', 'Bearer ' + token)

  return req.expect(HttpStatusCode.OK_200)
            .expect('Content-Type', /json/)
}

function addVideoCommentThread (
  url: string,
  token: string,
  videoId: number | string,
  text: string,
  expectedStatus = HttpStatusCode.OK_200
) {
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
  expectedStatus = HttpStatusCode.OK_200
) {
  const path = '/api/v1/videos/' + videoId + '/comments/' + inReplyToCommentId

  return request(url)
    .post(path)
    .send({ text })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
}

async function findCommentId (url: string, videoId: number | string, text: string) {
  const res = await getVideoCommentThreads(url, videoId, 0, 25, '-createdAt')

  return res.body.data.find(c => c.text === text).id as number
}

function deleteVideoComment (
  url: string,
  token: string,
  videoId: number | string,
  commentId: number,
  statusCodeExpected = HttpStatusCode.NO_CONTENT_204
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
  getAdminVideoComments,
  getVideoThreadComments,
  addVideoCommentThread,
  addVideoCommentReply,
  findCommentId,
  deleteVideoComment
}
