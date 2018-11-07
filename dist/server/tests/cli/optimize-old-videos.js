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
require("mocha");
const chai = require("chai");
const videos_1 = require("../../../shared/models/videos");
const utils_1 = require("../utils");
const jobs_1 = require("../utils/server/jobs");
const ffmpeg_utils_1 = require("../../helpers/ffmpeg-utils");
const initializers_1 = require("../../initializers");
const path_1 = require("path");
const expect = chai.expect;
describe('Test optimize old videos', function () {
    let servers = [];
    let video1UUID;
    let video2UUID;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(200000);
            yield utils_1.flushTests();
            servers = yield utils_1.flushAndRunMultipleServers(2);
            yield utils_1.setAccessTokensToServers(servers);
            yield utils_1.doubleFollow(servers[0], servers[1]);
            let tempFixturePath;
            {
                tempFixturePath = yield utils_1.generateHighBitrateVideo();
                const bitrate = yield ffmpeg_utils_1.getVideoFileBitrate(tempFixturePath);
                expect(bitrate).to.be.above(videos_1.getMaxBitrate(videos_1.VideoResolution.H_1080P, 60, initializers_1.VIDEO_TRANSCODING_FPS));
            }
            const res1 = yield utils_1.uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video1', fixture: tempFixturePath });
            video1UUID = res1.body.video.uuid;
            const res2 = yield utils_1.uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video2', fixture: tempFixturePath });
            video2UUID = res2.body.video.uuid;
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should have two video files on each server', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            for (const server of servers) {
                const res = yield utils_1.getVideosList(server.url);
                const videos = res.body.data;
                expect(videos).to.have.lengthOf(2);
                for (const video of videos) {
                    const res2 = yield utils_1.getVideo(server.url, video.uuid);
                    const videoDetail = res2.body;
                    expect(videoDetail.files).to.have.lengthOf(1);
                }
            }
        });
    });
    it('Should run optimize script', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(120000);
            const env = utils_1.getEnvCli(servers[0]);
            yield utils_1.execCLI(`${env} npm run optimize-old-videos`);
            yield jobs_1.waitJobs(servers);
            for (const server of servers) {
                const res = yield utils_1.getVideosList(server.url);
                const videos = res.body.data;
                expect(videos).to.have.lengthOf(2);
                for (const video of videos) {
                    yield utils_1.viewVideo(server.url, video.uuid);
                    yield jobs_1.waitJobs(servers);
                    yield utils_1.wait(5000);
                    yield jobs_1.waitJobs(servers);
                    const res2 = yield utils_1.getVideo(server.url, video.uuid);
                    const videosDetails = res2.body;
                    expect(videosDetails.files).to.have.lengthOf(1);
                    const file = videosDetails.files[0];
                    expect(file.size).to.be.below(5000000);
                    const path = path_1.join(utils_1.root(), 'test1', 'videos', video.uuid + '-' + file.resolution.id + '.mp4');
                    const bitrate = yield ffmpeg_utils_1.getVideoFileBitrate(path);
                    const fps = yield ffmpeg_utils_1.getVideoFileFPS(path);
                    const resolution = yield ffmpeg_utils_1.getVideoFileResolution(path);
                    expect(resolution.videoFileResolution).to.equal(file.resolution.id);
                    expect(bitrate).to.be.below(videos_1.getMaxBitrate(resolution.videoFileResolution, fps, initializers_1.VIDEO_TRANSCODING_FPS));
                }
            }
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers(servers);
        });
    });
});
//# sourceMappingURL=optimize-old-videos.js.map