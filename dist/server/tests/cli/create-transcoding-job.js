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
describe('Test create transcoding jobs', function () {
    let servers = [];
    let video1UUID;
    let video2UUID;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield utils_1.flushTests();
            servers = yield utils_1.flushAndRunMultipleServers(2);
            yield utils_1.setAccessTokensToServers(servers);
            yield utils_1.doubleFollow(servers[0], servers[1]);
            const res1 = yield utils_1.uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video1' });
            video1UUID = res1.body.video.uuid;
            const res2 = yield utils_1.uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video2' });
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
    it('Should run a transcoding job on video 2', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            const env = utils_1.getEnvCli(servers[0]);
            yield utils_1.execCLI(`${env} npm run create-transcoding-job -- -v ${video2UUID}`);
            yield jobs_1.waitJobs(servers);
            for (const server of servers) {
                const res = yield utils_1.getVideosList(server.url);
                const videos = res.body.data;
                expect(videos).to.have.lengthOf(2);
                let infoHashes;
                for (const video of videos) {
                    const res2 = yield utils_1.getVideo(server.url, video.uuid);
                    const videoDetail = res2.body;
                    if (video.uuid === video2UUID) {
                        expect(videoDetail.files).to.have.lengthOf(4);
                        if (!infoHashes) {
                            infoHashes = {};
                            for (const file of videoDetail.files) {
                                infoHashes[file.resolution.id.toString()] = file.magnetUri;
                            }
                        }
                        else {
                            for (const resolution of Object.keys(infoHashes)) {
                                const file = videoDetail.files.find(f => f.resolution.id.toString() === resolution);
                                expect(file.magnetUri).to.equal(infoHashes[resolution]);
                            }
                        }
                    }
                    else {
                        expect(videoDetail.files).to.have.lengthOf(1);
                    }
                }
            }
        });
    });
    it('Should run a transcoding job on video 1 with resolution', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            const env = utils_1.getEnvCli(servers[0]);
            yield utils_1.execCLI(`${env} npm run create-transcoding-job -- -v ${video1UUID} -r 480`);
            yield jobs_1.waitJobs(servers);
            for (const server of servers) {
                const res = yield utils_1.getVideosList(server.url);
                const videos = res.body.data;
                expect(videos).to.have.lengthOf(2);
                const res2 = yield utils_1.getVideo(server.url, video1UUID);
                const videoDetail = res2.body;
                expect(videoDetail.files).to.have.lengthOf(2);
                expect(videoDetail.files[0].resolution.id).to.equal(720);
                expect(videoDetail.files[1].resolution.id).to.equal(480);
            }
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers(servers);
        });
    });
});
//# sourceMappingURL=create-transcoding-job.js.map