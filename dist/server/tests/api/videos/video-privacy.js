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
const video_privacy_enum_1 = require("../../../../shared/models/videos/video-privacy.enum");
const index_1 = require("../../utils/index");
const follows_1 = require("../../utils/server/follows");
const login_1 = require("../../utils/users/login");
const users_1 = require("../../utils/users/users");
const videos_1 = require("../../utils/videos/videos");
const jobs_1 = require("../../utils/server/jobs");
const expect = chai.expect;
describe('Test video privacy', function () {
    let servers = [];
    let privateVideoId;
    let privateVideoUUID;
    let unlistedVideoUUID;
    let now;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(50000);
            servers = yield index_1.flushAndRunMultipleServers(2);
            yield index_1.setAccessTokensToServers(servers);
            yield follows_1.doubleFollow(servers[0], servers[1]);
        });
    });
    it('Should upload a private video on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            const attributes = {
                privacy: video_privacy_enum_1.VideoPrivacy.PRIVATE
            };
            yield index_1.uploadVideo(servers[0].url, servers[0].accessToken, attributes);
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should not have this private video on server 2', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.getVideosList(servers[1].url);
            expect(res.body.total).to.equal(0);
            expect(res.body.data).to.have.lengthOf(0);
        });
    });
    it('Should list my (private) videos', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield videos_1.getMyVideos(servers[0].url, servers[0].accessToken, 0, 1);
            expect(res.body.total).to.equal(1);
            expect(res.body.data).to.have.lengthOf(1);
            privateVideoId = res.body.data[0].id;
            privateVideoUUID = res.body.data[0].uuid;
        });
    });
    it('Should not be able to watch this video with non authenticated user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield videos_1.getVideo(servers[0].url, privateVideoUUID, 401);
        });
    });
    it('Should not be able to watch this private video with another user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            const user = {
                username: 'hello',
                password: 'super password'
            };
            yield users_1.createUser(servers[0].url, servers[0].accessToken, user.username, user.password);
            const token = yield login_1.userLogin(servers[0], user);
            yield videos_1.getVideoWithToken(servers[0].url, token, privateVideoUUID, 403);
        });
    });
    it('Should be able to watch this video with the correct user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield videos_1.getVideoWithToken(servers[0].url, servers[0].accessToken, privateVideoUUID);
        });
    });
    it('Should upload an unlisted video on server 2', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            const attributes = {
                name: 'unlisted video',
                privacy: video_privacy_enum_1.VideoPrivacy.UNLISTED
            };
            yield index_1.uploadVideo(servers[1].url, servers[1].accessToken, attributes);
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should not have this unlisted video listed on server 1 and 2', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of servers) {
                const res = yield index_1.getVideosList(server.url);
                expect(res.body.total).to.equal(0);
                expect(res.body.data).to.have.lengthOf(0);
            }
        });
    });
    it('Should list my (unlisted) videos', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield videos_1.getMyVideos(servers[1].url, servers[1].accessToken, 0, 1);
            expect(res.body.total).to.equal(1);
            expect(res.body.data).to.have.lengthOf(1);
            unlistedVideoUUID = res.body.data[0].uuid;
        });
    });
    it('Should be able to get this unlisted video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of servers) {
                const res = yield videos_1.getVideo(server.url, unlistedVideoUUID);
                expect(res.body.name).to.equal('unlisted video');
            }
        });
    });
    it('Should update the private video to public on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            const attribute = {
                name: 'super video public',
                privacy: video_privacy_enum_1.VideoPrivacy.PUBLIC
            };
            now = Date.now();
            yield videos_1.updateVideo(servers[0].url, servers[0].accessToken, privateVideoId, attribute);
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should have this new public video listed on server 1 and 2', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of servers) {
                const res = yield index_1.getVideosList(server.url);
                expect(res.body.total).to.equal(1);
                expect(res.body.data).to.have.lengthOf(1);
                expect(res.body.data[0].name).to.equal('super video public');
                expect(new Date(res.body.data[0].publishedAt).getTime()).to.be.at.least(now);
            }
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers(servers);
        });
    });
});
//# sourceMappingURL=video-privacy.js.map