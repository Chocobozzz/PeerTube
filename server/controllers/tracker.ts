import { logger } from '../helpers/logger'
import * as express from 'express'
import * as http from 'http'
import * as bitTorrentTracker from 'bittorrent-tracker'
import * as proxyAddr from 'proxy-addr'
import { Server as WebSocketServer } from 'ws'
import { TRACKER_RATE_LIMITS } from '../initializers/constants'
import { VideoFileModel } from '../models/video/video-file'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist'
import { CONFIG } from '../initializers/config'

const TrackerServer = bitTorrentTracker.Server

const trackerRouter = express.Router()

let peersIps = {}
let peersIpInfoHash = {}
runPeersChecker()

const trackerServer = new TrackerServer({
  http: false,
  udp: false,
  ws: false,
  dht: false,
  filter: async function (infoHash, params, cb) {
    if (CONFIG.TRACKER.ENABLED === false) {
      return cb(new Error('Tracker is disabled on this instance.'))
    }

    let ip: string

    if (params.type === 'ws') {
      ip = params.socket.ip
    } else {
      ip = params.httpReq.ip
    }

    const key = ip + '-' + infoHash

    peersIps[ip] = peersIps[ip] ? peersIps[ip] + 1 : 1
    peersIpInfoHash[key] = peersIpInfoHash[key] ? peersIpInfoHash[key] + 1 : 1

    if (CONFIG.TRACKER.REJECT_TOO_MANY_ANNOUNCES && peersIpInfoHash[key] > TRACKER_RATE_LIMITS.ANNOUNCES_PER_IP_PER_INFOHASH) {
      return cb(new Error(`Too many requests (${peersIpInfoHash[key]} of ip ${ip} for torrent ${infoHash}`))
    }

    try {
      if (CONFIG.TRACKER.PRIVATE === false) return cb()

      const videoFileExists = await VideoFileModel.doesInfohashExistCached(infoHash)
      if (videoFileExists === true) return cb()

      const playlistExists = await VideoStreamingPlaylistModel.doesInfohashExist(infoHash)
      if (playlistExists === true) return cb()

      return cb(new Error(`Unknown infoHash ${infoHash} requested by ip ${ip}`))
    } catch (err) {
      logger.error('Error in tracker filter.', { err })
      return cb(err)
    }
  }
})

if (CONFIG.TRACKER.ENABLED !== false) {

  trackerServer.on('error', function (err) {
    logger.error('Error in tracker.', { err })
  })

  trackerServer.on('warning', function (err) {
    logger.warn('Warning in tracker.', { err })
  })
}

const onHttpRequest = trackerServer.onHttpRequest.bind(trackerServer)
trackerRouter.get('/tracker/announce', (req, res) => onHttpRequest(req, res, { action: 'announce' }))
trackerRouter.get('/tracker/scrape', (req, res) => onHttpRequest(req, res, { action: 'scrape' }))

function createWebsocketTrackerServer (app: express.Application) {
  const server = http.createServer(app)
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', function (ws, req) {
    ws['ip'] = proxyAddr(req, CONFIG.TRUST_PROXY)

    trackerServer.onWebSocketConnection(ws)
  })

  server.on('upgrade', (request: express.Request, socket, head) => {
    if (request.url === '/tracker/socket') {
      wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request))
    }

    // Don't destroy socket, we have Socket.IO too
  })

  return server
}

// ---------------------------------------------------------------------------

export {
  trackerRouter,
  createWebsocketTrackerServer
}

// ---------------------------------------------------------------------------

function runPeersChecker () {
  setInterval(() => {
    logger.debug('Checking peers.')

    for (const ip of Object.keys(peersIpInfoHash)) {
      if (peersIps[ip] > TRACKER_RATE_LIMITS.ANNOUNCES_PER_IP) {
        logger.warn('Peer %s made abnormal requests (%d).', ip, peersIps[ip])
      }
    }

    peersIpInfoHash = {}
    peersIps = {}
  }, TRACKER_RATE_LIMITS.INTERVAL)
}
