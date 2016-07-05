'use strict'

const childProcess = require('child_process')
const exec = childProcess.exec
const fork = childProcess.fork
const fs = require('fs')
const pathUtils = require('path')
const request = require('supertest')

const testUtils = {
  dateIsValid: dateIsValid,
  flushTests: flushTests,
  getAllVideosListBy: getAllVideosListBy,
  getFriendsList: getFriendsList,
  getVideo: getVideo,
  getVideosList: getVideosList,
  getVideosListPagination: getVideosListPagination,
  getVideosListSort: getVideosListSort,
  login: login,
  loginAndGetAccessToken: loginAndGetAccessToken,
  makeFriends: makeFriends,
  quitFriends: quitFriends,
  removeVideo: removeVideo,
  flushAndRunMultipleServers: flushAndRunMultipleServers,
  runServer: runServer,
  searchVideo: searchVideo,
  searchVideoWithPagination: searchVideoWithPagination,
  searchVideoWithSort: searchVideoWithSort,
  testImage: testImage,
  uploadVideo: uploadVideo
}

// ---------------------- Export functions --------------------

function dateIsValid (dateString) {
  const dateToCheck = new Date(dateString)
  const now = new Date()

  // Check if the interval is more than 2 minutes
  if (now - dateToCheck > 120000) return false

  return true
}

function flushTests (callback) {
  exec('npm run clean:server:test', callback)
}

