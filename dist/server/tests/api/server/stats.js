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
const index_1 = require("../../utils/index");
const stats_1 = require("../../utils/server/stats");
const video_comments_1 = require("../../utils/videos/video-comments");
const jobs_1 = require("../../utils/server/jobs");
const expect = chai.expect;
describe('Test stats (excluding redundancy)', function () {
    let servers = [];
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield index_1.flushTests();
            servers = yield utils_1.flushAndRunMultipleServers(3);
            yield index_1.setAccessTokensToServers(servers);
            yield utils_1.doubleFollow(servers[0], servers[1]);
            const user = {
                username: 'user1',
                password: 'super_password'
            };
            yield utils_1.createUser(servers[0].url, servers[0].accessToken, user.username, user.password);
            const resVideo = yield utils_1.uploadVideo(servers[0].url, servers[0].accessToken, {});
            const videoUUID = resVideo.body.video.uuid;
            yield video_comments_1.addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID, 'comment');
            yield utils_1.viewVideo(servers[0].url, videoUUID);
            yield utils_1.wait(8000);
            yield utils_1.follow(servers[2].url, [servers[0].url], servers[2].accessToken);
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should have the correct stats on instance 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield stats_1.getStats(servers[0].url);
            const data = res.body;
            expect(data.totalLocalVideoComments).to.equal(1);
            expect(data.totalLocalVideos).to.equal(1);
            expect(data.totalLocalVideoViews).to.equal(1);
            expect(data.totalUsers).to.equal(2);
            expect(data.totalVideoComments).to.equal(1);
            expect(data.totalVideos).to.equal(1);
            expect(data.totalInstanceFollowers).to.equal(2);
            expect(data.totalInstanceFollowing).to.equal(1);
        });
    });
    it('Should have the correct stats on instance 2', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield stats_1.getStats(servers[1].url);
            const data = res.body;
            expect(data.totalLocalVideoComments).to.equal(0);
            expect(data.totalLocalVideos).to.equal(0);
            expect(data.totalLocalVideoViews).to.equal(0);
            expect(data.totalUsers).to.equal(1);
            expect(data.totalVideoComments).to.equal(1);
            expect(data.totalVideos).to.equal(1);
            expect(data.totalInstanceFollowers).to.equal(1);
            expect(data.totalInstanceFollowing).to.equal(1);
        });
    });
    it('Should have the correct stats on instance 3', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield stats_1.getStats(servers[2].url);
            const data = res.body;
            expect(data.totalLocalVideoComments).to.equal(0);
            expect(data.totalLocalVideos).to.equal(0);
            expect(data.totalLocalVideoViews).to.equal(0);
            expect(data.totalUsers).to.equal(1);
            expect(data.totalVideoComments).to.equal(1);
            expect(data.totalVideos).to.equal(1);
            expect(data.totalInstanceFollowing).to.equal(1);
            expect(data.totalInstanceFollowers).to.equal(0);
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers(servers);
        });
    });
});
