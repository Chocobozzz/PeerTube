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
const magnetUtil = require("magnet-uri");
const redundancy_1 = require("../../utils/server/redundancy");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const stats_1 = require("../../utils/server/stats");
const expect = chai.expect;
let servers = [];
let video1Server2UUID;
function checkMagnetWebseeds(file, baseWebseeds, server) {
    const parsed = magnetUtil.decode(file.magnetUri);
    for (const ws of baseWebseeds) {
        const found = parsed.urlList.find(url => url === `${ws}-${file.resolution.id}.mp4`);
        expect(found, `Webseed ${ws} not found in ${file.magnetUri} on server ${server.url}`).to.not.be.undefined;
    }
    expect(parsed.urlList).to.have.lengthOf(baseWebseeds.length);
}
function runServers(strategy, additionalParams = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = {
            redundancy: {
                videos: {
                    check_interval: '5 seconds',
                    strategies: [
                        utils_1.immutableAssign({
                            min_lifetime: '1 hour',
                            strategy: strategy,
                            size: '100KB'
                        }, additionalParams)
                    ]
                }
            }
        };
        servers = yield utils_1.flushAndRunMultipleServers(3, config);
        yield utils_1.setAccessTokensToServers(servers);
        {
            const res = yield utils_1.uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video 1 server 2' });
            video1Server2UUID = res.body.video.uuid;
            yield utils_1.viewVideo(servers[1].url, video1Server2UUID);
        }
        yield jobs_1.waitJobs(servers);
        yield utils_1.doubleFollow(servers[0], servers[1]);
        yield utils_1.doubleFollow(servers[0], servers[2]);
        yield utils_1.doubleFollow(servers[1], servers[2]);
        yield jobs_1.waitJobs(servers);
    });
}
function check1WebSeed(strategy, videoUUID) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!videoUUID)
            videoUUID = video1Server2UUID;
        const webseeds = [
            'http://localhost:9002/static/webseed/' + videoUUID
        ];
        for (const server of servers) {
            {
                const res = yield utils_1.getVideo(server.url, videoUUID);
                const video = res.body;
                for (const f of video.files) {
                    checkMagnetWebseeds(f, webseeds, server);
                }
            }
        }
    });
}
function checkStatsWith2Webseed(strategy) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield stats_1.getStats(servers[0].url);
        const data = res.body;
        expect(data.videosRedundancy).to.have.lengthOf(1);
        const stat = data.videosRedundancy[0];
        expect(stat.strategy).to.equal(strategy);
        expect(stat.totalSize).to.equal(102400);
        expect(stat.totalUsed).to.be.at.least(1).and.below(102401);
        expect(stat.totalVideoFiles).to.equal(4);
        expect(stat.totalVideos).to.equal(1);
    });
}
function checkStatsWith1Webseed(strategy) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield stats_1.getStats(servers[0].url);
        const data = res.body;
        expect(data.videosRedundancy).to.have.lengthOf(1);
        const stat = data.videosRedundancy[0];
        expect(stat.strategy).to.equal(strategy);
        expect(stat.totalSize).to.equal(102400);
        expect(stat.totalUsed).to.equal(0);
        expect(stat.totalVideoFiles).to.equal(0);
        expect(stat.totalVideos).to.equal(0);
    });
}
function check2Webseeds(strategy, videoUUID) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!videoUUID)
            videoUUID = video1Server2UUID;
        const webseeds = [
            'http://localhost:9001/static/webseed/' + videoUUID,
            'http://localhost:9002/static/webseed/' + videoUUID
        ];
        for (const server of servers) {
            const res = yield utils_1.getVideo(server.url, videoUUID);
            const video = res.body;
            for (const file of video.files) {
                checkMagnetWebseeds(file, webseeds, server);
                if (server.serverNumber !== 3) {
                    yield utils_1.makeGetRequest({
                        url: server.url,
                        statusCodeExpected: 200,
                        path: '/static/webseed/' + `${videoUUID}-${file.resolution.id}.mp4`,
                        contentType: null
                    });
                }
            }
        }
        for (const directory of ['test1', 'test2']) {
            const files = yield fs_extra_1.readdir(path_1.join(utils_1.root(), directory, 'videos'));
            expect(files).to.have.length.at.least(4);
            for (const resolution of [240, 360, 480, 720]) {
                expect(files.find(f => f === `${videoUUID}-${resolution}.mp4`)).to.not.be.undefined;
            }
        }
    });
}
function enableRedundancyOnServer1() {
    return __awaiter(this, void 0, void 0, function* () {
        yield redundancy_1.updateRedundancy(servers[0].url, servers[0].accessToken, servers[1].host, true);
        const res = yield utils_1.getFollowingListPaginationAndSort(servers[0].url, 0, 5, '-createdAt');
        const follows = res.body.data;
        const server2 = follows.find(f => f.following.host === 'localhost:9002');
        const server3 = follows.find(f => f.following.host === 'localhost:9003');
        expect(server3).to.not.be.undefined;
        expect(server3.following.hostRedundancyAllowed).to.be.false;
        expect(server2).to.not.be.undefined;
        expect(server2.following.hostRedundancyAllowed).to.be.true;
    });
}
function disableRedundancyOnServer1() {
    return __awaiter(this, void 0, void 0, function* () {
        yield redundancy_1.updateRedundancy(servers[0].url, servers[0].accessToken, servers[1].host, false);
        const res = yield utils_1.getFollowingListPaginationAndSort(servers[0].url, 0, 5, '-createdAt');
        const follows = res.body.data;
        const server2 = follows.find(f => f.following.host === 'localhost:9002');
        const server3 = follows.find(f => f.following.host === 'localhost:9003');
        expect(server3).to.not.be.undefined;
        expect(server3.following.hostRedundancyAllowed).to.be.false;
        expect(server2).to.not.be.undefined;
        expect(server2.following.hostRedundancyAllowed).to.be.false;
    });
}
function cleanServers() {
    return __awaiter(this, void 0, void 0, function* () {
        utils_1.killallServers(servers);
    });
}
describe('Test videos redundancy', function () {
    describe('With most-views strategy', function () {
        const strategy = 'most-views';
        before(function () {
            this.timeout(120000);
            return runServers(strategy);
        });
        it('Should have 1 webseed on the first video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check1WebSeed(strategy);
                yield checkStatsWith1Webseed(strategy);
            });
        });
        it('Should enable redundancy on server 1', function () {
            return enableRedundancyOnServer1();
        });
        it('Should have 2 webseed on the first video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(40000);
                yield jobs_1.waitJobs(servers);
                yield utils_1.waitUntilLog(servers[0], 'Duplicated ', 4);
                yield jobs_1.waitJobs(servers);
                yield check2Webseeds(strategy);
                yield checkStatsWith2Webseed(strategy);
            });
        });
        it('Should undo redundancy on server 1 and remove duplicated videos', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(40000);
                yield disableRedundancyOnServer1();
                yield jobs_1.waitJobs(servers);
                yield utils_1.wait(5000);
                yield check1WebSeed(strategy);
                yield utils_1.checkVideoFilesWereRemoved(video1Server2UUID, servers[0].serverNumber, ['videos']);
            });
        });
        after(function () {
            return cleanServers();
        });
    });
    describe('With trending strategy', function () {
        const strategy = 'trending';
        before(function () {
            this.timeout(120000);
            return runServers(strategy);
        });
        it('Should have 1 webseed on the first video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check1WebSeed(strategy);
                yield checkStatsWith1Webseed(strategy);
            });
        });
        it('Should enable redundancy on server 1', function () {
            return enableRedundancyOnServer1();
        });
        it('Should have 2 webseed on the first video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(40000);
                yield jobs_1.waitJobs(servers);
                yield utils_1.waitUntilLog(servers[0], 'Duplicated ', 4);
                yield jobs_1.waitJobs(servers);
                yield check2Webseeds(strategy);
                yield checkStatsWith2Webseed(strategy);
            });
        });
        it('Should unfollow on server 1 and remove duplicated videos', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(40000);
                yield utils_1.unfollow(servers[0].url, servers[0].accessToken, servers[1]);
                yield jobs_1.waitJobs(servers);
                yield utils_1.wait(5000);
                yield check1WebSeed(strategy);
                yield utils_1.checkVideoFilesWereRemoved(video1Server2UUID, servers[0].serverNumber, ['videos']);
            });
        });
        after(function () {
            return cleanServers();
        });
    });
    describe('With recently added strategy', function () {
        const strategy = 'recently-added';
        before(function () {
            this.timeout(120000);
            return runServers(strategy, { min_views: 3 });
        });
        it('Should have 1 webseed on the first video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check1WebSeed(strategy);
                yield checkStatsWith1Webseed(strategy);
            });
        });
        it('Should enable redundancy on server 1', function () {
            return enableRedundancyOnServer1();
        });
        it('Should still have 1 webseed on the first video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(40000);
                yield jobs_1.waitJobs(servers);
                yield utils_1.wait(15000);
                yield jobs_1.waitJobs(servers);
                yield check1WebSeed(strategy);
                yield checkStatsWith1Webseed(strategy);
            });
        });
        it('Should view 2 times the first video to have > min_views config', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(40000);
                yield utils_1.viewVideo(servers[0].url, video1Server2UUID);
                yield utils_1.viewVideo(servers[2].url, video1Server2UUID);
                yield utils_1.wait(10000);
                yield jobs_1.waitJobs(servers);
            });
        });
        it('Should have 2 webseed on the first video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(40000);
                yield jobs_1.waitJobs(servers);
                yield utils_1.waitUntilLog(servers[0], 'Duplicated ', 4);
                yield jobs_1.waitJobs(servers);
                yield check2Webseeds(strategy);
                yield checkStatsWith2Webseed(strategy);
            });
        });
        it('Should remove the video and the redundancy files', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(20000);
                yield utils_1.removeVideo(servers[1].url, servers[1].accessToken, video1Server2UUID);
                yield jobs_1.waitJobs(servers);
                for (const server of servers) {
                    yield utils_1.checkVideoFilesWereRemoved(video1Server2UUID, server.serverNumber);
                }
            });
        });
        after(function () {
            return cleanServers();
        });
    });
    describe('Test expiration', function () {
        const strategy = 'recently-added';
        function checkContains(servers, str) {
            return __awaiter(this, void 0, void 0, function* () {
                for (const server of servers) {
                    const res = yield utils_1.getVideo(server.url, video1Server2UUID);
                    const video = res.body;
                    for (const f of video.files) {
                        expect(f.magnetUri).to.contain(str);
                    }
                }
            });
        }
        function checkNotContains(servers, str) {
            return __awaiter(this, void 0, void 0, function* () {
                for (const server of servers) {
                    const res = yield utils_1.getVideo(server.url, video1Server2UUID);
                    const video = res.body;
                    for (const f of video.files) {
                        expect(f.magnetUri).to.not.contain(str);
                    }
                }
            });
        }
        before(function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(120000);
                yield runServers(strategy, { min_lifetime: '7 seconds', min_views: 0 });
                yield enableRedundancyOnServer1();
            });
        });
        it('Should still have 2 webseeds after 10 seconds', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(40000);
                yield utils_1.wait(10000);
                try {
                    yield checkContains(servers, 'http%3A%2F%2Flocalhost%3A9001');
                }
                catch (_a) {
                    yield utils_1.wait(2000);
                    yield checkContains(servers, 'http%3A%2F%2Flocalhost%3A9001');
                }
            });
        });
        it('Should stop server 1 and expire video redundancy', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(40000);
                utils_1.killallServers([servers[0]]);
                yield utils_1.wait(10000);
                yield checkNotContains([servers[1], servers[2]], 'http%3A%2F%2Flocalhost%3A9001');
            });
        });
        after(function () {
            return utils_1.killallServers([servers[1], servers[2]]);
        });
    });
    describe('Test file replacement', function () {
        let video2Server2UUID;
        const strategy = 'recently-added';
        before(function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(120000);
                yield runServers(strategy, { min_lifetime: '7 seconds', min_views: 0 });
                yield enableRedundancyOnServer1();
                yield jobs_1.waitJobs(servers);
                yield utils_1.waitUntilLog(servers[0], 'Duplicated ', 4);
                yield jobs_1.waitJobs(servers);
                yield check2Webseeds(strategy);
                yield checkStatsWith2Webseed(strategy);
                const res = yield utils_1.uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video 2 server 2' });
                video2Server2UUID = res.body.video.uuid;
            });
        });
        it('Should cache video 2 webseed on the first video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(50000);
                yield jobs_1.waitJobs(servers);
                yield utils_1.wait(7000);
                try {
                    yield check1WebSeed(strategy, video1Server2UUID);
                    yield check2Webseeds(strategy, video2Server2UUID);
                }
                catch (_a) {
                    yield utils_1.wait(3000);
                    try {
                        yield check1WebSeed(strategy, video1Server2UUID);
                        yield check2Webseeds(strategy, video2Server2UUID);
                    }
                    catch (_b) {
                        yield utils_1.wait(5000);
                        yield check1WebSeed(strategy, video1Server2UUID);
                        yield check2Webseeds(strategy, video2Server2UUID);
                    }
                }
            });
        });
        after(function () {
            return cleanServers();
        });
    });
});
