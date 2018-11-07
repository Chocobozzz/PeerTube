"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const magnetUtil = require("magnet-uri");
require("mocha");
const utils_1 = require("../../utils");
const index_1 = require("../../utils/index");
const WebTorrent = require("webtorrent");
describe('Test tracker', function () {
    let server;
    let badMagnet;
    let goodMagnet;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield index_1.flushTests();
            server = yield utils_1.runServer(1);
            yield index_1.setAccessTokensToServers([server]);
            {
                const res = yield utils_1.uploadVideo(server.url, server.accessToken, {});
                const videoUUID = res.body.video.uuid;
                const resGet = yield utils_1.getVideo(server.url, videoUUID);
                const video = resGet.body;
                goodMagnet = video.files[0].magnetUri;
                const parsed = magnetUtil.decode(goodMagnet);
                parsed.infoHash = '010597bb88b1968a5693a4fa8267c592ca65f2e9';
                badMagnet = magnetUtil.encode(parsed);
            }
        });
    });
    it('Should return an error when adding an incorrect infohash', done => {
        this.timeout(10000);
        const webtorrent = new WebTorrent();
        const torrent = webtorrent.add(badMagnet);
        torrent.on('error', done);
        torrent.on('warning', warn => {
            const message = typeof warn === 'string' ? warn : warn.message;
            if (message.indexOf('Unknown infoHash ') !== -1)
                return done();
        });
        torrent.on('done', () => done(new Error('No error on infohash')));
    });
    it('Should succeed with the correct infohash', done => {
        this.timeout(10000);
        const webtorrent = new WebTorrent();
        const torrent = webtorrent.add(goodMagnet);
        torrent.on('error', done);
        torrent.on('warning', warn => {
            const message = typeof warn === 'string' ? warn : warn.message;
            if (message.indexOf('Unknown infoHash ') !== -1)
                return done(new Error('Error on infohash'));
        });
        torrent.on('done', done);
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers([server]);
        });
    });
});
