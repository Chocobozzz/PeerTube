'use strict'

const request = require('supertest')

const usersUtils = {
  createUser: createUser,
  getUserInformation: getUserInformation,
  getUsersList: getUsersList,
  removeUser: removeUser,
  updateUser: updateUser
}

// ---------------------- Export functions --------------------

function createUser (url, accessToken, username, password, specialStatus, end) {
  if (!end) {
    end = specialStatus
    specialStatus = 204
  }

  const path = '/api/v1/users'

  request(url)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .send({ username: username, password: password })
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

function getUsersList (url, end) {
  const path = '/api/v1/users'

  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function removeUser (url, token, username, expectedStatus, end) {
  if (!end) {
    end = expectedStatus
    expectedStatus = 204
  }

  const path = '/api/v1/users'

  request(url)
    .delete(path + '/' + username)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
    .end(end)
}

function updateUser (url, userId, accessToken, newPassword, end) {
  const path = '/api/v1/users/' + userId

  request(url)
    .put(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .send({ password: newPassword })
    .expect(204)
    .end(end)
}

// ---------------------------------------------------------------------------

module.exports = usersUtils
