;(function () {
  'use strict'

  var child_process = require('child_process')
  var fork = child_process.fork
  var exec = child_process.exec

  function runMultipleServers (total_servers, serversRun) {
    var apps = []
    var urls = []
    var i = 0

    function anotherServerDone (number, app, url) {
      apps[number - 1] = app
      urls[number - 1] = url
      i++
      if (i === total_servers) {
        serversRun(apps, urls)
      }
    }

    flushTests(function () {
      for (var j = 1; j <= total_servers; j++) {
        (function (k) { // TODO: ES6 with let
          // For the virtual buffer
          setTimeout(function () {
            runServer(k, function (app, url) {
              anotherServerDone(k, app, url)
            })
          }, 1000 * k)
        })(j)
      }
    })
  }

  function runServer (number, callback) {
    var port = 9000 + number
    var server_run_string = {
      'Connected to mongodb': false,
      'Server listening on port': false
    }

    // Share the environment
    var env = Object.create(process.env)
    env.NODE_ENV = 'test'
    env.NODE_APP_INSTANCE = number
    var options = {
      silent: true,
      env: env,
      detached: true
    }

    var app = fork(__dirname + '/../server.js', [], options)
    app.stdout.on('data', function onStdout (data) {
      var dont_continue = false
      // Check if all required sentences are here
      for (var key of Object.keys(server_run_string)) {
        if (data.toString().indexOf(key) !== -1) server_run_string[key] = true
        if (server_run_string[key] === false) dont_continue = true
      }

      // If no, there is maybe one thing not already initialized (mongodb...)
      if (dont_continue === true) return

      app.stdout.removeListener('data', onStdout)
      callback(app, 'http://localhost:' + port)
    })
  }

  function flushTests (callback) {
    exec(__dirname + '/../scripts/clean_test.sh', function () {
      callback()
    })
  }

  module.exports = {
    runMultipleServers: runMultipleServers,
    runServer: runServer,
    flushTests: flushTests
  }
})()
