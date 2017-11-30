import * as request from 'supertest'

function getJobsList (url: string, accessToken: string) {
  const path = '/api/v1/jobs'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(200)
          .expect('Content-Type', /json/)
}

function getJobsListPaginationAndSort (url: string, accessToken: string, start: number, count: number, sort: string) {
  const path = '/api/v1/jobs'

  return request(url)
          .get(path)
          .query({ start })
          .query({ count })
          .query({ sort })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(200)
          .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  getJobsList,
  getJobsListPaginationAndSort
}
