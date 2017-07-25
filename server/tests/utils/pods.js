'use strict'

const request = require('supertest')

const podsUtils = {
  getFriendsList,
  makeFriends,
  quitFriends,
  quitOneFriend
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
      'localhost:9002'
    ],
    'http://localhost:9002': [
      'localhost:9003'
    ],
    'http://localhost:9003': [
      'localhost:9001'
    ],
    'http://localhost:9004': [
      'localhost:9002'
    ],
    'http://localhost:9005': [
      'localhost:9001',
      'localhost:9004'
    ],
    'http://localhost:9006': [
      'localhost:9001',
      'localhost:9002',
      'localhost:9003'
    ]
  }
  const path = '/api/v1/pods/makefriends'

  // The first pod make friend with the third
  request(url)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .send({ 'hosts': friendsMatrix[url] })
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

function quitOneFriend (url, accessToken, friendId, expectedStatus, end) {
  if (!end) {
    end = expectedStatus
    expectedStatus = 204
  }

  const path = '/api/v1/pods/' + friendId

  request(url)
    .delete(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(expectedStatus)
    .end(function (err, res) {
      if (err) throw err

      end()
    })
}

// ---------------------------------------------------------------------------

module.exports = podsUtils
