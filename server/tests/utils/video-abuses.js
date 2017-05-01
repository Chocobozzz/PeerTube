'use strict'

const request = require('supertest')

const videosAbuseUtils = {
  getVideoAbusesList,
  getVideoAbusesListPagination,
  getVideoAbusesListSort,
  reportVideoAbuse
}

// ---------------------- Export functions --------------------

function reportVideoAbuse (url, token, videoId, reason, specialStatus, end) {
  if (!end) {
    end = specialStatus
    specialStatus = 204
  }

  const path = '/api/v1/videos/' + videoId + '/abuse'

  request(url)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .send({ reason })
    .expect(specialStatus)
    .end(end)
}

function getVideoAbusesList (url, token, end) {
  const path = '/api/v1/videos/abuse'

  request(url)
    .get(path)
    .query({ sort: 'createdAt' })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getVideoAbusesListPagination (url, token, start, count, end) {
  const path = '/api/v1/videos/abuse'

  request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getVideoAbusesListSort (url, token, sort, end) {
  const path = '/api/v1/videos/abuse'

  request(url)
    .get(path)
    .query({ sort: sort })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

// ---------------------------------------------------------------------------

module.exports = videosAbuseUtils
