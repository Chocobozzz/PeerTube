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
describe('Test video description', function () {
    let servers = [];
    let videoUUID = '';
    let videoId;
    let longDescription = 'my super description for server 1'.repeat(50);
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(40000);
            servers = yield index_1.flushAndRunMultipleServers(2);
            yield index_1.setAccessTokensToServers(servers);
            yield follows_1.doubleFollow(servers[0], servers[1]);
        });
    });
    it('Should upload video with long description', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            const attributes = {
                description: longDescription
            };
            yield index_1.uploadVideo(servers[0].url, servers[0].accessToken, attributes);
            yield jobs_1.waitJobs(servers);
            const res = yield index_1.getVideosList(servers[0].url);
            videoId = res.body.data[0].id;
            videoUUID = res.body.data[0].uuid;
        });
    });
    it('Should have a truncated description on each server', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of servers) {
                const res = yield index_1.getVideo(server.url, videoUUID);
                const video = res.body;
                const truncatedDescription = 'my super description for server 1'.repeat(7) +
                    'my super descrip...';
                expect(video.description).to.equal(truncatedDescription);
            }
        });
    });
    it('Should fetch long description on each server', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of servers) {
                const res = yield index_1.getVideo(server.url, videoUUID);
                const video = res.body;
                const res2 = yield index_1.getVideoDescription(server.url, video.descriptionPath);
                expect(res2.body.description).to.equal(longDescription);
            }
        });
    });
    it('Should update with a short description', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            const attributes = {
                description: 'short description'
            };
            yield index_1.updateVideo(servers[0].url, servers[0].accessToken, videoId, attributes);
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should have a small description on each server', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of servers) {
                const res = yield index_1.getVideo(server.url, videoUUID);
                const video = res.body;
                expect(video.description).to.equal('short description');
                const res2 = yield index_1.getVideoDescription(server.url, video.descriptionPath);
                expect(res2.body.description).to.equal('short description');
            }
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers(servers);
        });
    });
});
