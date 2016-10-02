'use strict'

const each = require('async/each')
const isEqual = require('lodash/isEqual')
const program = require('commander')
const series = require('async/series')

process.env.NODE_ENV = 'test'
const constants = require('../../initializers/constants')

const loginUtils = require('../utils/login')
const podsUtils = require('../utils/pods')
const serversUtils = require('../utils/servers')
const videosUtils = require('../utils/videos')

program
  .option('-c, --create [weight]', 'Weight for creating videos')
  .option('-r, --remove [weight]', 'Weight for removing videos')
  .option('-p, --pods [n]', 'Number of pods to run (3 or 6)', /^3|6$/, 3)
  .option('-a, --action [interval]', 'Interval in ms for an action')
  .option('-i, --integrity [interval]', 'Interval in ms for an integrity check')
  .option('-f, --flush', 'Flush datas on exit')
  .parse(process.argv)

const createWeight = parseInt(program.create) || 5
const removeWeight = parseInt(program.remove) || 4
const flushAtExit = program.flush || false
const actionInterval = parseInt(program.action) || 500
let integrityInterval = parseInt(program.integrity) || 60000

const numberOfPods = 6
// Wait requests between pods
const requestsMaxPerInterval = constants.INTERVAL / actionInterval
const intervalsToMakeAllRequests = Math.ceil(requestsMaxPerInterval / constants.REQUESTS_LIMIT)
const waitForBeforeIntegrityCheck = (intervalsToMakeAllRequests * constants.INTERVAL) + 1000

integrityInterval += waitForBeforeIntegrityCheck

console.log('Create weight: %d, remove weight: %d.', createWeight, removeWeight)
if (flushAtExit) {
  console.log('Program will flush data on exit.')
} else {
  console.log('Program will not flush data on exit.')
}
console.log('Interval in ms for each action: %d.', actionInterval)
console.log('Interval in ms for each integrity check: %d.', integrityInterval)
console.log('Will wait %d ms before an integrity check.', waitForBeforeIntegrityCheck)

console.log('Run servers...')
runServers(numberOfPods, function (err, servers) {
  if (err) throw err

  process.on('exit', function () {
    exitServers(servers, flushAtExit)
  })
  process.on('SIGINT', goodbye)
  process.on('SIGTERM', goodbye)

  console.log('Servers runned')

  let checking = false

  setInterval(function () {
    if (checking === true) return

    const rand = getRandomInt(0, createWeight + removeWeight)

    if (rand < createWeight) {
      upload(servers, getRandomNumServer(servers))
    } else {
      remove(servers, getRandomNumServer(servers))
    }
  }, actionInterval)

  setInterval(function () {
    console.log('Checking integrity...')
    checking = true

    setTimeout(function () {
      checkIntegrity(servers, function () {
        checking = false
      })
    }, waitForBeforeIntegrityCheck)
  }, integrityInterval)
})

// ----------------------------------------------------------------------------

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min)) + min
}

function getRandomNumServer (servers) {
  return getRandomInt(0, servers.length)
}

function runServers (numberOfPods, callback) {
  let servers = null

  series([
    // Run servers
    function (next) {
      serversUtils.flushAndRunMultipleServers(numberOfPods, function (serversRun) {
        servers = serversRun
        next()
      })
    },
    // Get the access tokens
    function (next) {
      each(servers, function (server, callbackEach) {
        loginUtils.loginAndGetAccessToken(server, function (err, accessToken) {
          if (err) return callbackEach(err)

          server.accessToken = accessToken
          callbackEach()
        })
      }, next)
    },
    function (next) {
      const server = servers[1]
      podsUtils.makeFriends(server.url, server.accessToken, next)
    },
    function (next) {
      const server = servers[0]
      podsUtils.makeFriends(server.url, server.accessToken, next)
    },
    function (next) {
      setTimeout(next, 1000)
    },
    function (next) {
      const server = servers[3]
      podsUtils.makeFriends(server.url, server.accessToken, next)
    },
    function (next) {
      const server = servers[5]
      podsUtils.makeFriends(server.url, server.accessToken, next)
    },
    function (next) {
      const server = servers[4]
      podsUtils.makeFriends(server.url, server.accessToken, next)
    },
    function (next) {
      setTimeout(next, 1000)
    }
  ], function (err) {
    return callback(err, servers)
  })
}

function exitServers (servers, callback) {
  if (!callback) callback = function () {}

  servers.forEach(function (server) {
    if (server.app) process.kill(-server.app.pid)
  })

  if (flushAtExit) serversUtils.flushTests(callback)
}

function upload (servers, numServer, callback) {
  if (!callback) callback = function () {}

  const name = 'my super name for pod 1'
  const description = 'my super description for pod 1'
  const tags = [ 'tag1p1', 'tag2p1' ]
  const file = 'video_short1.webm'

  console.log('Upload video to server ' + numServer)

  videosUtils.uploadVideo(servers[numServer].url, servers[numServer].accessToken, name, description, tags, file, callback)
}

function remove (servers, numServer, callback) {
  if (!callback) callback = function () {}

  videosUtils.getVideosList(servers[numServer].url, function (err, res) {
    if (err) throw err

    const videos = res.body.data
    if (videos.length === 0) return callback()

    const toRemove = videos[getRandomInt(0, videos.length)].id

    console.log('Removing video from server ' + numServer)
    videosUtils.removeVideo(servers[numServer].url, servers[numServer].accessToken, toRemove, callback)
  })
}

function checkIntegrity (servers, callback) {
  const videos = []
  each(servers, function (server, callback) {
    videosUtils.getAllVideosListBy(server.url, function (err, res) {
      if (err) throw err
      const serverVideos = res.body.data
      for (const serverVideo of serverVideos) {
        delete serverVideo.id
        delete serverVideo.isLocal
        delete serverVideo.thumbnailPath
      }

      videos.push(serverVideos)
      callback()
    })
  }, function () {
    for (const video of videos) {
      if (!isEqual(video, videos[0])) {
        console.error('Integrity not ok!')
        process.exit(-1)
      }
    }

    console.log('Integrity ok.')
    return callback()
  })
}

function goodbye () {
  return process.exit(-1)
}
