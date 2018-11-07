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
const lodash = require("lodash");
require("mocha");
const index_1 = require("../../utils/index");
const follows_1 = require("../../utils/server/follows");
const jobs_1 = require("../../utils/server/jobs");
const expect = chai.expect;
const orderBy = lodash.orderBy;
describe('Test video blacklist management', function () {
    let servers = [];
    let videoId;
    function blacklistVideosOnServer(server) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.getVideosList(server.url);
            const videos = res.body.data;
            for (let video of videos) {
                yield index_1.addVideoToBlacklist(server.url, server.accessToken, video.id, 'super reason');
            }
        });
    }
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(50000);
            servers = yield index_1.flushAndRunMultipleServers(2);
            yield index_1.setAccessTokensToServers(servers);
            yield follows_1.doubleFollow(servers[0], servers[1]);
            yield index_1.uploadVideo(servers[1].url, servers[1].accessToken, { name: 'My 1st video', description: 'A video on server 2' });
            yield index_1.uploadVideo(servers[1].url, servers[1].accessToken, { name: 'My 2nd video', description: 'A video on server 2' });
            yield jobs_1.waitJobs(servers);
            yield blacklistVideosOnServer(servers[0]);
        });
    });
    describe('When listing blacklisted videos', function () {
        it('Should display all the blacklisted videos', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield index_1.getBlacklistedVideosList(servers[0].url, servers[0].accessToken);
                expect(res.body.total).to.equal(2);
                const blacklistedVideos = res.body.data;
                expect(blacklistedVideos).to.be.an('array');
                expect(blacklistedVideos.length).to.equal(2);
                for (const blacklistedVideo of blacklistedVideos) {
                    expect(blacklistedVideo.reason).to.equal('super reason');
                    videoId = blacklistedVideo.video.id;
                }
            });
        });
        it('Should get the correct sort when sorting by descending id', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield index_1.getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, '-id');
                expect(res.body.total).to.equal(2);
                const blacklistedVideos = res.body.data;
                expect(blacklistedVideos).to.be.an('array');
                expect(blacklistedVideos.length).to.equal(2);
                const result = orderBy(res.body.data, ['id'], ['desc']);
                expect(blacklistedVideos).to.deep.equal(result);
            });
        });
        it('Should get the correct sort when sorting by descending video name', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield index_1.getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, '-name');
                expect(res.body.total).to.equal(2);
                const blacklistedVideos = res.body.data;
                expect(blacklistedVideos).to.be.an('array');
                expect(blacklistedVideos.length).to.equal(2);
                const result = orderBy(res.body.data, ['name'], ['desc']);
                expect(blacklistedVideos).to.deep.equal(result);
            });
        });
        it('Should get the correct sort when sorting by ascending creation date', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield index_1.getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, 'createdAt');
                expect(res.body.total).to.equal(2);
                const blacklistedVideos = res.body.data;
                expect(blacklistedVideos).to.be.an('array');
                expect(blacklistedVideos.length).to.equal(2);
                const result = orderBy(res.body.data, ['createdAt']);
                expect(blacklistedVideos).to.deep.equal(result);
            });
        });
    });
    describe('When updating blacklisted videos', function () {
        it('Should change the reason', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield index_1.updateVideoBlacklist(servers[0].url, servers[0].accessToken, videoId, 'my super reason updated');
                const res = yield index_1.getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, '-name');
                const video = res.body.data.find(b => b.video.id === videoId);
                expect(video.reason).to.equal('my super reason updated');
            });
        });
    });
    describe('When listing my videos', function () {
        it('Should display blacklisted videos', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield blacklistVideosOnServer(servers[1]);
                const res = yield index_1.getMyVideos(servers[1].url, servers[1].accessToken, 0, 5);
                expect(res.body.total).to.equal(2);
                expect(res.body.data).to.have.lengthOf(2);
                for (const video of res.body.data) {
                    expect(video.blacklisted).to.be.true;
                    expect(video.blacklistedReason).to.equal('super reason');
                }
            });
        });
    });
    describe('When removing a blacklisted video', function () {
        let videoToRemove;
        let blacklist = [];
        it('Should not have any video in videos list on server 1', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield index_1.getVideosList(servers[0].url);
                expect(res.body.total).to.equal(0);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data.length).to.equal(0);
            });
        });
        it('Should remove a video from the blacklist on server 1', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield index_1.getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, '-name');
                videoToRemove = res.body.data[0];
                blacklist = res.body.data.slice(1);
                yield index_1.removeVideoFromBlacklist(servers[0].url, servers[0].accessToken, videoToRemove.video.id);
            });
        });
        it('Should have the ex-blacklisted video in videos list on server 1', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield index_1.getVideosList(servers[0].url);
                expect(res.body.total).to.equal(1);
                const videos = res.body.data;
                expect(videos).to.be.an('array');
                expect(videos.length).to.equal(1);
                expect(videos[0].name).to.equal(videoToRemove.video.name);
                expect(videos[0].id).to.equal(videoToRemove.video.id);
            });
        });
        it('Should not have the ex-blacklisted video in videos blacklist list on server 1', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield index_1.getSortedBlacklistedVideosList(servers[0].url, servers[0].accessToken, '-name');
                expect(res.body.total).to.equal(1);
                const videos = res.body.data;
                expect(videos).to.be.an('array');
                expect(videos.length).to.equal(1);
                expect(videos).to.deep.equal(blacklist);
            });
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers(servers);
        });
    });
});
//# sourceMappingURL=video-blacklist-management.js.map