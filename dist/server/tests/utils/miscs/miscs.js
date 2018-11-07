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
const chai = require("chai");
const path_1 = require("path");
const request = require("supertest");
const WebTorrent = require("webtorrent");
const fs_extra_1 = require("fs-extra");
const ffmpeg = require("fluent-ffmpeg");
const expect = chai.expect;
let webtorrent = new WebTorrent();
function immutableAssign(target, source) {
    return Object.assign({}, target, source);
}
exports.immutableAssign = immutableAssign;
function dateIsValid(dateString, interval = 300000) {
    const dateToCheck = new Date(dateString);
    const now = new Date();
    return Math.abs(now.getTime() - dateToCheck.getTime()) <= interval;
}
exports.dateIsValid = dateIsValid;
function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
exports.wait = wait;
function webtorrentAdd(torrent, refreshWebTorrent = false) {
    if (refreshWebTorrent === true)
        webtorrent = new WebTorrent();
    return new Promise(res => webtorrent.add(torrent, res));
}
exports.webtorrentAdd = webtorrentAdd;
function root() {
    return path_1.join(__dirname, '..', '..', '..', '..');
}
exports.root = root;
function testImage(url, imageName, imagePath, extension = '.jpg') {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield request(url)
            .get(imagePath)
            .expect(200);
        const body = res.body;
        const data = yield fs_extra_1.readFile(path_1.join(__dirname, '..', '..', 'fixtures', imageName + extension));
        const minLength = body.length - ((20 * body.length) / 100);
        const maxLength = body.length + ((20 * body.length) / 100);
        expect(data.length).to.be.above(minLength);
        expect(data.length).to.be.below(maxLength);
    });
}
exports.testImage = testImage;
function buildAbsoluteFixturePath(path, customTravisPath = false) {
    if (path_1.isAbsolute(path)) {
        return path;
    }
    if (customTravisPath && process.env.TRAVIS)
        return path_1.join(process.env.HOME, 'fixtures', path);
    return path_1.join(__dirname, '..', '..', 'fixtures', path);
}
exports.buildAbsoluteFixturePath = buildAbsoluteFixturePath;
function generateHighBitrateVideo() {
    return __awaiter(this, void 0, void 0, function* () {
        const tempFixturePath = buildAbsoluteFixturePath('video_high_bitrate_1080p.mp4', true);
        const exists = yield fs_extra_1.pathExists(tempFixturePath);
        if (!exists) {
            return new Promise((res, rej) => __awaiter(this, void 0, void 0, function* () {
                ffmpeg()
                    .outputOptions(['-f rawvideo', '-video_size 1920x1080', '-i /dev/urandom'])
                    .outputOptions(['-ac 2', '-f s16le', '-i /dev/urandom', '-t 10'])
                    .outputOptions(['-maxrate 10M', '-bufsize 10M'])
                    .output(tempFixturePath)
                    .on('error', rej)
                    .on('end', () => res(tempFixturePath))
                    .run();
            }));
        }
        return tempFixturePath;
    });
}
exports.generateHighBitrateVideo = generateHighBitrateVideo;
//# sourceMappingURL=miscs.js.map