'use strict'

const request = require('supertest')

const usersUtils = {
  createUser,
  getUserInformation,
  getUserVideoRating,
  getUsersList,
  getUsersListPaginationAndSort,
  removeUser,
  updateUser
}

// ---------------------- Export functions --------------------

function createUser (url, accessToken, username, password, specialStatus, end) {
  if (!end) {
    end = specialStatus
    specialStatus = 204
  }

  const path = '/api/v1/users'
  const body = {
    username,
    password,
    email: username + '@example.com'
  }

  request(url)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .send(body)
    .expect(specialStatus)
    .end(end)
}

function getUserInformation (url, accessToken, end) {
  const path = '/api/v1/users/me'

  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getUserVideoRating (url, accessToken, videoId, end) {
  const path = '/api/v1/users/me/videos/' + videoId + '/rating'

  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getUsersList (url, end) {
  const path = '/api/v1/users'

  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getUsersListPaginationAndSort (url, start, count, sort, end) {
  const path = '/api/v1/users'

  request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })
    .query({ sort: sort })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function removeUser (url, userId, accessToken, expectedStatus, end) {
  if (!end) {
    end = expectedStatus
    expectedStatus = 204
  }

  const path = '/api/v1/users'

  request(url)
    .delete(path + '/' + userId)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(expectedStatus)
    .end(end)
}

function updateUser (url, userId, accessToken, newPassword, displayNSFW, end) {
  const path = '/api/v1/users/' + userId

  const toSend = {}
  if (newPassword !== undefined && newPassword !== null) toSend.password = newPassword
  if (displayNSFW !== undefined && displayNSFW !== null) toSend.displayNSFW = displayNSFW

  request(url)
    .put(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .send(toSend)
    .expect(204)
    .end(end)
}

// ---------------------------------------------------------------------------

module.exports = usersUtils
