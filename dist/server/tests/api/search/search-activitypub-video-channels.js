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
const video_channels_1 = require("../../utils/search/video-channels");
const expect = chai.expect;
describe('Test a ActivityPub video channels search', function () {
    let servers;
    let userServer2Token;
    let videoServer2UUID;
    let channelIdServer2;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(120000);
            yield utils_1.flushTests();
            servers = yield utils_1.flushAndRunMultipleServers(2);
            yield utils_1.setAccessTokensToServers(servers);
            {
                yield utils_1.createUser(servers[0].url, servers[0].accessToken, 'user1_server1', 'password');
                const channel = {
                    name: 'channel1_server1',
                    displayName: 'Channel 1 server 1'
                };
                yield utils_1.addVideoChannel(servers[0].url, servers[0].accessToken, channel);
            }
            {
                const user = { username: 'user1_server2', password: 'password' };
                yield utils_1.createUser(servers[1].url, servers[1].accessToken, user.username, user.password);
                userServer2Token = yield utils_1.userLogin(servers[1], user);
                const channel = {
                    name: 'channel1_server2',
                    displayName: 'Channel 1 server 2'
                };
                const resChannel = yield utils_1.addVideoChannel(servers[1].url, userServer2Token, channel);
                channelIdServer2 = resChannel.body.videoChannel.id;
                const res = yield utils_1.uploadVideo(servers[1].url, userServer2Token, { name: 'video 1 server 2', channelId: channelIdServer2 });
                videoServer2UUID = res.body.video.uuid;
            }
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should not find a remote video channel', function () {
        return __awaiter(this, void 0, void 0, function* () {
            {
                const search = 'http://localhost:9002/video-channels/channel1_server3';
                const res = yield video_channels_1.searchVideoChannel(servers[0].url, search, servers[0].accessToken);
                expect(res.body.total).to.equal(0);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.lengthOf(0);
            }
            {
                const search = 'http://localhost:9002/video-channels/channel1_server2';
                const res = yield video_channels_1.searchVideoChannel(servers[0].url, search);
                expect(res.body.total).to.equal(0);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.lengthOf(0);
            }
        });
    });
    it('Should search a local video channel', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const searches = [
                'http://localhost:9001/video-channels/channel1_server1',
                'channel1_server1@localhost:9001'
            ];
            for (const search of searches) {
                const res = yield video_channels_1.searchVideoChannel(servers[0].url, search);
                expect(res.body.total).to.equal(1);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.lengthOf(1);
                expect(res.body.data[0].name).to.equal('channel1_server1');
                expect(res.body.data[0].displayName).to.equal('Channel 1 server 1');
            }
        });
    });
    it('Should search a remote video channel with URL or handle', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const searches = [
                'http://localhost:9002/video-channels/channel1_server2',
                'channel1_server2@localhost:9002'
            ];
            for (const search of searches) {
                const res = yield video_channels_1.searchVideoChannel(servers[0].url, search, servers[0].accessToken);
                expect(res.body.total).to.equal(1);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.lengthOf(1);
                expect(res.body.data[0].name).to.equal('channel1_server2');
                expect(res.body.data[0].displayName).to.equal('Channel 1 server 2');
            }
        });
    });
    it('Should not list this remote video channel', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.getVideoChannelsList(servers[0].url, 0, 5);
            expect(res.body.total).to.equal(3);
            expect(res.body.data).to.have.lengthOf(3);
            expect(res.body.data[0].name).to.equal('channel1_server1');
            expect(res.body.data[1].name).to.equal('user1_server1_channel');
            expect(res.body.data[2].name).to.equal('root_channel');
        });
    });
    it('Should list video channel videos of server 2 without token', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield jobs_1.waitJobs(servers);
            const res = yield utils_1.getVideoChannelVideos(servers[0].url, null, 'channel1_server2@localhost:9002', 0, 5);
            expect(res.body.total).to.equal(0);
            expect(res.body.data).to.have.lengthOf(0);
        });
    });
    it('Should list video channel videos of server 2 with token', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.getVideoChannelVideos(servers[0].url, servers[0].accessToken, 'channel1_server2@localhost:9002', 0, 5);
            expect(res.body.total).to.equal(1);
            expect(res.body.data[0].name).to.equal('video 1 server 2');
        });
    });
    it('Should update video channel of server 2, and refresh it on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield utils_1.updateVideoChannel(servers[1].url, userServer2Token, 'channel1_server2', { displayName: 'channel updated' });
            yield utils_1.updateMyUser({ url: servers[1].url, accessToken: userServer2Token, displayName: 'user updated' });
            yield jobs_1.waitJobs(servers);
            yield utils_1.wait(10000);
            const search = 'http://localhost:9002/video-channels/channel1_server2';
            const res = yield video_channels_1.searchVideoChannel(servers[0].url, search, servers[0].accessToken);
            expect(res.body.total).to.equal(1);
            expect(res.body.data).to.have.lengthOf(1);
            const videoChannel = res.body.data[0];
            expect(videoChannel.displayName).to.equal('channel updated');
        });
    });
    it('Should update and add a video on server 2, and update it on server 1 after a search', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield utils_1.updateVideo(servers[1].url, userServer2Token, videoServer2UUID, { name: 'video 1 updated' });
            yield utils_1.uploadVideo(servers[1].url, userServer2Token, { name: 'video 2 server 2', channelId: channelIdServer2 });
            yield jobs_1.waitJobs(servers);
            yield utils_1.wait(10000);
            const search = 'http://localhost:9002/video-channels/channel1_server2';
            yield video_channels_1.searchVideoChannel(servers[0].url, search, servers[0].accessToken);
            yield jobs_1.waitJobs(servers);
            const res = yield utils_1.getVideoChannelVideos(servers[0].url, servers[0].accessToken, 'channel1_server2@localhost:9002', 0, 5, '-createdAt');
            expect(res.body.total).to.equal(2);
            expect(res.body.data[0].name).to.equal('video 2 server 2');
            expect(res.body.data[1].name).to.equal('video 1 updated');
        });
    });
    it('Should delete video channel of server 2, and delete it on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield utils_1.deleteVideoChannel(servers[1].url, userServer2Token, 'channel1_server2');
            yield jobs_1.waitJobs(servers);
            yield utils_1.wait(10000);
            const res = yield video_channels_1.searchVideoChannel(servers[0].url, 'http://localhost:9002/video-channels/channel1_server2', servers[0].accessToken);
            expect(res.body.total).to.equal(0);
            expect(res.body.data).to.have.lengthOf(0);
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers(servers);
            if (this['ok']) {
                yield utils_1.flushTests();
            }
        });
    });
});
