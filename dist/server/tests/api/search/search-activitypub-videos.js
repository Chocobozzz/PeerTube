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
const videos_1 = require("../../../../shared/models/videos");
const expect = chai.expect;
describe('Test a ActivityPub videos search', function () {
    let servers;
    let videoServer1UUID;
    let videoServer2UUID;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(120000);
            yield utils_1.flushTests();
            servers = yield utils_1.flushAndRunMultipleServers(2);
            yield utils_1.setAccessTokensToServers(servers);
            {
                const res = yield utils_1.uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video 1 on server 1' });
                videoServer1UUID = res.body.video.uuid;
            }
            {
                const res = yield utils_1.uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video 1 on server 2' });
                videoServer2UUID = res.body.video.uuid;
            }
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should not find a remote video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            {
                const res = yield utils_1.searchVideoWithToken(servers[0].url, 'http://localhost:9002/videos/watch/43', servers[0].accessToken);
                expect(res.body.total).to.equal(0);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.lengthOf(0);
            }
            {
                const res = yield utils_1.searchVideo(servers[0].url, 'http://localhost:9002/videos/watch/' + videoServer2UUID);
                expect(res.body.total).to.equal(0);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.lengthOf(0);
            }
        });
    });
    it('Should search a local video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.searchVideo(servers[0].url, 'http://localhost:9001/videos/watch/' + videoServer1UUID);
            expect(res.body.total).to.equal(1);
            expect(res.body.data).to.be.an('array');
            expect(res.body.data).to.have.lengthOf(1);
            expect(res.body.data[0].name).to.equal('video 1 on server 1');
        });
    });
    it('Should search a remote video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.searchVideoWithToken(servers[0].url, 'http://localhost:9002/videos/watch/' + videoServer2UUID, servers[0].accessToken);
            expect(res.body.total).to.equal(1);
            expect(res.body.data).to.be.an('array');
            expect(res.body.data).to.have.lengthOf(1);
            expect(res.body.data[0].name).to.equal('video 1 on server 2');
        });
    });
    it('Should not list this remote video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.getVideosList(servers[0].url);
            expect(res.body.total).to.equal(1);
            expect(res.body.data).to.have.lengthOf(1);
            expect(res.body.data[0].name).to.equal('video 1 on server 1');
        });
    });
    it('Should update video of server 2, and refresh it on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            const channelAttributes = {
                name: 'super_channel',
                displayName: 'super channel'
            };
            const resChannel = yield utils_1.addVideoChannel(servers[1].url, servers[1].accessToken, channelAttributes);
            const videoChannelId = resChannel.body.videoChannel.id;
            const attributes = {
                name: 'updated',
                tag: ['tag1', 'tag2'],
                privacy: videos_1.VideoPrivacy.UNLISTED,
                channelId: videoChannelId
            };
            yield utils_1.updateVideo(servers[1].url, servers[1].accessToken, videoServer2UUID, attributes);
            yield jobs_1.waitJobs(servers);
            yield utils_1.wait(10000);
            yield utils_1.searchVideoWithToken(servers[0].url, 'http://localhost:9002/videos/watch/' + videoServer2UUID, servers[0].accessToken);
            yield utils_1.wait(5000);
            const res = yield utils_1.searchVideoWithToken(servers[0].url, 'http://localhost:9002/videos/watch/' + videoServer2UUID, servers[0].accessToken);
            expect(res.body.total).to.equal(1);
            expect(res.body.data).to.have.lengthOf(1);
            const video = res.body.data[0];
            expect(video.name).to.equal('updated');
            expect(video.channel.name).to.equal('super_channel');
            expect(video.privacy.id).to.equal(videos_1.VideoPrivacy.UNLISTED);
        });
    });
    it('Should delete video of server 2, and delete it on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield utils_1.removeVideo(servers[1].url, servers[1].accessToken, videoServer2UUID);
            yield jobs_1.waitJobs(servers);
            yield utils_1.wait(10000);
            yield utils_1.searchVideoWithToken(servers[0].url, 'http://localhost:9002/videos/watch/' + videoServer2UUID, servers[0].accessToken);
            yield utils_1.wait(5000);
            const res = yield utils_1.searchVideoWithToken(servers[0].url, 'http://localhost:9002/videos/watch/' + videoServer2UUID, servers[0].accessToken);
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
