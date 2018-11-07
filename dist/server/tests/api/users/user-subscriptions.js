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
const login_1 = require("../../utils/users/login");
const jobs_1 = require("../../utils/server/jobs");
const user_subscriptions_1 = require("../../utils/users/user-subscriptions");
const expect = chai.expect;
describe('Test users subscriptions', function () {
    let servers = [];
    const users = [];
    let video3UUID;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(120000);
            servers = yield utils_1.flushAndRunMultipleServers(3);
            yield login_1.setAccessTokensToServers(servers);
            yield utils_1.doubleFollow(servers[0], servers[1]);
            {
                for (const server of servers) {
                    const user = { username: 'user' + server.serverNumber, password: 'password' };
                    yield utils_1.createUser(server.url, server.accessToken, user.username, user.password);
                    const accessToken = yield utils_1.userLogin(server, user);
                    users.push({ accessToken });
                    const videoName1 = 'video 1-' + server.serverNumber;
                    yield index_1.uploadVideo(server.url, accessToken, { name: videoName1 });
                    const videoName2 = 'video 2-' + server.serverNumber;
                    yield index_1.uploadVideo(server.url, accessToken, { name: videoName2 });
                }
            }
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should display videos of server 2 on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.getVideosList(servers[0].url);
            expect(res.body.total).to.equal(4);
        });
    });
    it('User of server 1 should follow user of server 3 and root of server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield user_subscriptions_1.addUserSubscription(servers[0].url, users[0].accessToken, 'user3_channel@localhost:9003');
            yield user_subscriptions_1.addUserSubscription(servers[0].url, users[0].accessToken, 'root_channel@localhost:9001');
            yield jobs_1.waitJobs(servers);
            const res = yield index_1.uploadVideo(servers[2].url, users[2].accessToken, { name: 'video server 3 added after follow' });
            video3UUID = res.body.video.uuid;
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should not display videos of server 3 on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.getVideosList(servers[0].url);
            expect(res.body.total).to.equal(4);
            for (const video of res.body.data) {
                expect(video.name).to.not.contain('1-3');
                expect(video.name).to.not.contain('2-3');
                expect(video.name).to.not.contain('video server 3 added after follow');
            }
        });
    });
    it('Should list subscriptions', function () {
        return __awaiter(this, void 0, void 0, function* () {
            {
                const res = yield user_subscriptions_1.listUserSubscriptions(servers[0].url, servers[0].accessToken);
                expect(res.body.total).to.equal(0);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.lengthOf(0);
            }
            {
                const res = yield user_subscriptions_1.listUserSubscriptions(servers[0].url, users[0].accessToken);
                expect(res.body.total).to.equal(2);
                const subscriptions = res.body.data;
                expect(subscriptions).to.be.an('array');
                expect(subscriptions).to.have.lengthOf(2);
                expect(subscriptions[0].name).to.equal('user3_channel');
                expect(subscriptions[1].name).to.equal('root_channel');
            }
        });
    });
    it('Should get subscription', function () {
        return __awaiter(this, void 0, void 0, function* () {
            {
                const res = yield user_subscriptions_1.getUserSubscription(servers[0].url, users[0].accessToken, 'user3_channel@localhost:9003');
                const videoChannel = res.body;
                expect(videoChannel.name).to.equal('user3_channel');
                expect(videoChannel.host).to.equal('localhost:9003');
                expect(videoChannel.displayName).to.equal('Main user3 channel');
                expect(videoChannel.followingCount).to.equal(0);
                expect(videoChannel.followersCount).to.equal(1);
            }
            {
                const res = yield user_subscriptions_1.getUserSubscription(servers[0].url, users[0].accessToken, 'root_channel@localhost:9001');
                const videoChannel = res.body;
                expect(videoChannel.name).to.equal('root_channel');
                expect(videoChannel.host).to.equal('localhost:9001');
                expect(videoChannel.displayName).to.equal('Main root channel');
                expect(videoChannel.followingCount).to.equal(0);
                expect(videoChannel.followersCount).to.equal(1);
            }
        });
    });
    it('Should return the existing subscriptions', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const uris = [
                'user3_channel@localhost:9003',
                'root2_channel@localhost:9001',
                'root_channel@localhost:9001',
                'user3_channel@localhost:9001'
            ];
            const res = yield user_subscriptions_1.areSubscriptionsExist(servers[0].url, users[0].accessToken, uris);
            const body = res.body;
            expect(body['user3_channel@localhost:9003']).to.be.true;
            expect(body['root2_channel@localhost:9001']).to.be.false;
            expect(body['root_channel@localhost:9001']).to.be.true;
            expect(body['user3_channel@localhost:9001']).to.be.false;
        });
    });
    it('Should list subscription videos', function () {
        return __awaiter(this, void 0, void 0, function* () {
            {
                const res = yield user_subscriptions_1.listUserSubscriptionVideos(servers[0].url, servers[0].accessToken);
                expect(res.body.total).to.equal(0);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.lengthOf(0);
            }
            {
                const res = yield user_subscriptions_1.listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt');
                expect(res.body.total).to.equal(3);
                const videos = res.body.data;
                expect(videos).to.be.an('array');
                expect(videos).to.have.lengthOf(3);
                expect(videos[0].name).to.equal('video 1-3');
                expect(videos[1].name).to.equal('video 2-3');
                expect(videos[2].name).to.equal('video server 3 added after follow');
            }
        });
    });
    it('Should upload a video by root on server 1 and see it in the subscription videos', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            const videoName = 'video server 1 added after follow';
            yield index_1.uploadVideo(servers[0].url, servers[0].accessToken, { name: videoName });
            yield jobs_1.waitJobs(servers);
            {
                const res = yield user_subscriptions_1.listUserSubscriptionVideos(servers[0].url, servers[0].accessToken);
                expect(res.body.total).to.equal(0);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.lengthOf(0);
            }
            {
                const res = yield user_subscriptions_1.listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt');
                expect(res.body.total).to.equal(4);
                const videos = res.body.data;
                expect(videos).to.be.an('array');
                expect(videos).to.have.lengthOf(4);
                expect(videos[0].name).to.equal('video 1-3');
                expect(videos[1].name).to.equal('video 2-3');
                expect(videos[2].name).to.equal('video server 3 added after follow');
                expect(videos[3].name).to.equal('video server 1 added after follow');
            }
            {
                const res = yield utils_1.getVideosList(servers[0].url);
                expect(res.body.total).to.equal(5);
                for (const video of res.body.data) {
                    expect(video.name).to.not.contain('1-3');
                    expect(video.name).to.not.contain('2-3');
                    expect(video.name).to.not.contain('video server 3 added after follow');
                }
            }
        });
    });
    it('Should have server 1 follow server 3 and display server 3 videos', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield utils_1.follow(servers[0].url, [servers[2].url], servers[0].accessToken);
            yield jobs_1.waitJobs(servers);
            const res = yield utils_1.getVideosList(servers[0].url);
            expect(res.body.total).to.equal(8);
            const names = ['1-3', '2-3', 'video server 3 added after follow'];
            for (const name of names) {
                const video = res.body.data.find(v => v.name.indexOf(name) === -1);
                expect(video).to.not.be.undefined;
            }
        });
    });
    it('Should remove follow server 1 -> server 3 and hide server 3 videos', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield utils_1.unfollow(servers[0].url, servers[0].accessToken, servers[2]);
            yield jobs_1.waitJobs(servers);
            const res = yield utils_1.getVideosList(servers[0].url);
            expect(res.body.total).to.equal(5);
            for (const video of res.body.data) {
                expect(video.name).to.not.contain('1-3');
                expect(video.name).to.not.contain('2-3');
                expect(video.name).to.not.contain('video server 3 added after follow');
            }
        });
    });
    it('Should still list subscription videos', function () {
        return __awaiter(this, void 0, void 0, function* () {
            {
                const res = yield user_subscriptions_1.listUserSubscriptionVideos(servers[0].url, servers[0].accessToken);
                expect(res.body.total).to.equal(0);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.lengthOf(0);
            }
            {
                const res = yield user_subscriptions_1.listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt');
                expect(res.body.total).to.equal(4);
                const videos = res.body.data;
                expect(videos).to.be.an('array');
                expect(videos).to.have.lengthOf(4);
                expect(videos[0].name).to.equal('video 1-3');
                expect(videos[1].name).to.equal('video 2-3');
                expect(videos[2].name).to.equal('video server 3 added after follow');
                expect(videos[3].name).to.equal('video server 1 added after follow');
            }
        });
    });
    it('Should update a video of server 3 and see the updated video on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.updateVideo(servers[2].url, users[2].accessToken, video3UUID, { name: 'video server 3 added after follow updated' });
            yield jobs_1.waitJobs(servers);
            const res = yield user_subscriptions_1.listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt');
            const videos = res.body.data;
            expect(videos[2].name).to.equal('video server 3 added after follow updated');
        });
    });
    it('Should remove user of server 3 subscription', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield user_subscriptions_1.removeUserSubscription(servers[0].url, users[0].accessToken, 'user3_channel@localhost:9003');
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should not display its videos anymore', function () {
        return __awaiter(this, void 0, void 0, function* () {
            {
                const res = yield user_subscriptions_1.listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt');
                expect(res.body.total).to.equal(1);
                const videos = res.body.data;
                expect(videos).to.be.an('array');
                expect(videos).to.have.lengthOf(1);
                expect(videos[0].name).to.equal('video server 1 added after follow');
            }
        });
    });
    it('Should remove the root subscription and not display the videos anymore', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield user_subscriptions_1.removeUserSubscription(servers[0].url, users[0].accessToken, 'root_channel@localhost:9001');
            yield jobs_1.waitJobs(servers);
            {
                const res = yield user_subscriptions_1.listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt');
                expect(res.body.total).to.equal(0);
                const videos = res.body.data;
                expect(videos).to.be.an('array');
                expect(videos).to.have.lengthOf(0);
            }
        });
    });
    it('Should correctly display public videos on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.getVideosList(servers[0].url);
            expect(res.body.total).to.equal(5);
            for (const video of res.body.data) {
                expect(video.name).to.not.contain('1-3');
                expect(video.name).to.not.contain('2-3');
                expect(video.name).to.not.contain('video server 3 added after follow updated');
            }
        });
    });
    it('Should follow user of server 3 again', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield user_subscriptions_1.addUserSubscription(servers[0].url, users[0].accessToken, 'user3_channel@localhost:9003');
            yield jobs_1.waitJobs(servers);
            {
                const res = yield user_subscriptions_1.listUserSubscriptionVideos(servers[0].url, users[0].accessToken, 'createdAt');
                expect(res.body.total).to.equal(3);
                const videos = res.body.data;
                expect(videos).to.be.an('array');
                expect(videos).to.have.lengthOf(3);
                expect(videos[0].name).to.equal('video 1-3');
                expect(videos[1].name).to.equal('video 2-3');
                expect(videos[2].name).to.equal('video server 3 added after follow updated');
            }
            {
                const res = yield utils_1.getVideosList(servers[0].url);
                expect(res.body.total).to.equal(5);
                for (const video of res.body.data) {
                    expect(video.name).to.not.contain('1-3');
                    expect(video.name).to.not.contain('2-3');
                    expect(video.name).to.not.contain('video server 3 added after follow updated');
                }
            }
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers(servers);
        });
    });
});
//# sourceMappingURL=user-subscriptions.js.map