'use strict'

const childProcess = require('child_process')
const exec = childProcess.exec
const fork = childProcess.fork
const pathUtils = require('path')

const serversUtils = {
  flushAndRunMultipleServers,
  flushTests,
  runServer
}

// ---------------------- Export functions --------------------

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

function flushTests (callback) {
  exec('npm run clean:server:test', callback)
}

function runServer (number, callback) {
  const server = {
    app: null,
    url: `http://localhost:${9000 + number}`,
    host: `localhost:${9000 + number}`,
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
    'Database is ready': false,
    'Server listening on port': false
  }

  const regexps = {
    client_id: 'Client id: (.+)',
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

    // If no, there is maybe one thing not already initialized (client/user credentials generation...)
    if (dontContinue === true) return

    server.app.stdout.removeListener('data', onStdout)
    callback(server)
  })
}

// ---------------------------------------------------------------------------

module.exports = serversUtils
