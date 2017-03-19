'use strict'

const each = require('async/each')
const isEqual = require('lodash/isEqual')
const differenceWith = require('lodash/differenceWith')
const program = require('commander')
const series = require('async/series')

process.env.NODE_ENV = 'test'
const constants = require('../../initializers/constants')

const loginUtils = require('../utils/login')
const podsUtils = require('../utils/pods')
const serversUtils = require('../utils/servers')
const videosUtils = require('../utils/videos')
const requestStatsUtils = require('../utils/requests-stats')

program
  .option('-c, --create [weight]', 'Weight for creating videos')
  .option('-r, --remove [weight]', 'Weight for removing videos')
  .option('-u, --update [weight]', 'Weight for updating videos')
  .option('-v, --view [weight]', 'Weight for viewing videos')
  .option('-l, --like [weight]', 'Weight for liking videos')
  .option('-s --dislike [weight]', 'Weight for disliking videos')
  .option('-p, --pods [n]', 'Number of pods to run (3 or 6)', /^3|6$/, 3)
  .option('-a, --action [interval]', 'Interval in ms for an action')
  .option('-i, --integrity [interval]', 'Interval in ms for an integrity check')
  .option('-f, --flush', 'Flush datas on exit')
  .option('-d, --difference', 'Display difference if integrity is not okay')
  .parse(process.argv)

const createWeight = program.create !== undefined ? parseInt(program.create) : 5
const removeWeight = program.remove !== undefined ? parseInt(program.remove) : 4
const updateWeight = program.update !== undefined ? parseInt(program.update) : 4
const viewWeight = program.view !== undefined ? parseInt(program.view) : 4
const likeWeight = program.like !== undefined ? parseInt(program.like) : 4
const dislikeWeight = program.dislike !== undefined ? parseInt(program.dislike) : 4
const flushAtExit = program.flush || false
const actionInterval = program.action !== undefined ? parseInt(program.action) : 500
const integrityInterval = program.integrity !== undefined ? parseInt(program.integrity) : 60000
const displayDiffOnFail = program.integrity || false

const numberOfPods = 6

console.log('Create weight: %d, update weight: %d, remove weight: %d, view weight: %d, like weight: %d, dislike weight: %d.', createWeight, updateWeight, removeWeight, viewWeight, likeWeight, dislikeWeight)
if (flushAtExit) {
  console.log('Program will flush data on exit.')
} else {
  console.log('Program will not flush data on exit.')
}
if (displayDiffOnFail) {
  console.log('Program will display diff on failure.')
} else {
  console.log('Program will not display diff on failure')
}
console.log('Interval in ms for each action: %d.', actionInterval)
console.log('Interval in ms for each integrity check: %d.', integrityInterval)

console.log('Run servers...')
runServers(numberOfPods, function (err, servers) {
  if (err) throw err

  process.on('exit', function () {
    exitServers(servers, flushAtExit)
  })
  process.on('SIGINT', goodbye)
  process.on('SIGTERM', goodbye)

  console.log('Servers runned')
  initializeRequestsPerServer(servers)

  let checking = false

  setInterval(function () {
    if (checking === true) return

    const rand = getRandomInt(0, createWeight + updateWeight + removeWeight + viewWeight + likeWeight + dislikeWeight)

    const numServer = getRandomNumServer(servers)
    servers[numServer].requestsNumber++

    if (rand < createWeight) {
      upload(servers, numServer)
    } else if (rand < createWeight + updateWeight) {
      update(servers, numServer)
    } else if (rand < createWeight + updateWeight + removeWeight) {
      remove(servers, numServer)
    } else if (rand < createWeight + updateWeight + removeWeight + viewWeight) {
      view(servers, numServer)
    } else if (rand < createWeight + updateWeight + removeWeight + viewWeight + likeWeight) {
      like(servers, numServer)
    } else {
      dislike(servers, numServer)
    }
  }, actionInterval)

  // The function will check the consistency between servers (should have the same videos with same attributes...)
  setInterval(function () {
    if (checking === true) return

    console.log('Checking integrity...')
    checking = true

    const waitingInterval = setInterval(function () {
      isThereAwaitingRequests(servers, function (res) {
        if (res === true) {
          console.log('A server has awaiting requests, waiting...')
          return
        }

        checkIntegrity(servers, function () {
          initializeRequestsPerServer(servers)
          checking = false
          clearInterval(waitingInterval)
        })
      })
    }, constants.REQUESTS_INTERVAL)
  }, integrityInterval)
})