function getAllVideosListBy (url, end) {
  const path = '/api/v1/videos'

  request(url)
    .get(path)
    .query({ sort: 'createdDate' })
    .query({ start: 0 })
    .query({ count: 10000 })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getFriendsList (url, end) {
  const path = '/api/v1/pods/'

  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getVideo (url, id, end) {
  const path = '/api/v1/videos/' + id

  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getVideosList (url, end) {
  const path = '/api/v1/videos'

  request(url)
    .get(path)
    .query({ sort: 'name' })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getVideosListPagination (url, start, count, end) {
  const path = '/api/v1/videos'

  request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getVideosListSort (url, sort, end) {
  const path = '/api/v1/videos'

  request(url)
    .get(path)
    .query({ sort: sort })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function login (url, client, user, expectedStatus, end) {
  if (!end) {
    end = expectedStatus
    expectedStatus = 200
  }

  const path = '/api/v1/users/token'

  const body = {
    client_id: client.id,
    client_secret: client.secret,
    username: user.username,
    password: user.password,
    response_type: 'code',
    grant_type: 'password',
    scope: 'upload'
  }

  request(url)
    .post(path)
    .type('form')
    .send(body)
    .expect(expectedStatus)
    .end(end)
}

function loginAndGetAccessToken (server, callback) {
  login(server.url, server.client, server.user, 200, function (err, res) {
    if (err) return callback(err)

    return callback(null, res.body.access_token)
  })
}

function makeFriends (url, accessToken, expectedStatus, callback) {
  if (!callback) {
    callback = expectedStatus
    expectedStatus = 204
  }

  const path = '/api/v1/pods/makefriends'

  // The first pod make friend with the third
  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(expectedStatus)
    .end(function (err, res) {
      if (err) throw err

      // Wait for the request between pods
      setTimeout(callback, 1000)
    })
}

function quitFriends (url, accessToken, expectedStatus, callback) {
  if (!callback) {
    callback = expectedStatus
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
      setTimeout(callback, 1000)
    })
}

function removeVideo (url, token, id, expectedStatus, end) {
  if (!end) {
    end = expectedStatus
    expectedStatus = 204
  }

  const path = '/api/v1/videos'

  request(url)
    .delete(path + '/' + id)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
    .end(end)
}

function flushAndRunMultipleServers (totalServers, serversRun) {
  let apps = []
  let urls = []
  let i = 0

  function anotherServerDone (number, app, url) {
    apps[number - 1] = app
    urls[number - 1] = url
    i++
    if (i === totalServers) {
      serversRun(apps, urls)
    }
  }

  flushTests(function () {
    for (let j = 1; j <= totalServers; j++) {
      // For the virtual buffer
      setTimeout(function () {
        runServer(j, function (app, url) {
          anotherServerDone(j, app, url)
        })
      }, 1000 * j)
    }
  })
}

function runServer (number, callback) {
  const server = {
    app: null,
    url: `http://localhost:${9000 + number}`,
    client: {
      id: null,
      secret: null
    },
    user: {
      username: null,
      password: null
    }
  }

  // These actions are async so we need to be sure that they have both been done
  const serverRunString = {
    'Connected to mongodb': false,
    'Server listening on port': false
  }

  const regexps = {
    client_id: 'Client id: ([a-f0-9]+)',
    client_secret: 'Client secret: (.+)',
    user_username: 'Username: (.+)',
    user_password: 'User password: (.+)'
  }

  // Share the environment
  const env = Object.create(process.env)
  env.NODE_ENV = 'test'
  env.NODE_APP_INSTANCE = number
  const options = {
    silent: true,
    env: env,
    detached: true
  }

  server.app = fork(pathUtils.join(__dirname, '../../../server.js'), [], options)
  server.app.stdout.on('data', function onStdout (data) {
    let dontContinue = false

    // Capture things if we want to
    for (const key of Object.keys(regexps)) {
      const regexp = regexps[key]
      const matches = data.toString().match(regexp)
      if (matches !== null) {
        if (key === 'client_id') server.client.id = matches[1]
        else if (key === 'client_secret') server.client.secret = matches[1]
        else if (key === 'user_username') server.user.username = matches[1]
        else if (key === 'user_password') server.user.password = matches[1]
      }
    }

    // Check if all required sentences are here
    for (const key of Object.keys(serverRunString)) {
      if (data.toString().indexOf(key) !== -1) serverRunString[key] = true
      if (serverRunString[key] === false) dontContinue = true
    }

    // If no, there is maybe one thing not already initialized (mongodb...)
    if (dontContinue === true) return

    server.app.stdout.removeListener('data', onStdout)
    callback(server)
  })
}

function searchVideo (url, search, field, end) {
  if (!end) {
    end = field
    field = null
  }

  const path = '/api/v1/videos'
  const req = request(url)
              .get(path + '/search/' + search)
              .set('Accept', 'application/json')

  if (field) req.query({ field: field })
  req.expect(200)
     .expect('Content-Type', /json/)
     .end(end)
}

function searchVideoWithPagination (url, search, field, start, count, end) {
  const path = '/api/v1/videos'

  request(url)
    .get(path + '/search/' + search)
    .query({ start: start })
    .query({ count: count })
    .query({ field: field })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function searchVideoWithSort (url, search, sort, end) {
  const path = '/api/v1/videos'

  request(url)
    .get(path + '/search/' + search)
    .query({ sort: sort })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function testImage (url, videoName, imagePath, callback) {
  request(url)
    .get(imagePath)
    .expect(200)
    .end(function (err, res) {
      if (err) return callback(err)

      fs.readFile(pathUtils.join(__dirname, 'fixtures', videoName + '.jpg'), function (err, data) {
        if (err) return callback(err)

        callback(null, data.equals(res.body))
      })
    })
}

function uploadVideo (url, accessToken, name, description, tags, fixture, specialStatus, end) {
  if (!end) {
    end = specialStatus
    specialStatus = 204
  }

  const path = '/api/v1/videos'

  const req = request(url)
              .post(path)
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + accessToken)
              .field('name', name)
              .field('description', description)

  for (let i = 0; i < tags.length; i++) {
    req.field('tags[' + i + ']', tags[i])
  }

  req.attach('videofile', pathUtils.join(__dirname, 'fixtures', fixture))
     .expect(specialStatus)
     .end(end)
}

// ---------------------------------------------------------------------------

module.exports = testUtils
