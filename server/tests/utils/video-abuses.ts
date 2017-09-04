import * as request from 'supertest'

function reportVideoAbuse (url: string, token: string, videoId: number, reason: string, specialStatus = 204) {
  const path = '/api/v1/videos/' + videoId + '/abuse'

  return request(url)
          .post(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .send({ reason })
          .expect(specialStatus)
}

function getVideoAbusesList (url: string, token: string) {
  const path = '/api/v1/videos/abuse'

  return request(url)
          .get(path)
          .query({ sort: 'createdAt' })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
          .expect('Content-Type', /json/)
}

function getVideoAbusesListPagination (url: string, token: string, start: number, count: number) {
  const path = '/api/v1/videos/abuse'

  return request(url)
          .get(path)
          .query({ start: start })
          .query({ count: count })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
          .expect('Content-Type', /json/)
}

function getVideoAbusesListSort (url: string, token: string, sort: string) {
  const path = '/api/v1/videos/abuse'

  return request(url)
          .get(path)
          .query({ sort: sort })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
          .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  reportVideoAbuse,
  getVideoAbusesList,
  getVideoAbusesListPagination,
  getVideoAbusesListSort
}
