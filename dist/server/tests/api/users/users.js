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
const index_1 = require("../../../../shared/index");
const index_2 = require("../../utils/index");
const follows_1 = require("../../utils/server/follows");
const login_1 = require("../../utils/users/login");
const videos_1 = require("../../utils/videos/videos");
const expect = chai.expect;
describe('Test users', function () {
    let server;
    let accessToken;
    let accessTokenUser;
    let videoId;
    let userId;
    const user = {
        username: 'user_1',
        password: 'super password'
    };
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield index_2.flushTests();
            server = yield index_2.runServer(1);
            yield login_1.setAccessTokensToServers([server]);
        });
    });
    it('Should create a new client');
    it('Should return the first client');
    it('Should remove the last client');
    it('Should not login with an invalid client id', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const client = { id: 'client', secret: server.client.secret };
            const res = yield index_2.login(server.url, client, server.user, 400);
            expect(res.body.error).to.contain('client is invalid');
        });
    });
    it('Should not login with an invalid client secret', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const client = { id: server.client.id, secret: 'coucou' };
            const res = yield index_2.login(server.url, client, server.user, 400);
            expect(res.body.error).to.contain('client is invalid');
        });
    });
    it('Should not login with an invalid username', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const user = { username: 'captain crochet', password: server.user.password };
            const res = yield index_2.login(server.url, server.client, user, 400);
            expect(res.body.error).to.contain('credentials are invalid');
        });
    });
    it('Should not login with an invalid password', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const user = { username: server.user.username, password: 'mew_three' };
            const res = yield index_2.login(server.url, server.client, user, 400);
            expect(res.body.error).to.contain('credentials are invalid');
        });
    });
    it('Should not be able to upload a video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            accessToken = 'my_super_token';
            const videoAttributes = {};
            yield index_2.uploadVideo(server.url, accessToken, videoAttributes, 401);
        });
    });
    it('Should not be able to follow', function () {
        return __awaiter(this, void 0, void 0, function* () {
            accessToken = 'my_super_token';
            yield follows_1.follow(server.url, ['http://example.com'], accessToken, 401);
        });
    });
    it('Should not be able to unfollow');
    it('Should be able to login', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_2.login(server.url, server.client, server.user, 200);
            accessToken = res.body.access_token;
        });
    });
    it('Should upload the video with the correct token', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const videoAttributes = {};
            yield index_2.uploadVideo(server.url, accessToken, videoAttributes);
            const res = yield index_2.getVideosList(server.url);
            const video = res.body.data[0];
            expect(video.account.name).to.equal('root');
            videoId = video.id;
        });
    });
    it('Should upload the video again with the correct token', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const videoAttributes = {};
            yield index_2.uploadVideo(server.url, accessToken, videoAttributes);
        });
    });
    it('Should retrieve a video rating', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.rateVideo(server.url, accessToken, videoId, 'like');
            const res = yield index_2.getMyUserVideoRating(server.url, accessToken, videoId);
            const rating = res.body;
            expect(rating.videoId).to.equal(videoId);
            expect(rating.rating).to.equal('like');
        });
    });
    it('Should not be able to remove the video with an incorrect token', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.removeVideo(server.url, 'bad_token', videoId, 401);
        });
    });
    it('Should not be able to remove the video with the token of another account');
    it('Should be able to remove the video with the correct token', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.removeVideo(server.url, accessToken, videoId);
        });
    });
    it('Should logout (revoke token)');
    it('Should not be able to get the user information');
    it('Should not be able to upload a video');
    it('Should not be able to remove a video');
    it('Should not be able to rate a video', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const path = '/api/v1/videos/';
            const data = {
                rating: 'likes'
            };
            const options = {
                url: server.url,
                path: path + videoId,
                token: 'wrong token',
                fields: data,
                statusCodeExpected: 401
            };
            yield index_2.makePutBodyRequest(options);
        });
    });
    it('Should be able to login again');
    it('Should have an expired access token');
    it('Should refresh the token');
    it('Should be able to upload a video again');
    it('Should be able to create a new user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.createUser(server.url, accessToken, user.username, user.password, 2 * 1024 * 1024);
        });
    });
    it('Should be able to login with this user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            accessTokenUser = yield index_2.userLogin(server, user);
        });
    });
    it('Should be able to get the user information', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_2.getMyUserInformation(server.url, accessTokenUser);
            const user = res.body;
            expect(user.username).to.equal('user_1');
            expect(user.email).to.equal('user_1@example.com');
            expect(user.nsfwPolicy).to.equal('display');
            expect(user.videoQuota).to.equal(2 * 1024 * 1024);
            expect(user.roleLabel).to.equal('User');
            expect(user.id).to.be.a('number');
            expect(user.account.displayName).to.equal('user_1');
            expect(user.account.description).to.be.null;
        });
    });
    it('Should be able to upload a video with this user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(5000);
            const videoAttributes = {
                name: 'super user video',
                fixture: 'video_short.webm'
            };
            yield index_2.uploadVideo(server.url, accessTokenUser, videoAttributes);
        });
    });
    it('Should have video quota updated', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_2.getMyUserVideoQuotaUsed(server.url, accessTokenUser);
            const data = res.body;
            expect(data.videoQuotaUsed).to.equal(218910);
            const resUsers = yield index_2.getUsersList(server.url, server.accessToken);
            const users = resUsers.body.data;
            const tmpUser = users.find(u => u.username === user.username);
            expect(tmpUser.videoQuotaUsed).to.equal(218910);
        });
    });
    it('Should be able to list my videos', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield videos_1.getMyVideos(server.url, accessTokenUser, 0, 5);
            expect(res.body.total).to.equal(1);
            const videos = res.body.data;
            expect(videos).to.have.lengthOf(1);
            expect(videos[0].name).to.equal('super user video');
        });
    });
    it('Should list all the users', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_2.getUsersList(server.url, server.accessToken);
            const result = res.body;
            const total = result.total;
            const users = result.data;
            expect(total).to.equal(2);
            expect(users).to.be.an('array');
            expect(users.length).to.equal(2);
            const user = users[0];
            expect(user.username).to.equal('user_1');
            expect(user.email).to.equal('user_1@example.com');
            expect(user.nsfwPolicy).to.equal('display');
            const rootUser = users[1];
            expect(rootUser.username).to.equal('root');
            expect(rootUser.email).to.equal('admin1@example.com');
            expect(user.nsfwPolicy).to.equal('display');
            userId = user.id;
        });
    });
    it('Should list only the first user by username asc', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_2.getUsersListPaginationAndSort(server.url, server.accessToken, 0, 1, 'username');
            const result = res.body;
            const total = result.total;
            const users = result.data;
            expect(total).to.equal(2);
            expect(users.length).to.equal(1);
            const user = users[0];
            expect(user.username).to.equal('root');
            expect(user.email).to.equal('admin1@example.com');
            expect(user.roleLabel).to.equal('Administrator');
            expect(user.nsfwPolicy).to.equal('display');
        });
    });
    it('Should list only the first user by username desc', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_2.getUsersListPaginationAndSort(server.url, server.accessToken, 0, 1, '-username');
            const result = res.body;
            const total = result.total;
            const users = result.data;
            expect(total).to.equal(2);
            expect(users.length).to.equal(1);
            const user = users[0];
            expect(user.username).to.equal('user_1');
            expect(user.email).to.equal('user_1@example.com');
            expect(user.nsfwPolicy).to.equal('display');
        });
    });
    it('Should list only the second user by createdAt desc', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_2.getUsersListPaginationAndSort(server.url, server.accessToken, 0, 1, '-createdAt');
            const result = res.body;
            const total = result.total;
            const users = result.data;
            expect(total).to.equal(2);
            expect(users.length).to.equal(1);
            const user = users[0];
            expect(user.username).to.equal('user_1');
            expect(user.email).to.equal('user_1@example.com');
            expect(user.nsfwPolicy).to.equal('display');
        });
    });
    it('Should list all the users by createdAt asc', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_2.getUsersListPaginationAndSort(server.url, server.accessToken, 0, 2, 'createdAt');
            const result = res.body;
            const total = result.total;
            const users = result.data;
            expect(total).to.equal(2);
            expect(users.length).to.equal(2);
            expect(users[0].username).to.equal('root');
            expect(users[0].email).to.equal('admin1@example.com');
            expect(users[0].nsfwPolicy).to.equal('display');
            expect(users[1].username).to.equal('user_1');
            expect(users[1].email).to.equal('user_1@example.com');
            expect(users[1].nsfwPolicy).to.equal('display');
        });
    });
    it('Should search user by username', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_2.getUsersListPaginationAndSort(server.url, server.accessToken, 0, 2, 'createdAt', 'oot');
            const users = res.body.data;
            expect(res.body.total).to.equal(1);
            expect(users.length).to.equal(1);
            expect(users[0].username).to.equal('root');
        });
    });
    it('Should search user by email', function () {
        return __awaiter(this, void 0, void 0, function* () {
            {
                const res = yield index_2.getUsersListPaginationAndSort(server.url, server.accessToken, 0, 2, 'createdAt', 'r_1@exam');
                const users = res.body.data;
                expect(res.body.total).to.equal(1);
                expect(users.length).to.equal(1);
                expect(users[0].username).to.equal('user_1');
                expect(users[0].email).to.equal('user_1@example.com');
            }
            {
                const res = yield index_2.getUsersListPaginationAndSort(server.url, server.accessToken, 0, 2, 'createdAt', 'example');
                const users = res.body.data;
                expect(res.body.total).to.equal(2);
                expect(users.length).to.equal(2);
                expect(users[0].username).to.equal('root');
                expect(users[1].username).to.equal('user_1');
            }
        });
    });
    it('Should update my password', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.updateMyUser({
                url: server.url,
                accessToken: accessTokenUser,
                currentPassword: 'super password',
                newPassword: 'new password'
            });
            user.password = 'new password';
            yield index_2.userLogin(server, user, 200);
        });
    });
    it('Should be able to change the NSFW display attribute', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.updateMyUser({
                url: server.url,
                accessToken: accessTokenUser,
                nsfwPolicy: 'do_not_list'
            });
            const res = yield index_2.getMyUserInformation(server.url, accessTokenUser);
            const user = res.body;
            expect(user.username).to.equal('user_1');
            expect(user.email).to.equal('user_1@example.com');
            expect(user.nsfwPolicy).to.equal('do_not_list');
            expect(user.videoQuota).to.equal(2 * 1024 * 1024);
            expect(user.id).to.be.a('number');
            expect(user.account.displayName).to.equal('user_1');
            expect(user.account.description).to.be.null;
        });
    });
    it('Should be able to change the autoPlayVideo attribute', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.updateMyUser({
                url: server.url,
                accessToken: accessTokenUser,
                autoPlayVideo: false
            });
            const res = yield index_2.getMyUserInformation(server.url, accessTokenUser);
            const user = res.body;
            expect(user.autoPlayVideo).to.be.false;
        });
    });
    it('Should be able to change the email display attribute', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.updateMyUser({
                url: server.url,
                accessToken: accessTokenUser,
                email: 'updated@example.com'
            });
            const res = yield index_2.getMyUserInformation(server.url, accessTokenUser);
            const user = res.body;
            expect(user.username).to.equal('user_1');
            expect(user.email).to.equal('updated@example.com');
            expect(user.nsfwPolicy).to.equal('do_not_list');
            expect(user.videoQuota).to.equal(2 * 1024 * 1024);
            expect(user.id).to.be.a('number');
            expect(user.account.displayName).to.equal('user_1');
            expect(user.account.description).to.be.null;
        });
    });
    it('Should be able to update my avatar', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const fixture = 'avatar.png';
            yield index_2.updateMyAvatar({
                url: server.url,
                accessToken: accessTokenUser,
                fixture
            });
            const res = yield index_2.getMyUserInformation(server.url, accessTokenUser);
            const user = res.body;
            yield index_2.testImage(server.url, 'avatar-resized', user.account.avatar.path, '.png');
        });
    });
    it('Should be able to update my display name', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.updateMyUser({
                url: server.url,
                accessToken: accessTokenUser,
                displayName: 'new display name'
            });
            const res = yield index_2.getMyUserInformation(server.url, accessTokenUser);
            const user = res.body;
            expect(user.username).to.equal('user_1');
            expect(user.email).to.equal('updated@example.com');
            expect(user.nsfwPolicy).to.equal('do_not_list');
            expect(user.videoQuota).to.equal(2 * 1024 * 1024);
            expect(user.id).to.be.a('number');
            expect(user.account.displayName).to.equal('new display name');
            expect(user.account.description).to.be.null;
        });
    });
    it('Should be able to update my description', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.updateMyUser({
                url: server.url,
                accessToken: accessTokenUser,
                description: 'my super description updated'
            });
            const res = yield index_2.getMyUserInformation(server.url, accessTokenUser);
            const user = res.body;
            expect(user.username).to.equal('user_1');
            expect(user.email).to.equal('updated@example.com');
            expect(user.nsfwPolicy).to.equal('do_not_list');
            expect(user.videoQuota).to.equal(2 * 1024 * 1024);
            expect(user.id).to.be.a('number');
            expect(user.account.displayName).to.equal('new display name');
            expect(user.account.description).to.equal('my super description updated');
        });
    });
    it('Should be able to update another user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.updateUser({
                url: server.url,
                userId,
                accessToken,
                email: 'updated2@example.com',
                videoQuota: 42,
                role: index_1.UserRole.MODERATOR
            });
            const res = yield index_2.getUserInformation(server.url, accessToken, userId);
            const user = res.body;
            expect(user.username).to.equal('user_1');
            expect(user.email).to.equal('updated2@example.com');
            expect(user.nsfwPolicy).to.equal('do_not_list');
            expect(user.videoQuota).to.equal(42);
            expect(user.roleLabel).to.equal('Moderator');
            expect(user.id).to.be.a('number');
        });
    });
    it('Should have removed the user token', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.getMyUserVideoQuotaUsed(server.url, accessTokenUser, 401);
            accessTokenUser = yield index_2.userLogin(server, user);
        });
    });
    it('Should not be able to delete a user by a moderator', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.removeUser(server.url, 2, accessTokenUser, 403);
        });
    });
    it('Should be able to list video blacklist by a moderator', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.getBlacklistedVideosList(server.url, accessTokenUser);
        });
    });
    it('Should be able to remove this user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.removeUser(server.url, userId, accessToken);
        });
    });
    it('Should not be able to login with this user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.userLogin(server, user, 400);
        });
    });
    it('Should not have videos of this user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_2.getVideosList(server.url);
            expect(res.body.total).to.equal(1);
            const video = res.body.data[0];
            expect(video.account.name).to.equal('root');
        });
    });
    it('Should register a new user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield index_2.registerUser(server.url, 'user_15', 'my super password');
        });
    });
    it('Should be able to login with this registered user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const user15 = {
                username: 'user_15',
                password: 'my super password'
            };
            accessToken = yield index_2.userLogin(server, user15);
        });
    });
    it('Should have the correct video quota', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_2.getMyUserInformation(server.url, accessToken);
            const user = res.body;
            expect(user.videoQuota).to.equal(5 * 1024 * 1024);
        });
    });
    it('Should remove me', function () {
        return __awaiter(this, void 0, void 0, function* () {
            {
                const res = yield index_2.getUsersList(server.url, server.accessToken);
                expect(res.body.data.find(u => u.username === 'user_15')).to.not.be.undefined;
            }
            yield index_2.deleteMe(server.url, accessToken);
            {
                const res = yield index_2.getUsersList(server.url, server.accessToken);
                expect(res.body.data.find(u => u.username === 'user_15')).to.be.undefined;
            }
        });
    });
    it('Should block and unblock a user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const user16 = {
                username: 'user_16',
                password: 'my super password'
            };
            const resUser = yield index_2.createUser(server.url, server.accessToken, user16.username, user16.password);
            const user16Id = resUser.body.user.id;
            accessToken = yield index_2.userLogin(server, user16);
            yield index_2.getMyUserInformation(server.url, accessToken, 200);
            yield index_2.blockUser(server.url, user16Id, server.accessToken);
            yield index_2.getMyUserInformation(server.url, accessToken, 401);
            yield index_2.userLogin(server, user16, 400);
            yield index_2.unblockUser(server.url, user16Id, server.accessToken);
            accessToken = yield index_2.userLogin(server, user16);
            yield index_2.getMyUserInformation(server.url, accessToken, 200);
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_2.killallServers([server]);
            if (this['ok']) {
                yield index_2.flushTests();
            }
        });
    });
});
