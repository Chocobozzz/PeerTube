#!/bin/env node

'use strict'

const series = require('async/series')
const request = require('request')
const WebSocket = require('ws')

const constants = require('../server/initializers/constants')
const requestHeaders = {
  'Range': '',
  'Keep-Alive': '',
  'User-Agent': 'Mozilla',
  'Cache-Control': 'no-cache',
  'Content-Type': '',
  'Host': 'example.com',
  'Access-Control-Request-Method': 'GET',
  'Access-Control-Request-Headers': 'range'
}

series([
  pingServer,
  checkCORSTorrent,
  checkCORSWebSeed,
  checkTracker
], function () {
  process.exit(0)
})

// ---------------------------------------------------------------------------

function pingServer (callback) {
  const pingUrl = constants.CONFIG.WEBSERVER.URL + '/api/v1/ping'
  console.log('Checking server is up (%s)...', pingUrl)

  request(pingUrl, function (err, res, body) {
    if (!err && res.statusCode === 200 && body === 'pong') {
      console.log('SUCCESS.')
    } else {
      console.log('FAIL.')
    }

    callback()
  })
}

function checkCORSTorrent (callback) {
  const torrentUrl = constants.CONFIG.WEBSERVER.URL + '/static/torrents/test.torrent'
  console.log('Checking CORS headers for the torrent (%s)...', torrentUrl)

  request({
    method: 'OPTIONS',
    uri: torrentUrl,
    headers: requestHeaders
  }, function (err, res) {
    if (err || isThereValidCORSHeaders(res) === false) {
      console.error('FAIL.')
    } else {
      console.log('SUCCESS.')
    }

    callback()
  })
}

function checkCORSWebSeed (callback) {
  const webseedUrl = constants.CONFIG.WEBSERVER.URL + '/static/webseed/test.mp4'
  console.log('Checking CORS headers for the video (%s)...', webseedUrl)

  request({
    method: 'OPTIONS',
    uri: webseedUrl,
    headers: requestHeaders
  }, function (err, res) {
    if (err || isThereValidCORSHeaders(res) === false) {
      console.error('FAIL.')
    } else {
      console.log('SUCCESS.')
    }

    callback()
  })
}

function checkTracker (callback) {
  const trackerUrl = constants.CONFIG.WEBSERVER.WS + '://' +
                     constants.CONFIG.WEBSERVER.HOST + ':' +
                     constants.CONFIG.WEBSERVER.PORT + '/tracker/socket'
  console.log('Checking tracker websocket (%s)...', trackerUrl)

  let ws = null
  ws = new WebSocket(trackerUrl)

  const timeout = setTimeout(failed, 1000)
  ws.on('open', onOpen)

  function onOpen () {
    clearTimeout(timeout)
    ws.close()

    console.log('SUCCESS.')
    callback()
  }

  function failed () {
    ws.removeListener('open', onOpen)
    ws.close()

    console.log('FAILED.')
    callback()
  }
}

function isThereValidCORSHeaders (res) {
  let fail = false

  // Check Access-Control-Allow-Origin
  const headerAllowOriginKey = 'access-control-allow-origin'
  const headerAllowOrigin = res.headers[headerAllowOriginKey]

  if (!headerAllowOrigin) {
    console.error(headerAllowOriginKey + ' is not present.')
    fail = true
  } else if (headerAllowOrigin !== '*') {
    console.error(headerAllowOriginKey + ' does not equal "*".')
    fail = true
  }

  // Check Access-Control-Allow-Methods
  const headerAllowMethodsKey = 'access-control-allow-methods'
  const headerAllowMethods = res.headers[headerAllowMethodsKey]
  if (!headerAllowMethods) {
    console.error(headerAllowMethodsKey + ' is not present.')
    fail = true
  } else {
    const allowMethodsMissed = findPatternNotInString(headerAllowMethods, [ 'get' ])
    if (allowMethodsMissed !== null) {
      console.error(headerAllowMethodsKey + ' misses the ' + allowMethodsMissed + ' method.')
      fail = true
    }
  }

  // Check Access-Control-Allow-Headers
  const headerAllowHeadersKey = 'access-control-allow-headers'
  const headerAllowHeaders = res.headers[headerAllowHeadersKey]
  if (!headerAllowHeaders) {
    console.error(headerAllowHeadersKey + ' is not present.')
    fail = true
  } else {
    const headersThatShouldBePresent = [
      'Range'
    ]
    const allowHeadersMissed = findPatternNotInString(headerAllowHeaders, headersThatShouldBePresent)
    if (allowHeadersMissed !== null) {
      console.error(headerAllowHeadersKey + ' misses the ' + allowHeadersMissed + ' header.')
      fail = true
    }
  }

  return !fail
}

function findPatternNotInString (stringChain, patterns) {
  let res = null
  const stringChainLowerCase = stringChain.toLowerCase()

  patterns.forEach(function (pattern) {
    if (stringChainLowerCase.indexOf(pattern.toLowerCase()) === -1) {
      res = pattern
    }
  })

  return res
}