// ----------------------------------------------------------------------------

function initializeRequestsPerServer (servers) {
  servers.forEach(function (server) {
    server.requestsNumber = 0
  })
}

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

  const name = Date.now() + ' name'
  const description = Date.now() + ' description'
  const tags = [ Date.now().toString().substring(0, 5) + 't1', Date.now().toString().substring(0, 5) + 't2' ]
  const file = 'video_short1.webm'

  console.log('Uploading video to server ' + numServer)

  videosUtils.uploadVideo(servers[numServer].url, servers[numServer].accessToken, name, description, tags, file, callback)
}

function update (servers, numServer, callback) {
  if (!callback) callback = function () {}

  videosUtils.getVideosList(servers[numServer].url, function (err, res) {
    if (err) throw err

    const videos = res.body.data.filter(function (video) { return video.isLocal })
    if (videos.length === 0) return callback()

    const toUpdate = videos[getRandomInt(0, videos.length)].id
    const name = Date.now() + ' name'
    const description = Date.now() + ' description'
    const tags = [ Date.now().toString().substring(0, 5) + 't1', Date.now().toString().substring(0, 5) + 't2' ]

    console.log('Updating video of server ' + numServer)

    videosUtils.updateVideo(servers[numServer].url, servers[numServer].accessToken, toUpdate, name, description, tags, callback)
  })
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

function view (servers, numServer, callback) {
  if (!callback) callback = function () {}

  videosUtils.getVideosList(servers[numServer].url, function (err, res) {
    if (err) throw err

    const videos = res.body.data
    if (videos.length === 0) return callback()

    const toView = videos[getRandomInt(0, videos.length)].id

    console.log('Viewing video from server ' + numServer)
    videosUtils.getVideo(servers[numServer].url, toView, callback)
  })
}

function like (servers, numServer, callback) {
  rate(servers, numServer, 'like', callback)
}

function dislike (servers, numServer, callback) {
  rate(servers, numServer, 'dislike', callback)
}

function rate (servers, numServer, rating, callback) {
  if (!callback) callback = function () {}

  videosUtils.getVideosList(servers[numServer].url, function (err, res) {
    if (err) throw err

    const videos = res.body.data
    if (videos.length === 0) return callback()

    const toRate = videos[getRandomInt(0, videos.length)].id

    console.log('Rating (%s) video from server %d', rating, numServer)
    videosUtils.getVideo(servers[numServer].url, toRate, callback)
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
        delete serverVideo.updatedAt
        delete serverVideo.views
      }

      videos.push(serverVideos)
      callback()
    })
  }, function () {
    let i = 0

    for (const video of videos) {
      if (!isEqual(video, videos[0])) {
        console.error('Integrity not ok with server %d!', i + 1)

        if (displayDiffOnFail) {
          console.log(differenceWith(videos[0], video, isEqual))
          console.log(differenceWith(video, videos[0], isEqual))
        }

        process.exit(-1)
      }

      i++
    }

    console.log('Integrity ok.')
    return callback()
  })
}

function goodbye () {
  return process.exit(-1)
}

function isThereAwaitingRequests (servers, callback) {
  let noRequests = true

  // Check is each server has awaiting requestq
  each(servers, function (server, callbackEach) {
    requestStatsUtils.getRequestsStats(server, server.accessToken, function (err, res) {
      if (err) throw err

      const stats = res.body

      if (
        stats.requestScheduler.totalRequests !== 0 ||
        stats.requestVideoEventScheduler.totalRequests !== 0 ||
        stats.requestVideoQaduScheduler.totalRequests !== 0
      ) {
        noRequests = false
      }

      callbackEach()
    })
  }, function (err) {
    if (err) throw err

    return callback(noRequests === false)
  })
}
