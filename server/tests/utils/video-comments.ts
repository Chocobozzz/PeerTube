import * as request from 'supertest'

function getVideoCommentThreads (url: string, videoId: number, start: number, count: number, sort?: string) {
  const path = '/api/v1/videos/' + videoId + '/comment-threads'

  const req = request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })

  if (sort) req.query({ sort })

  return req.set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

function getVideoThreadComments (url: string, videoId: number, threadId: number) {
  const path = '/api/v1/videos/' + videoId + '/comment-threads/' + threadId

  return request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

function addVideoCommentThread (url: string, token: string, videoId: number, text: string, expectedStatus = 200) {
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
  videoId: number,
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

// ---------------------------------------------------------------------------

export {
  getVideoCommentThreads,
  getVideoThreadComments,
  addVideoCommentThread,
  addVideoCommentReply
}
