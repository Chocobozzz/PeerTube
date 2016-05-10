'use strict'

const child_process = require('child_process')
const exec = child_process.exec
const fork = child_process.fork
const fs = require('fs')
const pathUtils = require('path')
const request = require('supertest')

const testUtils = {
  flushTests: flushTests,
  getFriendsList: getFriendsList,
  getVideo: getVideo,
  getVideosList: getVideosList,
  login: login,
  loginAndGetAccessToken: loginAndGetAccessToken,
  makeFriends: makeFriends,
  quitFriends: quitFriends,
  removeVideo: removeVideo,
  flushAndRunMultipleServers: flushAndRunMultipleServers,
  runServer: runServer,
  searchVideo: searchVideo,
  testImage: testImage,
  uploadVideo: uploadVideo
}

// ---------------------- Export functions --------------------

function flushTests (callback) {
  exec('npm run clean:server:test', callback)
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
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function login (url, client, user, expected_status, end) {
  if (!end) {
    end = expected_status
    expected_status = 200
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
    .expect(expected_status)
    .end(end)
}

function loginAndGetAccessToken (server, callback) {
  login(server.url, server.client, server.user, 200, function (err, res) {
    if (err) return callback(err)

    return callback(null, res.body.access_token)
  })
}

function makeFriends (url, expected_status, callback) {
  if (!callback) {
    callback = expected_status
    expected_status = 204
  }

  const path = '/api/v1/pods/makefriends'

  // The first pod make friend with the third
  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(expected_status)
    .end(function (err, res) {
      if (err) throw err

      // Wait for the request between pods
      setTimeout(callback, 1000)
    })
}

function quitFriends (url, callback) {
  const path = '/api/v1/pods/quitfriends'

  // The first pod make friend with the third
  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(204)
    .end(function (err, res) {
      if (err) throw err

      // Wait for the request between pods
      setTimeout(callback, 1000)
    })
}

function removeVideo (url, token, id, expected_status, end) {
  if (!end) {
    end = expected_status
    expected_status = 204
  }

  const path = '/api/v1/videos'

  request(url)
    .delete(path + '/' + id)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expected_status)
    .end(end)
}

function flushAndRunMultipleServers (total_servers, serversRun) {
  let apps = []
  let urls = []
  let i = 0

  function anotherServerDone (number, app, url) {
    apps[number - 1] = app
    urls[number - 1] = url
    i++
    if (i === total_servers) {
      serversRun(apps, urls)
    }
  }

  flushTests(function () {
    for (let j = 1; j <= total_servers; j++) {
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
  const server_run_string = {
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
    let dont_continue = false

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
    for (const key of Object.keys(server_run_string)) {
      if (data.toString().indexOf(key) !== -1) server_run_string[key] = true
      if (server_run_string[key] === false) dont_continue = true
    }

    // If no, there is maybe one thing not already initialized (mongodb...)
    if (dont_continue === true) return

    server.app.stdout.removeListener('data', onStdout)
    callback(server)
  })
}

function searchVideo (url, search, end) {
  const path = '/api/v1/videos'

  request(url)
    .get(path + '/search/' + search)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function testImage (url, video_name, image_path, callback) {
  request(url)
    .get(image_path)
    .expect(200)
    .end(function (err, res) {
      if (err) return callback(err)

      fs.readFile(pathUtils.join(__dirname, 'fixtures', video_name + '.jpg'), function (err, data) {
        if (err) return callback(err)

        callback(null, data.equals(res.body))
      })
    })
}

function uploadVideo (url, access_token, name, description, fixture, special_status, end) {
  if (!end) {
    end = special_status
    special_status = 204
  }

  const path = '/api/v1/videos'

  request(url)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + access_token)
    .field('name', name)
    .field('description', description)
    .attach('videofile', pathUtils.join(__dirname, 'fixtures', fixture))
    .expect(special_status)
    .end(end)
}

// ---------------------------------------------------------------------------

module.exports = testUtils
