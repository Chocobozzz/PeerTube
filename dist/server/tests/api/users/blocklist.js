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
const login_1 = require("../../utils/users/login");
const videos_1 = require("../../utils/videos/videos");
const video_comments_1 = require("../../utils/videos/video-comments");
const jobs_1 = require("../../utils/server/jobs");
const blocklist_1 = require("../../utils/users/blocklist");
const expect = chai.expect;
function checkAllVideos(url, token) {
    return __awaiter(this, void 0, void 0, function* () {
        {
            const res = yield videos_1.getVideosListWithToken(url, token);
            expect(res.body.data).to.have.lengthOf(4);
        }
        {
            const res = yield videos_1.getVideosList(url);
            expect(res.body.data).to.have.lengthOf(4);
        }
    });
}
function checkAllComments(url, token, videoUUID) {
    return __awaiter(this, void 0, void 0, function* () {
        const resThreads = yield video_comments_1.getVideoCommentThreads(url, videoUUID, 0, 5, '-createdAt', token);
        const threads = resThreads.body.data;
        expect(threads).to.have.lengthOf(2);
        for (const thread of threads) {
            const res = yield video_comments_1.getVideoThreadComments(url, videoUUID, thread.id, token);
            const tree = res.body;
            expect(tree.children).to.have.lengthOf(1);
        }
    });
}
describe('Test blocklist', function () {
    let servers;
    let videoUUID1;
    let videoUUID2;
    let userToken1;
    let userModeratorToken;
    let userToken2;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield index_1.flushTests();
            servers = yield index_1.flushAndRunMultipleServers(2);
            yield login_1.setAccessTokensToServers(servers);
            {
                const user = { username: 'user1', password: 'password' };
                yield index_1.createUser(servers[0].url, servers[0].accessToken, user.username, user.password);
                userToken1 = yield index_1.userLogin(servers[0], user);
                yield index_1.uploadVideo(servers[0].url, userToken1, { name: 'video user 1' });
            }
            {
                const user = { username: 'moderator', password: 'password' };
                yield index_1.createUser(servers[0].url, servers[0].accessToken, user.username, user.password);
                userModeratorToken = yield index_1.userLogin(servers[0], user);
            }
            {
                const user = { username: 'user2', password: 'password' };
                yield index_1.createUser(servers[1].url, servers[1].accessToken, user.username, user.password);
                userToken2 = yield index_1.userLogin(servers[1], user);
                yield index_1.uploadVideo(servers[1].url, userToken2, { name: 'video user 2' });
            }
            {
                const res = yield index_1.uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video server 1' });
                videoUUID1 = res.body.video.uuid;
            }
            {
                const res = yield index_1.uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video server 2' });
                videoUUID2 = res.body.video.uuid;
            }
            yield index_1.doubleFollow(servers[0], servers[1]);
            {
                const resComment = yield video_comments_1.addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID1, 'comment root 1');
                const resReply = yield video_comments_1.addVideoCommentReply(servers[0].url, userToken1, videoUUID1, resComment.body.comment.id, 'comment user 1');
                yield video_comments_1.addVideoCommentReply(servers[0].url, servers[0].accessToken, videoUUID1, resReply.body.comment.id, 'comment root 1');
            }
            {
                const resComment = yield video_comments_1.addVideoCommentThread(servers[0].url, userToken1, videoUUID1, 'comment user 1');
                yield video_comments_1.addVideoCommentReply(servers[0].url, servers[0].accessToken, videoUUID1, resComment.body.comment.id, 'comment root 1');
            }
            yield jobs_1.waitJobs(servers);
        });
    });
    describe('User blocklist', function () {
        describe('When managing account blocklist', function () {
            it('Should list all videos', function () {
                return checkAllVideos(servers[0].url, servers[0].accessToken);
            });
            it('Should list the comments', function () {
                return checkAllComments(servers[0].url, servers[0].accessToken, videoUUID1);
            });
            it('Should block a remote account', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield blocklist_1.addAccountToAccountBlocklist(servers[0].url, servers[0].accessToken, 'user2@localhost:9002');
                });
            });
            it('Should hide its videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const res = yield videos_1.getVideosListWithToken(servers[0].url, servers[0].accessToken);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(3);
                    const v = videos.find(v => v.name === 'video user 2');
                    expect(v).to.be.undefined;
                });
            });
            it('Should block a local account', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield blocklist_1.addAccountToAccountBlocklist(servers[0].url, servers[0].accessToken, 'user1');
                });
            });
            it('Should hide its videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const res = yield videos_1.getVideosListWithToken(servers[0].url, servers[0].accessToken);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(2);
                    const v = videos.find(v => v.name === 'video user 1');
                    expect(v).to.be.undefined;
                });
            });
            it('Should hide its comments', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const resThreads = yield video_comments_1.getVideoCommentThreads(servers[0].url, videoUUID1, 0, 5, '-createdAt', servers[0].accessToken);
                    const threads = resThreads.body.data;
                    expect(threads).to.have.lengthOf(1);
                    expect(threads[0].totalReplies).to.equal(0);
                    const t = threads.find(t => t.text === 'comment user 1');
                    expect(t).to.be.undefined;
                    for (const thread of threads) {
                        const res = yield video_comments_1.getVideoThreadComments(servers[0].url, videoUUID1, thread.id, servers[0].accessToken);
                        const tree = res.body;
                        expect(tree.children).to.have.lengthOf(0);
                    }
                });
            });
            it('Should list all the videos with another user', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    return checkAllVideos(servers[0].url, userToken1);
                });
            });
            it('Should list all the comments with another user', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    return checkAllComments(servers[0].url, userToken1, videoUUID1);
                });
            });
            it('Should list blocked accounts', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    {
                        const res = yield blocklist_1.getAccountBlocklistByAccount(servers[0].url, servers[0].accessToken, 0, 1, 'createdAt');
                        const blocks = res.body.data;
                        expect(res.body.total).to.equal(2);
                        const block = blocks[0];
                        expect(block.byAccount.displayName).to.equal('root');
                        expect(block.byAccount.name).to.equal('root');
                        expect(block.blockedAccount.displayName).to.equal('user2');
                        expect(block.blockedAccount.name).to.equal('user2');
                        expect(block.blockedAccount.host).to.equal('localhost:9002');
                    }
                    {
                        const res = yield blocklist_1.getAccountBlocklistByAccount(servers[0].url, servers[0].accessToken, 1, 2, 'createdAt');
                        const blocks = res.body.data;
                        expect(res.body.total).to.equal(2);
                        const block = blocks[0];
                        expect(block.byAccount.displayName).to.equal('root');
                        expect(block.byAccount.name).to.equal('root');
                        expect(block.blockedAccount.displayName).to.equal('user1');
                        expect(block.blockedAccount.name).to.equal('user1');
                        expect(block.blockedAccount.host).to.equal('localhost:9001');
                    }
                });
            });
            it('Should unblock the remote account', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield blocklist_1.removeAccountFromAccountBlocklist(servers[0].url, servers[0].accessToken, 'user2@localhost:9002');
                });
            });
            it('Should display its videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const res = yield videos_1.getVideosListWithToken(servers[0].url, servers[0].accessToken);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(3);
                    const v = videos.find(v => v.name === 'video user 2');
                    expect(v).not.to.be.undefined;
                });
            });
            it('Should unblock the local account', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield blocklist_1.removeAccountFromAccountBlocklist(servers[0].url, servers[0].accessToken, 'user1');
                });
            });
            it('Should display its comments', function () {
                return checkAllComments(servers[0].url, servers[0].accessToken, videoUUID1);
            });
        });
        describe('When managing server blocklist', function () {
            it('Should list all videos', function () {
                return checkAllVideos(servers[0].url, servers[0].accessToken);
            });
            it('Should list the comments', function () {
                return checkAllComments(servers[0].url, servers[0].accessToken, videoUUID1);
            });
            it('Should block a remote server', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield blocklist_1.addServerToAccountBlocklist(servers[0].url, servers[0].accessToken, 'localhost:9002');
                });
            });
            it('Should hide its videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const res = yield videos_1.getVideosListWithToken(servers[0].url, servers[0].accessToken);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(2);
                    const v1 = videos.find(v => v.name === 'video user 2');
                    const v2 = videos.find(v => v.name === 'video server 2');
                    expect(v1).to.be.undefined;
                    expect(v2).to.be.undefined;
                });
            });
            it('Should list all the videos with another user', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    return checkAllVideos(servers[0].url, userToken1);
                });
            });
            it('Should hide its comments');
            it('Should list blocked servers', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const res = yield blocklist_1.getServerBlocklistByAccount(servers[0].url, servers[0].accessToken, 0, 1, 'createdAt');
                    const blocks = res.body.data;
                    expect(res.body.total).to.equal(1);
                    const block = blocks[0];
                    expect(block.byAccount.displayName).to.equal('root');
                    expect(block.byAccount.name).to.equal('root');
                    expect(block.blockedServer.host).to.equal('localhost:9002');
                });
            });
            it('Should unblock the remote server', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield blocklist_1.removeServerFromAccountBlocklist(servers[0].url, servers[0].accessToken, 'localhost:9002');
                });
            });
            it('Should display its videos', function () {
                return checkAllVideos(servers[0].url, servers[0].accessToken);
            });
            it('Should display its comments', function () {
                return checkAllComments(servers[0].url, servers[0].accessToken, videoUUID1);
            });
        });
    });
    describe('Server blocklist', function () {
        describe('When managing account blocklist', function () {
            it('Should list all videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const token of [userModeratorToken, servers[0].accessToken]) {
                        yield checkAllVideos(servers[0].url, token);
                    }
                });
            });
            it('Should list the comments', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const token of [userModeratorToken, servers[0].accessToken]) {
                        yield checkAllComments(servers[0].url, token, videoUUID1);
                    }
                });
            });
            it('Should block a remote account', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield blocklist_1.addAccountToServerBlocklist(servers[0].url, servers[0].accessToken, 'user2@localhost:9002');
                });
            });
            it('Should hide its videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const token of [userModeratorToken, servers[0].accessToken]) {
                        const res = yield videos_1.getVideosListWithToken(servers[0].url, token);
                        const videos = res.body.data;
                        expect(videos).to.have.lengthOf(3);
                        const v = videos.find(v => v.name === 'video user 2');
                        expect(v).to.be.undefined;
                    }
                });
            });
            it('Should block a local account', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield blocklist_1.addAccountToServerBlocklist(servers[0].url, servers[0].accessToken, 'user1');
                });
            });
            it('Should hide its videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const token of [userModeratorToken, servers[0].accessToken]) {
                        const res = yield videos_1.getVideosListWithToken(servers[0].url, token);
                        const videos = res.body.data;
                        expect(videos).to.have.lengthOf(2);
                        const v = videos.find(v => v.name === 'video user 1');
                        expect(v).to.be.undefined;
                    }
                });
            });
            it('Should hide its comments', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const token of [userModeratorToken, servers[0].accessToken]) {
                        const resThreads = yield video_comments_1.getVideoCommentThreads(servers[0].url, videoUUID1, 0, 5, '-createdAt', token);
                        const threads = resThreads.body.data;
                        expect(threads).to.have.lengthOf(1);
                        expect(threads[0].totalReplies).to.equal(0);
                        const t = threads.find(t => t.text === 'comment user 1');
                        expect(t).to.be.undefined;
                        for (const thread of threads) {
                            const res = yield video_comments_1.getVideoThreadComments(servers[0].url, videoUUID1, thread.id, token);
                            const tree = res.body;
                            expect(tree.children).to.have.lengthOf(0);
                        }
                    }
                });
            });
            it('Should list blocked accounts', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    {
                        const res = yield blocklist_1.getAccountBlocklistByServer(servers[0].url, servers[0].accessToken, 0, 1, 'createdAt');
                        const blocks = res.body.data;
                        expect(res.body.total).to.equal(2);
                        const block = blocks[0];
                        expect(block.byAccount.displayName).to.equal('peertube');
                        expect(block.byAccount.name).to.equal('peertube');
                        expect(block.blockedAccount.displayName).to.equal('user2');
                        expect(block.blockedAccount.name).to.equal('user2');
                        expect(block.blockedAccount.host).to.equal('localhost:9002');
                    }
                    {
                        const res = yield blocklist_1.getAccountBlocklistByServer(servers[0].url, servers[0].accessToken, 1, 2, 'createdAt');
                        const blocks = res.body.data;
                        expect(res.body.total).to.equal(2);
                        const block = blocks[0];
                        expect(block.byAccount.displayName).to.equal('peertube');
                        expect(block.byAccount.name).to.equal('peertube');
                        expect(block.blockedAccount.displayName).to.equal('user1');
                        expect(block.blockedAccount.name).to.equal('user1');
                        expect(block.blockedAccount.host).to.equal('localhost:9001');
                    }
                });
            });
            it('Should unblock the remote account', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield blocklist_1.removeAccountFromServerBlocklist(servers[0].url, servers[0].accessToken, 'user2@localhost:9002');
                });
            });
            it('Should display its videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const token of [userModeratorToken, servers[0].accessToken]) {
                        const res = yield videos_1.getVideosListWithToken(servers[0].url, token);
                        const videos = res.body.data;
                        expect(videos).to.have.lengthOf(3);
                        const v = videos.find(v => v.name === 'video user 2');
                        expect(v).not.to.be.undefined;
                    }
                });
            });
            it('Should unblock the local account', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield blocklist_1.removeAccountFromServerBlocklist(servers[0].url, servers[0].accessToken, 'user1');
                });
            });
            it('Should display its comments', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const token of [userModeratorToken, servers[0].accessToken]) {
                        yield checkAllComments(servers[0].url, token, videoUUID1);
                    }
                });
            });
        });
        describe('When managing server blocklist', function () {
            it('Should list all videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const token of [userModeratorToken, servers[0].accessToken]) {
                        yield checkAllVideos(servers[0].url, token);
                    }
                });
            });
            it('Should list the comments', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const token of [userModeratorToken, servers[0].accessToken]) {
                        yield checkAllComments(servers[0].url, token, videoUUID1);
                    }
                });
            });
            it('Should block a remote server', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield blocklist_1.addServerToServerBlocklist(servers[0].url, servers[0].accessToken, 'localhost:9002');
                });
            });
            it('Should hide its videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const token of [userModeratorToken, servers[0].accessToken]) {
                        const res1 = yield videos_1.getVideosList(servers[0].url);
                        const res2 = yield videos_1.getVideosListWithToken(servers[0].url, token);
                        for (const res of [res1, res2]) {
                            const videos = res.body.data;
                            expect(videos).to.have.lengthOf(2);
                            const v1 = videos.find(v => v.name === 'video user 2');
                            const v2 = videos.find(v => v.name === 'video server 2');
                            expect(v1).to.be.undefined;
                            expect(v2).to.be.undefined;
                        }
                    }
                });
            });
            it('Should hide its comments');
            it('Should list blocked servers', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const res = yield blocklist_1.getServerBlocklistByServer(servers[0].url, servers[0].accessToken, 0, 1, 'createdAt');
                    const blocks = res.body.data;
                    expect(res.body.total).to.equal(1);
                    const block = blocks[0];
                    expect(block.byAccount.displayName).to.equal('peertube');
                    expect(block.byAccount.name).to.equal('peertube');
                    expect(block.blockedServer.host).to.equal('localhost:9002');
                });
            });
            it('Should unblock the remote server', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    yield blocklist_1.removeServerFromServerBlocklist(servers[0].url, servers[0].accessToken, 'localhost:9002');
                });
            });
            it('Should list all videos', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const token of [userModeratorToken, servers[0].accessToken]) {
                        yield checkAllVideos(servers[0].url, token);
                    }
                });
            });
            it('Should list the comments', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const token of [userModeratorToken, servers[0].accessToken]) {
                        yield checkAllComments(servers[0].url, token, videoUUID1);
                    }
                });
            });
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers(servers);
            if (this['ok']) {
                yield index_1.flushTests();
            }
        });
    });
});
