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
const jobs_1 = require("../../utils/server/jobs");
const expect = chai.expect;
describe('Test video change ownership - nominal', function () {
    let servers = [];
    const firstUser = {
        username: 'first',
        password: 'My great password'
    };
    const secondUser = {
        username: 'second',
        password: 'My other password'
    };
    let firstUserAccessToken = '';
    let secondUserAccessToken = '';
    let lastRequestChangeOwnershipId = undefined;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(50000);
            servers = yield utils_1.flushAndRunMultipleServers(2);
            yield utils_1.setAccessTokensToServers(servers);
            const videoQuota = 42000000;
            yield utils_1.createUser(servers[0].url, servers[0].accessToken, firstUser.username, firstUser.password, videoQuota);
            yield utils_1.createUser(servers[0].url, servers[0].accessToken, secondUser.username, secondUser.password, videoQuota);
            firstUserAccessToken = yield utils_1.userLogin(servers[0], firstUser);
            secondUserAccessToken = yield utils_1.userLogin(servers[0], secondUser);
            const videoAttributes = {
                name: 'my super name',
                description: 'my super description'
            };
            yield utils_1.uploadVideo(servers[0].url, firstUserAccessToken, videoAttributes);
            yield jobs_1.waitJobs(servers);
            const res = yield utils_1.getVideosList(servers[0].url);
            const videos = res.body.data;
            expect(videos.length).to.equal(1);
            const video = videos.find(video => video.name === 'my super name');
            expect(video.channel.name).to.equal('first_channel');
            servers[0].video = video;
            yield utils_1.doubleFollow(servers[0], servers[1]);
        });
    });
    it('Should not have video change ownership', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const resFirstUser = yield utils_1.getVideoChangeOwnershipList(servers[0].url, firstUserAccessToken);
            expect(resFirstUser.body.total).to.equal(0);
            expect(resFirstUser.body.data).to.be.an('array');
            expect(resFirstUser.body.data.length).to.equal(0);
            const resSecondUser = yield utils_1.getVideoChangeOwnershipList(servers[0].url, secondUserAccessToken);
            expect(resSecondUser.body.total).to.equal(0);
            expect(resSecondUser.body.data).to.be.an('array');
            expect(resSecondUser.body.data.length).to.equal(0);
        });
    });
    it('Should send a request to change ownership of a video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(15000);
            yield utils_1.changeVideoOwnership(servers[0].url, firstUserAccessToken, servers[0].video.id, secondUser.username);
        });
    });
    it('Should only return a request to change ownership for the second user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const resFirstUser = yield utils_1.getVideoChangeOwnershipList(servers[0].url, firstUserAccessToken);
            expect(resFirstUser.body.total).to.equal(0);
            expect(resFirstUser.body.data).to.be.an('array');
            expect(resFirstUser.body.data.length).to.equal(0);
            const resSecondUser = yield utils_1.getVideoChangeOwnershipList(servers[0].url, secondUserAccessToken);
            expect(resSecondUser.body.total).to.equal(1);
            expect(resSecondUser.body.data).to.be.an('array');
            expect(resSecondUser.body.data.length).to.equal(1);
            lastRequestChangeOwnershipId = resSecondUser.body.data[0].id;
        });
    });
    it('Should accept the same change ownership request without crashing', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            yield utils_1.changeVideoOwnership(servers[0].url, firstUserAccessToken, servers[0].video.id, secondUser.username);
        });
    });
    it('Should not create multiple change ownership requests while one is waiting', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            const resSecondUser = yield utils_1.getVideoChangeOwnershipList(servers[0].url, secondUserAccessToken);
            expect(resSecondUser.body.total).to.equal(1);
            expect(resSecondUser.body.data).to.be.an('array');
            expect(resSecondUser.body.data.length).to.equal(1);
        });
    });
    it('Should not be possible to refuse the change of ownership from first user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            yield utils_1.refuseChangeOwnership(servers[0].url, firstUserAccessToken, lastRequestChangeOwnershipId, 403);
        });
    });
    it('Should be possible to refuse the change of ownership from second user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            yield utils_1.refuseChangeOwnership(servers[0].url, secondUserAccessToken, lastRequestChangeOwnershipId);
        });
    });
    it('Should send a new request to change ownership of a video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(15000);
            yield utils_1.changeVideoOwnership(servers[0].url, firstUserAccessToken, servers[0].video.id, secondUser.username);
        });
    });
    it('Should return two requests to change ownership for the second user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const resFirstUser = yield utils_1.getVideoChangeOwnershipList(servers[0].url, firstUserAccessToken);
            expect(resFirstUser.body.total).to.equal(0);
            expect(resFirstUser.body.data).to.be.an('array');
            expect(resFirstUser.body.data.length).to.equal(0);
            const resSecondUser = yield utils_1.getVideoChangeOwnershipList(servers[0].url, secondUserAccessToken);
            expect(resSecondUser.body.total).to.equal(2);
            expect(resSecondUser.body.data).to.be.an('array');
            expect(resSecondUser.body.data.length).to.equal(2);
            lastRequestChangeOwnershipId = resSecondUser.body.data[0].id;
        });
    });
    it('Should not be possible to accept the change of ownership from first user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            const secondUserInformationResponse = yield utils_1.getMyUserInformation(servers[0].url, secondUserAccessToken);
            const secondUserInformation = secondUserInformationResponse.body;
            const channelId = secondUserInformation.videoChannels[0].id;
            yield utils_1.acceptChangeOwnership(servers[0].url, firstUserAccessToken, lastRequestChangeOwnershipId, channelId, 403);
        });
    });
    it('Should be possible to accept the change of ownership from second user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            const secondUserInformationResponse = yield utils_1.getMyUserInformation(servers[0].url, secondUserAccessToken);
            const secondUserInformation = secondUserInformationResponse.body;
            const channelId = secondUserInformation.videoChannels[0].id;
            yield utils_1.acceptChangeOwnership(servers[0].url, secondUserAccessToken, lastRequestChangeOwnershipId, channelId);
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should have video channel updated', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of servers) {
                const res = yield utils_1.getVideo(server.url, servers[0].video.uuid);
                const video = res.body;
                expect(video.name).to.equal('my super name');
                expect(video.channel.displayName).to.equal('Main second channel');
                expect(video.channel.name).to.equal('second_channel');
            }
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers(servers);
        });
    });
});
describe('Test video change ownership - quota too small', function () {
    let server = undefined;
    const firstUser = {
        username: 'first',
        password: 'My great password'
    };
    const secondUser = {
        username: 'second',
        password: 'My other password'
    };
    let firstUserAccessToken = '';
    let secondUserAccessToken = '';
    let lastRequestChangeOwnershipId = undefined;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(50000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            const videoQuota = 42000000;
            const limitedVideoQuota = 10;
            yield utils_1.createUser(server.url, server.accessToken, firstUser.username, firstUser.password, videoQuota);
            yield utils_1.createUser(server.url, server.accessToken, secondUser.username, secondUser.password, limitedVideoQuota);
            firstUserAccessToken = yield utils_1.userLogin(server, firstUser);
            secondUserAccessToken = yield utils_1.userLogin(server, secondUser);
            const video1Attributes = {
                name: 'my super name',
                description: 'my super description'
            };
            yield utils_1.uploadVideo(server.url, firstUserAccessToken, video1Attributes);
            yield jobs_1.waitJobs(server);
            const res = yield utils_1.getVideosList(server.url);
            const videos = res.body.data;
            expect(videos.length).to.equal(1);
            server.video = videos.find(video => video.name === 'my super name');
        });
    });
    it('Should send a request to change ownership of a video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(15000);
            yield utils_1.changeVideoOwnership(server.url, firstUserAccessToken, server.video.id, secondUser.username);
        });
    });
    it('Should only return a request to change ownership for the second user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const resFirstUser = yield utils_1.getVideoChangeOwnershipList(server.url, firstUserAccessToken);
            expect(resFirstUser.body.total).to.equal(0);
            expect(resFirstUser.body.data).to.be.an('array');
            expect(resFirstUser.body.data.length).to.equal(0);
            const resSecondUser = yield utils_1.getVideoChangeOwnershipList(server.url, secondUserAccessToken);
            expect(resSecondUser.body.total).to.equal(1);
            expect(resSecondUser.body.data).to.be.an('array');
            expect(resSecondUser.body.data.length).to.equal(1);
            lastRequestChangeOwnershipId = resSecondUser.body.data[0].id;
        });
    });
    it('Should not be possible to accept the change of ownership from second user because of exceeded quota', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            const secondUserInformationResponse = yield utils_1.getMyUserInformation(server.url, secondUserAccessToken);
            const secondUserInformation = secondUserInformationResponse.body;
            const channelId = secondUserInformation.videoChannels[0].id;
            yield utils_1.acceptChangeOwnership(server.url, secondUserAccessToken, lastRequestChangeOwnershipId, channelId, 403);
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers([server]);
        });
    });
});
