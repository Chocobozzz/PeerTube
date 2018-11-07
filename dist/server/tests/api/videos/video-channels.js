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
const jobs_1 = require("../../utils/server/jobs");
const expect = chai.expect;
describe('Test video channels', function () {
    let servers;
    let userInfo;
    let accountUUID;
    let firstVideoChannelId;
    let secondVideoChannelId;
    let videoUUID;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield index_1.flushTests();
            servers = yield utils_1.flushAndRunMultipleServers(2);
            yield index_1.setAccessTokensToServers(servers);
            yield utils_1.doubleFollow(servers[0], servers[1]);
            {
                const res = yield index_1.getMyUserInformation(servers[0].url, servers[0].accessToken);
                const user = res.body;
                accountUUID = user.account.uuid;
                firstVideoChannelId = user.videoChannels[0].id;
            }
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should have one video channel (created with root)', () => __awaiter(this, void 0, void 0, function* () {
        const res = yield index_1.getVideoChannelsList(servers[0].url, 0, 2);
        expect(res.body.total).to.equal(1);
        expect(res.body.data).to.be.an('array');
        expect(res.body.data).to.have.lengthOf(1);
    }));
    it('Should create another video channel', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            {
                const videoChannel = {
                    name: 'second_video_channel',
                    displayName: 'second video channel',
                    description: 'super video channel description',
                    support: 'super video channel support text'
                };
                const res = yield index_1.addVideoChannel(servers[0].url, servers[0].accessToken, videoChannel);
                secondVideoChannelId = res.body.videoChannel.id;
            }
            {
                const res = yield utils_1.uploadVideo(servers[0].url, servers[0].accessToken, { name: 'my video name', channelId: secondVideoChannelId });
                videoUUID = res.body.video.uuid;
            }
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should have two video channels when getting my information', () => __awaiter(this, void 0, void 0, function* () {
        const res = yield index_1.getMyUserInformation(servers[0].url, servers[0].accessToken);
        userInfo = res.body;
        expect(userInfo.videoChannels).to.be.an('array');
        expect(userInfo.videoChannels).to.have.lengthOf(2);
        const videoChannels = userInfo.videoChannels;
        expect(videoChannels[0].name).to.equal('root_channel');
        expect(videoChannels[0].displayName).to.equal('Main root channel');
        expect(videoChannels[1].name).to.equal('second_video_channel');
        expect(videoChannels[1].displayName).to.equal('second video channel');
        expect(videoChannels[1].description).to.equal('super video channel description');
        expect(videoChannels[1].support).to.equal('super video channel support text');
    }));
    it('Should have two video channels when getting account channels on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.getAccountVideoChannelsList(servers[0].url, userInfo.account.name + '@' + userInfo.account.host);
            expect(res.body.total).to.equal(2);
            expect(res.body.data).to.be.an('array');
            expect(res.body.data).to.have.lengthOf(2);
            const videoChannels = res.body.data;
            expect(videoChannels[0].name).to.equal('root_channel');
            expect(videoChannels[0].displayName).to.equal('Main root channel');
            expect(videoChannels[1].name).to.equal('second_video_channel');
            expect(videoChannels[1].displayName).to.equal('second video channel');
            expect(videoChannels[1].description).to.equal('super video channel description');
            expect(videoChannels[1].support).to.equal('super video channel support text');
        });
    });
    it('Should have one video channel when getting account channels on server 2', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.getAccountVideoChannelsList(servers[1].url, userInfo.account.name + '@' + userInfo.account.host);
            expect(res.body.total).to.equal(1);
            expect(res.body.data).to.be.an('array');
            expect(res.body.data).to.have.lengthOf(1);
            const videoChannels = res.body.data;
            expect(videoChannels[0].name).to.equal('second_video_channel');
            expect(videoChannels[0].displayName).to.equal('second video channel');
            expect(videoChannels[0].description).to.equal('super video channel description');
            expect(videoChannels[0].support).to.equal('super video channel support text');
        });
    });
    it('Should list video channels', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.getVideoChannelsList(servers[0].url, 1, 1, '-name');
            expect(res.body.total).to.equal(2);
            expect(res.body.data).to.be.an('array');
            expect(res.body.data).to.have.lengthOf(1);
            expect(res.body.data[0].name).to.equal('root_channel');
            expect(res.body.data[0].displayName).to.equal('Main root channel');
        });
    });
    it('Should update video channel', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(5000);
            const videoChannelAttributes = {
                displayName: 'video channel updated',
                description: 'video channel description updated',
                support: 'video channel support text updated'
            };
            yield index_1.updateVideoChannel(servers[0].url, servers[0].accessToken, 'second_video_channel', videoChannelAttributes);
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should have video channel updated', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of servers) {
                const res = yield index_1.getVideoChannelsList(server.url, 0, 1, '-name');
                expect(res.body.total).to.equal(2);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.lengthOf(1);
                expect(res.body.data[0].name).to.equal('second_video_channel');
                expect(res.body.data[0].displayName).to.equal('video channel updated');
                expect(res.body.data[0].description).to.equal('video channel description updated');
                expect(res.body.data[0].support).to.equal('video channel support text updated');
            }
        });
    });
    it('Should update video channel avatar', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(5000);
            const fixture = 'avatar.png';
            yield utils_1.updateVideoChannelAvatar({
                url: servers[0].url,
                accessToken: servers[0].accessToken,
                videoChannelName: 'second_video_channel',
                fixture
            });
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should have video channel avatar updated', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of servers) {
                const res = yield index_1.getVideoChannelsList(server.url, 0, 1, '-name');
                const videoChannel = res.body.data.find(c => c.id === secondVideoChannelId);
                yield utils_1.testImage(server.url, 'avatar-resized', videoChannel.avatar.path, '.png');
            }
        });
    });
    it('Should get video channel', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.getVideoChannel(servers[0].url, 'second_video_channel');
            const videoChannel = res.body;
            expect(videoChannel.name).to.equal('second_video_channel');
            expect(videoChannel.displayName).to.equal('video channel updated');
            expect(videoChannel.description).to.equal('video channel description updated');
            expect(videoChannel.support).to.equal('video channel support text updated');
        });
    });
    it('Should list the second video channel videos', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            for (const server of servers) {
                const channelURI = 'second_video_channel@localhost:9001';
                const res1 = yield utils_1.getVideoChannelVideos(server.url, server.accessToken, channelURI, 0, 5);
                expect(res1.body.total).to.equal(1);
                expect(res1.body.data).to.be.an('array');
                expect(res1.body.data).to.have.lengthOf(1);
                expect(res1.body.data[0].name).to.equal('my video name');
            }
        });
    });
    it('Should change the video channel of a video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            yield utils_1.updateVideo(servers[0].url, servers[0].accessToken, videoUUID, { channelId: firstVideoChannelId });
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should list the first video channel videos', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            for (const server of servers) {
                const secondChannelURI = 'second_video_channel@localhost:9001';
                const res1 = yield utils_1.getVideoChannelVideos(server.url, server.accessToken, secondChannelURI, 0, 5);
                expect(res1.body.total).to.equal(0);
                const channelURI = 'root_channel@localhost:9001';
                const res2 = yield utils_1.getVideoChannelVideos(server.url, server.accessToken, channelURI, 0, 5);
                expect(res2.body.total).to.equal(1);
                const videos = res2.body.data;
                expect(videos).to.be.an('array');
                expect(videos).to.have.lengthOf(1);
                expect(videos[0].name).to.equal('my video name');
            }
        });
    });
    it('Should delete video channel', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_1.deleteVideoChannel(servers[0].url, servers[0].accessToken, 'second_video_channel');
        });
    });
    it('Should have video channel deleted', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.getVideoChannelsList(servers[0].url, 0, 10);
            expect(res.body.total).to.equal(1);
            expect(res.body.data).to.be.an('array');
            expect(res.body.data).to.have.lengthOf(1);
            expect(res.body.data[0].displayName).to.equal('Main root channel');
        });
    });
    it('Should create the main channel with an uuid if there is a conflict', function () {
        return __awaiter(this, void 0, void 0, function* () {
            {
                const videoChannel = { name: 'toto_channel', displayName: 'My toto channel' };
                yield index_1.addVideoChannel(servers[0].url, servers[0].accessToken, videoChannel);
            }
            {
                yield utils_1.createUser(servers[0].url, servers[0].accessToken, 'toto', 'password');
                const accessToken = yield utils_1.userLogin(servers[0], { username: 'toto', password: 'password' });
                const res = yield index_1.getMyUserInformation(servers[0].url, accessToken);
                const videoChannel = res.body.videoChannels[0];
                expect(videoChannel.name).to.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
            }
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers(servers);
        });
    });
});
