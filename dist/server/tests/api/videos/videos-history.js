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
require("mocha");
const utils_1 = require("../../utils");
const video_history_1 = require("../../utils/videos/video-history");
const expect = chai.expect;
describe('Test videos history', function () {
    let server = null;
    let video1UUID;
    let video2UUID;
    let video3UUID;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            {
                const res = yield utils_1.uploadVideo(server.url, server.accessToken, { name: 'video 1' });
                video1UUID = res.body.video.uuid;
            }
            {
                const res = yield utils_1.uploadVideo(server.url, server.accessToken, { name: 'video 2' });
                video2UUID = res.body.video.uuid;
            }
            {
                const res = yield utils_1.uploadVideo(server.url, server.accessToken, { name: 'video 3' });
                video3UUID = res.body.video.uuid;
            }
        });
    });
    it('Should get videos, without watching history', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.getVideosListWithToken(server.url, server.accessToken);
            const videos = res.body.data;
            for (const video of videos) {
                const resDetail = yield utils_1.getVideoWithToken(server.url, server.accessToken, video.id);
                const videoDetails = resDetail.body;
                expect(video.userHistory).to.be.undefined;
                expect(videoDetails.userHistory).to.be.undefined;
            }
        });
    });
    it('Should watch the first and second video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield video_history_1.userWatchVideo(server.url, server.accessToken, video1UUID, 3);
            yield video_history_1.userWatchVideo(server.url, server.accessToken, video2UUID, 8);
        });
    });
    it('Should return the correct history when listing, searching and getting videos', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const videosOfVideos = [];
            {
                const res = yield utils_1.getVideosListWithToken(server.url, server.accessToken);
                videosOfVideos.push(res.body.data);
            }
            {
                const res = yield utils_1.searchVideoWithToken(server.url, 'video', server.accessToken);
                videosOfVideos.push(res.body.data);
            }
            for (const videos of videosOfVideos) {
                const video1 = videos.find(v => v.uuid === video1UUID);
                const video2 = videos.find(v => v.uuid === video2UUID);
                const video3 = videos.find(v => v.uuid === video3UUID);
                expect(video1.userHistory).to.not.be.undefined;
                expect(video1.userHistory.currentTime).to.equal(3);
                expect(video2.userHistory).to.not.be.undefined;
                expect(video2.userHistory.currentTime).to.equal(8);
                expect(video3.userHistory).to.be.undefined;
            }
            {
                const resDetail = yield utils_1.getVideoWithToken(server.url, server.accessToken, video1UUID);
                const videoDetails = resDetail.body;
                expect(videoDetails.userHistory).to.not.be.undefined;
                expect(videoDetails.userHistory.currentTime).to.equal(3);
            }
            {
                const resDetail = yield utils_1.getVideoWithToken(server.url, server.accessToken, video2UUID);
                const videoDetails = resDetail.body;
                expect(videoDetails.userHistory).to.not.be.undefined;
                expect(videoDetails.userHistory.currentTime).to.equal(8);
            }
            {
                const resDetail = yield utils_1.getVideoWithToken(server.url, server.accessToken, video3UUID);
                const videoDetails = resDetail.body;
                expect(videoDetails.userHistory).to.be.undefined;
            }
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers([server]);
            if (this['ok']) {
                yield utils_1.flushTests();
            }
        });
    });
});
