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
const utils_1 = require("../utils");
const jobs_1 = require("../utils/server/jobs");
const expect = chai.expect;
function assertVideoProperties(video, resolution, extname, size) {
    expect(video).to.have.nested.property('resolution.id', resolution);
    expect(video).to.have.property('magnetUri').that.includes(`.${extname}`);
    expect(video).to.have.property('torrentUrl').that.includes(`-${resolution}.torrent`);
    expect(video).to.have.property('fileUrl').that.includes(`.${extname}`);
    expect(video).to.have.property('size').that.is.above(0);
    if (size)
        expect(video.size).to.equal(size);
}
describe('Test create import video jobs', function () {
    this.timeout(60000);
    let servers = [];
    let video1UUID;
    let video2UUID;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(90000);
            yield utils_1.flushTests();
            servers = yield utils_1.flushAndRunMultipleServers(2);
            yield utils_1.setAccessTokensToServers(servers);
            yield utils_1.doubleFollow(servers[0], servers[1]);
            const res1 = yield utils_1.uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video1' });
            video1UUID = res1.body.video.uuid;
            const res2 = yield utils_1.uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video2' });
            video2UUID = res2.body.video.uuid;
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should run a import job on video 1 with a lower resolution', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const env = utils_1.getEnvCli(servers[0]);
            yield utils_1.execCLI(`${env} npm run create-import-video-file-job -- -v ${video1UUID} -i server/tests/fixtures/video_short-480.webm`);
            yield jobs_1.waitJobs(servers);
            let magnetUri;
            for (const server of servers) {
                const { data: videos } = (yield utils_1.getVideosList(server.url)).body;
                expect(videos).to.have.lengthOf(2);
                const video = videos.find(({ uuid }) => uuid === video1UUID);
                const videoDetail = (yield utils_1.getVideo(server.url, video.uuid)).body;
                expect(videoDetail.files).to.have.lengthOf(2);
                const [originalVideo, transcodedVideo] = videoDetail.files;
                assertVideoProperties(originalVideo, 720, 'webm', 218910);
                assertVideoProperties(transcodedVideo, 480, 'webm', 69217);
                if (!magnetUri)
                    magnetUri = transcodedVideo.magnetUri;
                else
                    expect(transcodedVideo.magnetUri).to.equal(magnetUri);
            }
        });
    });
    it('Should run a import job on video 2 with the same resolution and a different extension', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const env = utils_1.getEnvCli(servers[1]);
            yield utils_1.execCLI(`${env} npm run create-import-video-file-job -- -v ${video2UUID} -i server/tests/fixtures/video_short.ogv`);
            yield jobs_1.waitJobs(servers);
            let magnetUri;
            for (const server of servers) {
                const { data: videos } = (yield utils_1.getVideosList(server.url)).body;
                expect(videos).to.have.lengthOf(2);
                const video = videos.find(({ uuid }) => uuid === video2UUID);
                const videoDetail = (yield utils_1.getVideo(server.url, video.uuid)).body;
                expect(videoDetail.files).to.have.lengthOf(4);
                const [originalVideo, transcodedVideo420, transcodedVideo320, transcodedVideo240] = videoDetail.files;
                assertVideoProperties(originalVideo, 720, 'ogv', 140849);
                assertVideoProperties(transcodedVideo420, 480, 'mp4');
                assertVideoProperties(transcodedVideo320, 360, 'mp4');
                assertVideoProperties(transcodedVideo240, 240, 'mp4');
                if (!magnetUri)
                    magnetUri = originalVideo.magnetUri;
                else
                    expect(originalVideo.magnetUri).to.equal(magnetUri);
            }
        });
    });
    it('Should run a import job on video 2 with the same resolution and the same extension', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const env = utils_1.getEnvCli(servers[0]);
            yield utils_1.execCLI(`${env} npm run create-import-video-file-job -- -v ${video1UUID} -i server/tests/fixtures/video_short2.webm`);
            yield jobs_1.waitJobs(servers);
            let magnetUri;
            for (const server of servers) {
                const { data: videos } = (yield utils_1.getVideosList(server.url)).body;
                expect(videos).to.have.lengthOf(2);
                const video = videos.find(({ uuid }) => uuid === video1UUID);
                const videoDetail = (yield utils_1.getVideo(server.url, video.uuid)).body;
                expect(videoDetail.files).to.have.lengthOf(2);
                const [video720, video480] = videoDetail.files;
                assertVideoProperties(video720, 720, 'webm', 942961);
                assertVideoProperties(video480, 480, 'webm', 69217);
                if (!magnetUri)
                    magnetUri = video720.magnetUri;
                else
                    expect(video720.magnetUri).to.equal(magnetUri);
            }
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers(servers);
        });
    });
});
