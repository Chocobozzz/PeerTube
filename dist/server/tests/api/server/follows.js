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
const miscs_1 = require("../../utils/miscs/miscs");
const follows_1 = require("../../utils/server/follows");
const accounts_1 = require("../../utils/users/accounts");
const login_1 = require("../../utils/users/login");
const users_1 = require("../../utils/users/users");
const video_comments_1 = require("../../utils/videos/video-comments");
const videos_2 = require("../../utils/videos/videos");
const jobs_1 = require("../../utils/server/jobs");
const video_captions_1 = require("../../utils/videos/video-captions");
const expect = chai.expect;
describe('Test follows', function () {
    let servers = [];
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            servers = yield index_1.flushAndRunMultipleServers(3);
            yield index_1.setAccessTokensToServers(servers);
        });
    });
    it('Should not have followers', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of servers) {
                const res = yield follows_1.getFollowersListPaginationAndSort(server.url, 0, 5, 'createdAt');
                const follows = res.body.data;
                expect(res.body.total).to.equal(0);
                expect(follows).to.be.an('array');
                expect(follows.length).to.equal(0);
            }
        });
    });
    it('Should not have following', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of servers) {
                const res = yield follows_1.getFollowingListPaginationAndSort(server.url, 0, 5, 'createdAt');
                const follows = res.body.data;
                expect(res.body.total).to.equal(0);
                expect(follows).to.be.an('array');
                expect(follows.length).to.equal(0);
            }
        });
    });
    it('Should have server 1 following server 2 and 3', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield follows_1.follow(servers[0].url, [servers[1].url, servers[2].url], servers[0].accessToken);
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should have 2 followings on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let res = yield follows_1.getFollowingListPaginationAndSort(servers[0].url, 0, 1, 'createdAt');
            let follows = res.body.data;
            expect(res.body.total).to.equal(2);
            expect(follows).to.be.an('array');
            expect(follows.length).to.equal(1);
            res = yield follows_1.getFollowingListPaginationAndSort(servers[0].url, 1, 1, 'createdAt');
            follows = follows.concat(res.body.data);
            const server2Follow = follows.find(f => f.following.host === 'localhost:9002');
            const server3Follow = follows.find(f => f.following.host === 'localhost:9003');
            expect(server2Follow).to.not.be.undefined;
            expect(server3Follow).to.not.be.undefined;
            expect(server2Follow.state).to.equal('accepted');
            expect(server3Follow.state).to.equal('accepted');
        });
    });
    it('Should search followings on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            {
                const res = yield follows_1.getFollowingListPaginationAndSort(servers[0].url, 0, 1, 'createdAt', ':9002');
                const follows = res.body.data;
                expect(res.body.total).to.equal(1);
                expect(follows.length).to.equal(1);
                expect(follows[0].following.host).to.equal('localhost:9002');
            }
            {
                const res = yield follows_1.getFollowingListPaginationAndSort(servers[0].url, 0, 1, 'createdAt', 'bla');
                const follows = res.body.data;
                expect(res.body.total).to.equal(0);
                expect(follows.length).to.equal(0);
            }
        });
    });
    it('Should have 0 followings on server 2 and 3', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of [servers[1], servers[2]]) {
                const res = yield follows_1.getFollowingListPaginationAndSort(server.url, 0, 5, 'createdAt');
                const follows = res.body.data;
                expect(res.body.total).to.equal(0);
                expect(follows).to.be.an('array');
                expect(follows.length).to.equal(0);
            }
        });
    });
    it('Should have 1 followers on server 2 and 3', function () {
        return __awaiter(this, void 0, void 0, function* () {
            for (const server of [servers[1], servers[2]]) {
                let res = yield follows_1.getFollowersListPaginationAndSort(server.url, 0, 1, 'createdAt');
                let follows = res.body.data;
                expect(res.body.total).to.equal(1);
                expect(follows).to.be.an('array');
                expect(follows.length).to.equal(1);
                expect(follows[0].follower.host).to.equal('localhost:9001');
            }
        });
    });
    it('Should search followers on server 2', function () {
        return __awaiter(this, void 0, void 0, function* () {
            {
                const res = yield follows_1.getFollowersListPaginationAndSort(servers[2].url, 0, 5, 'createdAt', '9001');
                const follows = res.body.data;
                expect(res.body.total).to.equal(1);
                expect(follows.length).to.equal(1);
                expect(follows[0].following.host).to.equal('localhost:9003');
            }
            {
                const res = yield follows_1.getFollowersListPaginationAndSort(servers[2].url, 0, 5, 'createdAt', 'bla');
                const follows = res.body.data;
                expect(res.body.total).to.equal(0);
                expect(follows.length).to.equal(0);
            }
        });
    });
    it('Should have 0 followers on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield follows_1.getFollowersListPaginationAndSort(servers[0].url, 0, 5, 'createdAt');
            const follows = res.body.data;
            expect(res.body.total).to.equal(0);
            expect(follows).to.be.an('array');
            expect(follows.length).to.equal(0);
        });
    });
    it('Should have the correct follows counts', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield accounts_1.expectAccountFollows(servers[0].url, 'peertube@localhost:9001', 0, 2);
            yield accounts_1.expectAccountFollows(servers[0].url, 'peertube@localhost:9002', 1, 0);
            yield accounts_1.expectAccountFollows(servers[0].url, 'peertube@localhost:9003', 1, 0);
            yield accounts_1.expectAccountFollows(servers[1].url, 'peertube@localhost:9001', 0, 1);
            yield accounts_1.expectAccountFollows(servers[1].url, 'peertube@localhost:9002', 1, 0);
            yield accounts_1.expectAccountFollows(servers[2].url, 'peertube@localhost:9001', 0, 1);
            yield accounts_1.expectAccountFollows(servers[2].url, 'peertube@localhost:9003', 1, 0);
        });
    });
    it('Should unfollow server 3 on server 1', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(5000);
            yield follows_1.unfollow(servers[0].url, servers[0].accessToken, servers[2]);
            yield jobs_1.waitJobs(servers);
        });
    });
    it('Should not follow server 3 on server 1 anymore', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield follows_1.getFollowingListPaginationAndSort(servers[0].url, 0, 2, 'createdAt');
            let follows = res.body.data;
            expect(res.body.total).to.equal(1);
            expect(follows).to.be.an('array');
            expect(follows.length).to.equal(1);
            expect(follows[0].following.host).to.equal('localhost:9002');
        });
    });
    it('Should not have server 1 as follower on server 3 anymore', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield follows_1.getFollowersListPaginationAndSort(servers[2].url, 0, 1, 'createdAt');
            let follows = res.body.data;
            expect(res.body.total).to.equal(0);
            expect(follows).to.be.an('array');
            expect(follows.length).to.equal(0);
        });
    });
    it('Should have the correct follows counts 2', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield accounts_1.expectAccountFollows(servers[0].url, 'peertube@localhost:9001', 0, 1);
            yield accounts_1.expectAccountFollows(servers[0].url, 'peertube@localhost:9002', 1, 0);
            yield accounts_1.expectAccountFollows(servers[1].url, 'peertube@localhost:9001', 0, 1);
            yield accounts_1.expectAccountFollows(servers[1].url, 'peertube@localhost:9002', 1, 0);
            yield accounts_1.expectAccountFollows(servers[2].url, 'peertube@localhost:9001', 0, 0);
            yield accounts_1.expectAccountFollows(servers[2].url, 'peertube@localhost:9003', 0, 0);
        });
    });
    it('Should upload a video on server 2 and 3 and propagate only the video of server 2', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(35000);
            yield index_1.uploadVideo(servers[1].url, servers[1].accessToken, { name: 'server2' });
            yield index_1.uploadVideo(servers[2].url, servers[2].accessToken, { name: 'server3' });
            yield jobs_1.waitJobs(servers);
            let res = yield index_1.getVideosList(servers[0].url);
            expect(res.body.total).to.equal(1);
            expect(res.body.data[0].name).to.equal('server2');
            res = yield index_1.getVideosList(servers[1].url);
            expect(res.body.total).to.equal(1);
            expect(res.body.data[0].name).to.equal('server2');
            res = yield index_1.getVideosList(servers[2].url);
            expect(res.body.total).to.equal(1);
            expect(res.body.data[0].name).to.equal('server3');
        });
    });
    describe('Should propagate data on a new following', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let video4;
            before(function () {
                return __awaiter(this, void 0, void 0, function* () {
                    this.timeout(20000);
                    const video4Attributes = {
                        name: 'server3-4',
                        category: 2,
                        nsfw: true,
                        licence: 6,
                        tags: ['tag1', 'tag2', 'tag3']
                    };
                    yield index_1.uploadVideo(servers[2].url, servers[2].accessToken, { name: 'server3-2' });
                    yield index_1.uploadVideo(servers[2].url, servers[2].accessToken, { name: 'server3-3' });
                    yield index_1.uploadVideo(servers[2].url, servers[2].accessToken, video4Attributes);
                    yield index_1.uploadVideo(servers[2].url, servers[2].accessToken, { name: 'server3-5' });
                    yield index_1.uploadVideo(servers[2].url, servers[2].accessToken, { name: 'server3-6' });
                    {
                        const user = { username: 'captain', password: 'password' };
                        yield users_1.createUser(servers[2].url, servers[2].accessToken, user.username, user.password);
                        const userAccessToken = yield login_1.userLogin(servers[2], user);
                        const resVideos = yield index_1.getVideosList(servers[2].url);
                        video4 = resVideos.body.data.find(v => v.name === 'server3-4');
                        {
                            yield videos_2.rateVideo(servers[2].url, servers[2].accessToken, video4.id, 'like');
                            yield videos_2.rateVideo(servers[2].url, userAccessToken, video4.id, 'dislike');
                        }
                        {
                            const text = 'my super first comment';
                            const res = yield video_comments_1.addVideoCommentThread(servers[2].url, servers[2].accessToken, video4.id, text);
                            const threadId = res.body.comment.id;
                            const text1 = 'my super answer to thread 1';
                            const childCommentRes = yield video_comments_1.addVideoCommentReply(servers[2].url, servers[2].accessToken, video4.id, threadId, text1);
                            const childCommentId = childCommentRes.body.comment.id;
                            const text2 = 'my super answer to answer of thread 1';
                            yield video_comments_1.addVideoCommentReply(servers[2].url, servers[2].accessToken, video4.id, childCommentId, text2);
                            const text3 = 'my second answer to thread 1';
                            yield video_comments_1.addVideoCommentReply(servers[2].url, servers[2].accessToken, video4.id, threadId, text3);
                        }
                        {
                            yield video_captions_1.createVideoCaption({
                                url: servers[2].url,
                                accessToken: servers[2].accessToken,
                                language: 'ar',
                                videoId: video4.id,
                                fixture: 'subtitle-good2.vtt'
                            });
                        }
                    }
                    yield jobs_1.waitJobs(servers);
                    yield follows_1.follow(servers[0].url, [servers[2].url], servers[0].accessToken);
                    yield jobs_1.waitJobs(servers);
                });
            });
            it('Should have the correct follows counts 3', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield accounts_1.expectAccountFollows(servers[0].url, 'peertube@localhost:9001', 0, 2);
                    yield accounts_1.expectAccountFollows(servers[0].url, 'peertube@localhost:9002', 1, 0);
                    yield accounts_1.expectAccountFollows(servers[0].url, 'peertube@localhost:9003', 1, 0);
                    yield accounts_1.expectAccountFollows(servers[1].url, 'peertube@localhost:9001', 0, 1);
                    yield accounts_1.expectAccountFollows(servers[1].url, 'peertube@localhost:9002', 1, 0);
                    yield accounts_1.expectAccountFollows(servers[2].url, 'peertube@localhost:9001', 0, 2);
                    yield accounts_1.expectAccountFollows(servers[2].url, 'peertube@localhost:9003', 1, 0);
                });
            });
            it('Should have propagated videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const res = yield index_1.getVideosList(servers[0].url);
                    expect(res.body.total).to.equal(7);
                    const video2 = res.body.data.find(v => v.name === 'server3-2');
                    video4 = res.body.data.find(v => v.name === 'server3-4');
                    const video6 = res.body.data.find(v => v.name === 'server3-6');
                    expect(video2).to.not.be.undefined;
                    expect(video4).to.not.be.undefined;
                    expect(video6).to.not.be.undefined;
                    const isLocal = false;
                    const checkAttributes = {
                        name: 'server3-4',
                        category: 2,
                        licence: 6,
                        language: 'zh',
                        nsfw: true,
                        description: 'my super description',
                        support: 'my super support text',
                        account: {
                            name: 'root',
                            host: 'localhost:9003'
                        },
                        isLocal,
                        commentsEnabled: true,
                        duration: 5,
                        tags: ['tag1', 'tag2', 'tag3'],
                        privacy: videos_1.VideoPrivacy.PUBLIC,
                        likes: 1,
                        dislikes: 1,
                        channel: {
                            displayName: 'Main root channel',
                            name: 'root_channel',
                            description: '',
                            isLocal
                        },
                        fixture: 'video_short.webm',
                        files: [
                            {
                                resolution: 720,
                                size: 218910
                            }
                        ]
                    };
                    yield utils_1.completeVideoCheck(servers[0].url, video4, checkAttributes);
                });
            });
            it('Should have propagated comments', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const res1 = yield video_comments_1.getVideoCommentThreads(servers[0].url, video4.id, 0, 5);
                    expect(res1.body.total).to.equal(1);
                    expect(res1.body.data).to.be.an('array');
                    expect(res1.body.data).to.have.lengthOf(1);
                    const comment = res1.body.data[0];
                    expect(comment.inReplyToCommentId).to.be.null;
                    expect(comment.text).equal('my super first comment');
                    expect(comment.videoId).to.equal(video4.id);
                    expect(comment.id).to.equal(comment.threadId);
                    expect(comment.account.name).to.equal('root');
                    expect(comment.account.host).to.equal('localhost:9003');
                    expect(comment.totalReplies).to.equal(3);
                    expect(miscs_1.dateIsValid(comment.createdAt)).to.be.true;
                    expect(miscs_1.dateIsValid(comment.updatedAt)).to.be.true;
                    const threadId = comment.threadId;
                    const res2 = yield video_comments_1.getVideoThreadComments(servers[0].url, video4.id, threadId);
                    const tree = res2.body;
                    expect(tree.comment.text).equal('my super first comment');
                    expect(tree.children).to.have.lengthOf(2);
                    const firstChild = tree.children[0];
                    expect(firstChild.comment.text).to.equal('my super answer to thread 1');
                    expect(firstChild.children).to.have.lengthOf(1);
                    const childOfFirstChild = firstChild.children[0];
                    expect(childOfFirstChild.comment.text).to.equal('my super answer to answer of thread 1');
                    expect(childOfFirstChild.children).to.have.lengthOf(0);
                    const secondChild = tree.children[1];
                    expect(secondChild.comment.text).to.equal('my second answer to thread 1');
                    expect(secondChild.children).to.have.lengthOf(0);
                });
            });
            it('Should have propagated captions', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const res = yield video_captions_1.listVideoCaptions(servers[0].url, video4.id);
                    expect(res.body.total).to.equal(1);
                    expect(res.body.data).to.have.lengthOf(1);
                    const caption1 = res.body.data[0];
                    expect(caption1.language.id).to.equal('ar');
                    expect(caption1.language.label).to.equal('Arabic');
                    expect(caption1.captionPath).to.equal('/static/video-captions/' + video4.uuid + '-ar.vtt');
                    yield video_captions_1.testCaptionFile(servers[0].url, caption1.captionPath, 'Subtitle good 2.');
                });
            });
            it('Should unfollow server 3 on server 1 and does not list server 3 videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    this.timeout(5000);
                    yield follows_1.unfollow(servers[0].url, servers[0].accessToken, servers[2]);
                    yield jobs_1.waitJobs(servers);
                    let res = yield index_1.getVideosList(servers[0].url);
                    expect(res.body.total).to.equal(1);
                });
            });
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers(servers);
        });
    });
});
//# sourceMappingURL=follows.js.map