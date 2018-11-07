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
const index_1 = require("../../utils/index");
const follows_1 = require("../../utils/server/follows");
const jobs_1 = require("../../utils/server/jobs");
const expect = chai.expect;
describe('Test video blacklists', function () {
    let servers = [];
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(50000);
            servers = yield index_1.flushAndRunMultipleServers(2);
            yield index_1.setAccessTokensToServers(servers);
            yield follows_1.doubleFollow(servers[0], servers[1]);
            const videoAttributes = {
                name: 'my super name for server 2',
                description: 'my super description for server 2'
            };
            yield index_1.uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes);
            yield jobs_1.waitJobs(servers);
            const res = yield index_1.getVideosList(servers[0].url);
            const videos = res.body.data;
            expect(videos.length).to.equal(1);
            servers[0].remoteVideo = videos.find(video => video.name === 'my super name for server 2');
        });
    });
    it('Should blacklist a remote video on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_1.addVideoToBlacklist(servers[0].url, servers[0].accessToken, servers[0].remoteVideo.id);
        });
    });
    it('Should not have the video blacklisted in videos list on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.getVideosList(servers[0].url);
            expect(res.body.total).to.equal(0);
            expect(res.body.data).to.be.an('array');
            expect(res.body.data.length).to.equal(0);
        });
    });
    it('Should not have the video blacklisted in videos search on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.searchVideo(servers[0].url, 'name');
            expect(res.body.total).to.equal(0);
            expect(res.body.data).to.be.an('array');
            expect(res.body.data.length).to.equal(0);
        });
    });
    it('Should have the blacklisted video in videos list on server 2', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.getVideosList(servers[1].url);
            expect(res.body.total).to.equal(1);
            expect(res.body.data).to.be.an('array');
            expect(res.body.data.length).to.equal(1);
        });
    });
    it('Should have the video blacklisted in videos search on server 2', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.searchVideo(servers[1].url, 'name');
            expect(res.body.total).to.equal(1);
            expect(res.body.data).to.be.an('array');
            expect(res.body.data.length).to.equal(1);
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers(servers);
        });
    });
});
//# sourceMappingURL=video-blacklist.js.map