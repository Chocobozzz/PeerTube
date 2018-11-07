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
const videos_1 = require("../../../../shared/models/videos");
const utils_1 = require("../../utils");
const index_1 = require("../../utils/index");
const follows_1 = require("../../utils/server/follows");
const jobs_1 = require("../../utils/server/jobs");
const video_comments_1 = require("../../utils/videos/video-comments");
const expect = chai.expect;
describe('Test handle downs', function () {
    let servers = [];
    let threadIdServer1;
    let threadIdServer2;
    let commentIdServer1;
    let commentIdServer2;
    let missedVideo1;
    let missedVideo2;
    let unlistedVideo;
    const videoAttributes = {
        name: 'my super name for server 1',
        category: 5,
        licence: 4,
        language: 'ja',
        nsfw: true,
        privacy: videos_1.VideoPrivacy.PUBLIC,
        description: 'my super description for server 1',
        support: 'my super support text for server 1',
        tags: ['tag1p1', 'tag2p1'],
        fixture: 'video_short1.webm'
    };
    const unlistedVideoAttributes = utils_1.immutableAssign(videoAttributes, {
        privacy: videos_1.VideoPrivacy.UNLISTED
    });
    const checkAttributes = {
        name: 'my super name for server 1',
        category: 5,
        licence: 4,
        language: 'ja',
        nsfw: true,
        description: 'my super description for server 1',
        support: 'my super support text for server 1',
        account: {
            name: 'root',
            host: 'localhost:9001'
        },
        isLocal: false,
        duration: 10,
        tags: ['tag1p1', 'tag2p1'],
        privacy: videos_1.VideoPrivacy.PUBLIC,
        commentsEnabled: true,
        channel: {
            name: 'root_channel',
            displayName: 'Main root channel',
            description: '',
            isLocal: false
        },
        fixture: 'video_short1.webm',
        files: [
            {
                resolution: 720,
                size: 572456
            }
        ]
    };
    const unlistedCheckAttributes = utils_1.immutableAssign(checkAttributes, {
        privacy: videos_1.VideoPrivacy.UNLISTED
    });
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            servers = yield index_1.flushAndRunMultipleServers(3);
            yield index_1.setAccessTokensToServers(servers);
        });
    });
    it('Should remove followers that are often down', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield follows_1.follow(servers[1].url, [servers[0].url], servers[1].accessToken);
            yield follows_1.follow(servers[2].url, [servers[0].url], servers[2].accessToken);
            yield jobs_1.waitJobs(servers);
            yield index_1.uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes);
            yield jobs_1.waitJobs(servers);
            for (const server of servers) {
                const res = yield index_1.getVideosList(server.url);
                expect(res.body.data).to.be.an('array');
                expect(res.body.data).to.have.lengthOf(1);
            }
            index_1.killallServers([servers[1]]);
            for (let i = 0; i < 10; i++) {
                yield index_1.uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes);
            }
            yield jobs_1.waitJobs(servers[0]);
            index_1.killallServers([servers[2]]);
            const resLastVideo1 = yield index_1.uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes);
            missedVideo1 = resLastVideo1.body.video;
            const resLastVideo2 = yield index_1.uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes);
            missedVideo2 = resLastVideo2.body.video;
            let resVideo = yield index_1.uploadVideo(servers[0].url, servers[0].accessToken, unlistedVideoAttributes);
            unlistedVideo = resVideo.body.video;
            {
                const text = 'thread 1';
                let resComment = yield video_comments_1.addVideoCommentThread(servers[0].url, servers[0].accessToken, missedVideo2.uuid, text);
                let comment = resComment.body.comment;
                threadIdServer1 = comment.id;
                resComment = yield video_comments_1.addVideoCommentReply(servers[0].url, servers[0].accessToken, missedVideo2.uuid, comment.id, 'comment 1-1');
                comment = resComment.body.comment;
                resComment = yield video_comments_1.addVideoCommentReply(servers[0].url, servers[0].accessToken, missedVideo2.uuid, comment.id, 'comment 1-2');
                commentIdServer1 = resComment.body.comment.id;
            }
            yield jobs_1.waitJobs(servers[0]);
            yield index_1.wait(11000);
            const res = yield follows_1.getFollowersListPaginationAndSort(servers[0].url, 0, 2, 'createdAt');
            expect(res.body.data).to.be.an('array');
            expect(res.body.data).to.have.lengthOf(1);
            expect(res.body.data[0].follower.host).to.equal('localhost:9003');
        });
    });
    it('Should not have pending/processing jobs anymore', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const states = ['waiting', 'active'];
            for (const state of states) {
                const res = yield jobs_1.getJobsListPaginationAndSort(servers[0].url, servers[0].accessToken, state, 0, 50, '-createdAt');
                expect(res.body.data).to.have.length(0);
            }
        });
    });
    it('Should re-follow server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(35000);
            yield utils_1.reRunServer(servers[1]);
            yield utils_1.reRunServer(servers[2]);
            yield utils_1.unfollow(servers[1].url, servers[1].accessToken, servers[0]);
            yield jobs_1.waitJobs(servers);
            yield follows_1.follow(servers[1].url, [servers[0].url], servers[1].accessToken);
            yield jobs_1.waitJobs(servers);
            const res = yield follows_1.getFollowersListPaginationAndSort(servers[0].url, 0, 2, 'createdAt');
            expect(res.body.data).to.be.an('array');
            expect(res.body.data).to.have.lengthOf(2);
        });
    });
    it('Should send a view to server 3, and automatically fetch the video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(15000);
            const res1 = yield index_1.getVideosList(servers[2].url);
            expect(res1.body.data).to.be.an('array');
            expect(res1.body.data).to.have.lengthOf(11);
            yield utils_1.viewVideo(servers[0].url, missedVideo1.uuid);
            yield utils_1.viewVideo(servers[0].url, unlistedVideo.uuid);
            yield jobs_1.waitJobs(servers);
            const res = yield index_1.getVideosList(servers[2].url);
            expect(res.body.data).to.be.an('array');
            expect(res.body.data).to.have.lengthOf(12);
            const resVideo = yield utils_1.getVideo(servers[2].url, unlistedVideo.uuid);
            expect(resVideo.body).not.to.be.undefined;
            yield utils_1.completeVideoCheck(servers[2].url, resVideo.body, unlistedCheckAttributes);
        });
    });
    it('Should send comments on a video to server 3, and automatically fetch the video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(25000);
            yield video_comments_1.addVideoCommentReply(servers[0].url, servers[0].accessToken, missedVideo2.uuid, commentIdServer1, 'comment 1-3');
            yield jobs_1.waitJobs(servers);
            const resVideo = yield utils_1.getVideo(servers[2].url, missedVideo2.uuid);
            expect(resVideo.body).not.to.be.undefined;
            {
                let resComment = yield video_comments_1.getVideoCommentThreads(servers[2].url, missedVideo2.uuid, 0, 5);
                expect(resComment.body.data).to.be.an('array');
                expect(resComment.body.data).to.have.lengthOf(1);
                threadIdServer2 = resComment.body.data[0].id;
                resComment = yield video_comments_1.getVideoThreadComments(servers[2].url, missedVideo2.uuid, threadIdServer2);
                const tree = resComment.body;
                expect(tree.comment.text).equal('thread 1');
                expect(tree.children).to.have.lengthOf(1);
                const firstChild = tree.children[0];
                expect(firstChild.comment.text).to.equal('comment 1-1');
                expect(firstChild.children).to.have.lengthOf(1);
                const childOfFirstChild = firstChild.children[0];
                expect(childOfFirstChild.comment.text).to.equal('comment 1-2');
                expect(childOfFirstChild.children).to.have.lengthOf(1);
                const childOfChildFirstChild = childOfFirstChild.children[0];
                expect(childOfChildFirstChild.comment.text).to.equal('comment 1-3');
                expect(childOfChildFirstChild.children).to.have.lengthOf(0);
                commentIdServer2 = childOfChildFirstChild.comment.id;
            }
        });
    });
    it('Should correctly reply to the comment', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(15000);
            yield video_comments_1.addVideoCommentReply(servers[2].url, servers[2].accessToken, missedVideo2.uuid, commentIdServer2, 'comment 1-4');
            yield jobs_1.waitJobs(servers);
            {
                const resComment = yield video_comments_1.getVideoThreadComments(servers[0].url, missedVideo2.uuid, threadIdServer1);
                const tree = resComment.body;
                expect(tree.comment.text).equal('thread 1');
                expect(tree.children).to.have.lengthOf(1);
                const firstChild = tree.children[0];
                expect(firstChild.comment.text).to.equal('comment 1-1');
                expect(firstChild.children).to.have.lengthOf(1);
                const childOfFirstChild = firstChild.children[0];
                expect(childOfFirstChild.comment.text).to.equal('comment 1-2');
                expect(childOfFirstChild.children).to.have.lengthOf(1);
                const childOfChildFirstChild = childOfFirstChild.children[0];
                expect(childOfChildFirstChild.comment.text).to.equal('comment 1-3');
                expect(childOfChildFirstChild.children).to.have.lengthOf(1);
                const childOfChildOfChildOfFirstChild = childOfChildFirstChild.children[0];
                expect(childOfChildOfChildOfFirstChild.comment.text).to.equal('comment 1-4');
                expect(childOfChildOfChildOfFirstChild.children).to.have.lengthOf(0);
            }
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers(servers);
        });
    });
});
