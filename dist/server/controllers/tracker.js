"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../helpers/logger");
const express = require("express");
const http = require("http");
const bitTorrentTracker = require("bittorrent-tracker");
const proxyAddr = require("proxy-addr");
const ws_1 = require("ws");
const constants_1 = require("../initializers/constants");
const video_file_1 = require("../models/video/video-file");
const TrackerServer = bitTorrentTracker.Server;
const trackerRouter = express.Router();
exports.trackerRouter = trackerRouter;
let peersIps = {};
let peersIpInfoHash = {};
runPeersChecker();
const trackerServer = new TrackerServer({
    http: false,
    udp: false,
    ws: false,
    dht: false,
    filter: function (infoHash, params, cb) {
        let ip;
        if (params.type === 'ws') {
            ip = params.socket.ip;
        }
        else {
            ip = params.httpReq.ip;
        }
        const key = ip + '-' + infoHash;
        peersIps[ip] = peersIps[ip] ? peersIps[ip] + 1 : 1;
        peersIpInfoHash[key] = peersIpInfoHash[key] ? peersIpInfoHash[key] + 1 : 1;
        if (peersIpInfoHash[key] > constants_1.TRACKER_RATE_LIMITS.ANNOUNCES_PER_IP_PER_INFOHASH) {
            return cb(new Error(`Too many requests (${peersIpInfoHash[key]} of ip ${ip} for torrent ${infoHash}`));
        }
        video_file_1.VideoFileModel.isInfohashExists(infoHash)
            .then(exists => {
            if (exists === false)
                return cb(new Error(`Unknown infoHash ${infoHash}`));
            return cb();
        });
    }
});
trackerServer.on('error', function (err) {
    logger_1.logger.error('Error in tracker.', { err });
});
trackerServer.on('warning', function (err) {
    logger_1.logger.warn('Warning in tracker.', { err });
});
const onHttpRequest = trackerServer.onHttpRequest.bind(trackerServer);
trackerRouter.get('/tracker/announce', (req, res) => onHttpRequest(req, res, { action: 'announce' }));
trackerRouter.get('/tracker/scrape', (req, res) => onHttpRequest(req, res, { action: 'scrape' }));
function createWebsocketServer(app) {
    const server = http.createServer(app);
    const wss = new ws_1.Server({ server: server, path: '/tracker/socket' });
    wss.on('connection', function (ws, req) {
        const ip = proxyAddr(req, constants_1.CONFIG.TRUST_PROXY);
        ws['ip'] = ip;
        trackerServer.onWebSocketConnection(ws);
    });
    return server;
}
exports.createWebsocketServer = createWebsocketServer;
function runPeersChecker() {
    setInterval(() => {
        logger_1.logger.debug('Checking peers.');
        for (const ip of Object.keys(peersIpInfoHash)) {
            if (peersIps[ip] > constants_1.TRACKER_RATE_LIMITS.ANNOUNCES_PER_IP) {
                logger_1.logger.warn('Peer %s made abnormal requests (%d).', ip, peersIps[ip]);
            }
        }
        peersIpInfoHash = {};
        peersIps = {};
    }, constants_1.TRACKER_RATE_LIMITS.INTERVAL);
}
//# sourceMappingURL=tracker.js.map