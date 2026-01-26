import { Server as TrackerServer } from '@peertube/bittorrent-tracker-server'
import express from 'express'
import { createServer } from 'http'
import { LRUCache } from 'lru-cache'
import proxyAddr from 'proxy-addr'
import { WebSocketServer } from 'ws'
import { logger } from '../helpers/logger.js'
import { CONFIG } from '../initializers/config.js'
import { LRU_CACHE, TRACKER_RATE_LIMITS } from '../initializers/constants.js'
import { VideoFileModel } from '../models/video/video-file.js'
import { VideoStreamingPlaylistModel } from '../models/video/video-streaming-playlist.js'

export const trackerRouter = express.Router()

const blockedIPs = new LRUCache<string, boolean>({
  max: LRU_CACHE.TRACKER_IPS.MAX_SIZE,
  ttl: TRACKER_RATE_LIMITS.BLOCK_IP_LIFETIME
})

let peersIps = {}
let peersIpInfoHash = {}
runPeersChecker()

const trackerServer = new TrackerServer({
  http: false,
  udp: false,
  ws: false,
  filter: async function (infoHash, params, cb) {
    if (CONFIG.TRACKER.ENABLED === false) {
      return cb(new Error('Tracker is disabled on this instance.'))
    }

    const ip = params.type === 'ws'
      ? params.ip
      : params.httpReq.ip

    const key = ip + '-' + infoHash

    peersIps[ip] = peersIps[ip] ? peersIps[ip] + 1 : 1
    peersIpInfoHash[key] = peersIpInfoHash[key] ? peersIpInfoHash[key] + 1 : 1

    if (CONFIG.TRACKER.REJECT_TOO_MANY_ANNOUNCES && peersIpInfoHash[key] > TRACKER_RATE_LIMITS.ANNOUNCES_PER_IP_PER_INFOHASH) {
      return cb(new Error(`Too many requests (${peersIpInfoHash[key]} of ip ${ip} for torrent ${infoHash}`))
    }

    try {
      if (CONFIG.TRACKER.PRIVATE === false) return cb()

      const playlistExists = await VideoStreamingPlaylistModel.doesInfohashExistCached(infoHash)
      if (playlistExists === true) return cb()

      // Classic infohash (not p2p-media-loader custom one), use arg directly
      const videoFileExists = await VideoFileModel.doesInfohashExistCached(infoHash)
      if (videoFileExists === true) return cb()

      cb(new Error(`Unknown infoHash ${infoHash} requested by ip ${ip}`))

      // Close socket connection and block IP for a few time
      if (params.type === 'ws') {
        blockedIPs.set(ip, true)

        // setTimeout to wait filter response
        setTimeout(() => params.socket.close(), 0)
      }
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
    const message = err.message || ''

    if (CONFIG.LOG.LOG_TRACKER_UNKNOWN_INFOHASH === false && message.includes('Unknown infoHash')) {
      return
    }

    logger.warn('Warning in tracker.', { err })
  })
}

const onHttpRequest = trackerServer.onHttpRequest.bind(trackerServer)
trackerRouter.get('/tracker/announce', (req, res) => onHttpRequest(req, res, { action: 'announce' }))
trackerRouter.get('/tracker/scrape', (req, res) => onHttpRequest(req, res, { action: 'scrape' }))

export function createWebsocketTrackerServer (app: express.Application) {
  const server = createServer(app)
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', function (ws, req) {
    ws['ip'] = proxyAddr(req, CONFIG.TRUST_PROXY)

    trackerServer.onWebSocketConnection(ws)
  })

  server.on('upgrade', (request: express.Request, socket, head) => {
    if (request.url === '/tracker/socket') {
      const ip = proxyAddr(request, CONFIG.TRUST_PROXY)

      if (blockedIPs.has(ip)) {
        logger.debug('Blocking IP %s from tracker.', ip)

        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
        socket.destroy()
        return
      }

      return wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request))
    }

    // Don't destroy socket, we have Socket.IO too
  })

  return { server, trackerServer }
}

// ---------------------------------------------------------------------------
// Private
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
