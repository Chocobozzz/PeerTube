import { logger } from '../helpers/logger'
import * as express from 'express'
import * as http from 'http'
import * as bitTorrentTracker from 'bittorrent-tracker'
import * as proxyAddr from 'proxy-addr'
import { Server as WebSocketServer } from 'ws'
import { CONFIG, TRACKER_RATE_LIMITS } from '../initializers/constants'
import { VideoFileModel } from '../models/video/video-file'

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
  filter: function (infoHash, params, cb) {
    let ip: string

    if (params.type === 'ws') {
      ip = params.socket.ip
    } else {
      ip = params.httpReq.ip
    }

    const key = ip + '-' + infoHash

    peersIps[ip] = peersIps[ip] ? peersIps[ip] + 1 : 1
    peersIpInfoHash[key] = peersIpInfoHash[key] ? peersIpInfoHash[key] + 1 : 1

    if (peersIpInfoHash[key] > TRACKER_RATE_LIMITS.ANNOUNCES_PER_IP_PER_INFOHASH) {
      return cb(new Error(`Too many requests (${peersIpInfoHash[ key ]} of ip ${ip} for torrent ${infoHash}`))
    }

    VideoFileModel.isInfohashExists(infoHash)
      .then(exists => {
        if (exists === false) return cb(new Error(`Unknown infoHash ${infoHash}`))

        return cb()
      })
  }
})

trackerServer.on('error', function (err) {
  logger.error('Error in tracker.', { err })
})

trackerServer.on('warning', function (err) {
  logger.warn('Warning in tracker.', { err })
})

const onHttpRequest = trackerServer.onHttpRequest.bind(trackerServer)
trackerRouter.get('/tracker/announce', (req, res) => onHttpRequest(req, res, { action: 'announce' }))
trackerRouter.get('/tracker/scrape', (req, res) => onHttpRequest(req, res, { action: 'scrape' }))

function createWebsocketServer (app: express.Application) {
  const server = http.createServer(app)
  const wss = new WebSocketServer({ server: server, path: '/tracker/socket' })
  wss.on('connection', function (ws, req) {
    const ip = proxyAddr(req, CONFIG.TRUST_PROXY)
    ws['ip'] = ip

    trackerServer.onWebSocketConnection(ws)
  })

  return server
}

// ---------------------------------------------------------------------------

export {
  trackerRouter,
  createWebsocketServer
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
