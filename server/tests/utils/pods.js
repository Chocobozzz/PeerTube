'use strict'

const request = require('supertest')

const podsUtils = {
  getFriendsList: getFriendsList,
  makeFriends: makeFriends,
  quitFriends: quitFriends
}

// ---------------------- Export functions --------------------

function getFriendsList (url, end) {
  const path = '/api/v1/pods/'

  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function makeFriends (url, accessToken, expectedStatus, end) {
  if (!end) {
    end = expectedStatus
    expectedStatus = 204
  }

  // Which pod makes friends with which pod
  const friendsMatrix = {
    'http://localhost:9001': [
      'http://localhost:9002'
    ],
    'http://localhost:9002': [
      'http://localhost:9003'
    ],
    'http://localhost:9003': [
      'http://localhost:9001'
    ],
    'http://localhost:9004': [
      'http://localhost:9002'
    ],
    'http://localhost:9005': [
      'http://localhost:9001',
      'http://localhost:9004'
    ],
    'http://localhost:9006': [
      'http://localhost:9001',
      'http://localhost:9002',
      'http://localhost:9003'
    ]
  }
  const path = '/api/v1/pods/makefriends'

  // The first pod make friend with the third
  request(url)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .send({ 'urls': friendsMatrix[url] })
    .expect(expectedStatus)
    .end(function (err, res) {
      if (err) throw err

      // Wait for the request between pods
      setTimeout(end, 1000)
    })
}

function quitFriends (url, accessToken, expectedStatus, end) {
  if (!end) {
    end = expectedStatus
    expectedStatus = 204
  }

  const path = '/api/v1/pods/quitfriends'

  // The first pod make friend with the third
  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(expectedStatus)
    .end(function (err, res) {
      if (err) throw err

      // Wait for the request between pods
      setTimeout(end, 1000)
    })
}

// ---------------------------------------------------------------------------

module.exports = podsUtils
