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
const lodash_1 = require("lodash");
require("mocha");
const path_1 = require("path");
const shared_1 = require("../../../../shared");
const utils_1 = require("../../utils");
const check_api_params_1 = require("../../utils/requests/check-api-params");
const video_imports_1 = require("../../utils/videos/video-imports");
const videos_1 = require("../../../../shared/models/videos");
const jobs_1 = require("../../utils/server/jobs");
const chai_1 = require("chai");
describe('Test users API validators', function () {
    const path = '/api/v1/users/';
    let userId;
    let rootId;
    let videoId;
    let server;
    let serverWithRegistrationDisabled;
    let userAccessToken = '';
    let channelId;
    const user = {
        username: 'user1',
        password: 'my super password'
    };
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            serverWithRegistrationDisabled = yield utils_1.runServer(2);
            yield utils_1.setAccessTokensToServers([server]);
            const videoQuota = 42000000;
            yield utils_1.createUser(server.url, server.accessToken, user.username, user.password, videoQuota);
            userAccessToken = yield utils_1.userLogin(server, user);
            {
                const res = yield utils_1.getMyUserInformation(server.url, server.accessToken);
                channelId = res.body.videoChannels[0].id;
            }
            {
                const res = yield utils_1.uploadVideo(server.url, server.accessToken, {});
                videoId = res.body.video.id;
            }
        });
    });
    describe('When listing users', function () {
        it('Should fail with a bad start pagination', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadStartPagination(server.url, path, server.accessToken);
            });
        });
        it('Should fail with a bad count pagination', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadCountPagination(server.url, path, server.accessToken);
            });
        });
        it('Should fail with an incorrect sort', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadSortPagination(server.url, path, server.accessToken);
            });
        });
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({
                    url: server.url,
                    path,
                    statusCodeExpected: 401
                });
            });
        });
        it('Should fail with a non admin user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({
                    url: server.url,
                    path,
                    token: userAccessToken,
                    statusCodeExpected: 403
                });
            });
        });
    });
    describe('When adding a new user', function () {
        const baseCorrectParams = {
            username: 'user2',
            email: 'test@example.com',
            password: 'my super password',
            videoQuota: -1,
            videoQuotaDaily: -1,
            role: shared_1.UserRole.USER
        };
        it('Should fail with a too small username', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { username: 'fi' });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a too long username', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { username: 'my_super_username_which_is_very_long' });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a not lowercase username', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { username: 'Toto' });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with an incorrect username', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { username: 'my username' });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a missing email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = lodash_1.omit(baseCorrectParams, 'email');
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with an invalid email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { email: 'test_example.com' });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a too small password', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { password: 'bla' });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a too long password', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { password: 'super'.repeat(61) });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with an non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makePostBodyRequest({
                    url: server.url,
                    path,
                    token: 'super token',
                    fields: baseCorrectParams,
                    statusCodeExpected: 401
                });
            });
        });
        it('Should fail if we add a user with the same username', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { username: 'user1' });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 409 });
            });
        });
        it('Should fail if we add a user with the same email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { email: 'user1@example.com' });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 409 });
            });
        });
        it('Should fail without a videoQuota', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = lodash_1.omit(baseCorrectParams, 'videoQuota');
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail without a videoQuotaDaily', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = lodash_1.omit(baseCorrectParams, 'videoQuotaDaily');
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with an invalid videoQuota', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { videoQuota: -5 });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with an invalid videoQuotaDaily', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { videoQuotaDaily: -7 });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail without a user role', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = lodash_1.omit(baseCorrectParams, 'role');
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with an invalid user role', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { role: 88989 });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a "peertube" username', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { username: 'peertube' });
                yield utils_1.makePostBodyRequest({
                    url: server.url,
                    path,
                    token: server.accessToken,
                    fields,
                    statusCodeExpected: 409
                });
            });
        });
        it('Should succeed with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makePostBodyRequest({
                    url: server.url,
                    path,
                    token: server.accessToken,
                    fields: baseCorrectParams,
                    statusCodeExpected: 200
                });
            });
        });
        it('Should fail with a non admin user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const user = {
                    username: 'user1',
                    password: 'my super password'
                };
                userAccessToken = yield utils_1.userLogin(server, user);
                const fields = {
                    username: 'user3',
                    email: 'test@example.com',
                    password: 'my super password',
                    videoQuota: 42000000
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields, statusCodeExpected: 403 });
            });
        });
    });
    describe('When updating my account', function () {
        it('Should fail with an invalid email attribute', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    email: 'blabla'
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + 'me', token: server.accessToken, fields });
            });
        });
        it('Should fail with a too small password', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    currentPassword: 'my super password',
                    password: 'bla'
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields });
            });
        });
        it('Should fail with a too long password', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    currentPassword: 'my super password',
                    password: 'super'.repeat(61)
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields });
            });
        });
        it('Should fail without the current password', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    currentPassword: 'my super password',
                    password: 'super'.repeat(61)
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields });
            });
        });
        it('Should fail with an invalid current password', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    currentPassword: 'my super password fail',
                    password: 'super'.repeat(61)
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields, statusCodeExpected: 401 });
            });
        });
        it('Should fail with an invalid NSFW policy attribute', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    nsfwPolicy: 'hello'
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields });
            });
        });
        it('Should fail with an invalid autoPlayVideo attribute', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    autoPlayVideo: -1
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields });
            });
        });
        it('Should fail with an non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    currentPassword: 'my super password',
                    password: 'my super password'
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + 'me', token: 'super token', fields, statusCodeExpected: 401 });
            });
        });
        it('Should fail with a too long description', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    description: 'super'.repeat(201)
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields });
            });
        });
        it('Should succeed to change password with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    currentPassword: 'my super password',
                    password: 'my super password',
                    nsfwPolicy: 'blur',
                    autoPlayVideo: false,
                    email: 'super_email@example.com'
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields, statusCodeExpected: 204 });
            });
        });
        it('Should succeed without password change with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    nsfwPolicy: 'blur',
                    autoPlayVideo: false,
                    email: 'super_email@example.com'
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields, statusCodeExpected: 204 });
            });
        });
    });
    describe('When updating my avatar', function () {
        it('Should fail without an incorrect input file', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {};
                const attaches = {
                    'avatarfile': path_1.join(__dirname, '..', '..', 'fixtures', 'video_short.mp4')
                };
                yield utils_1.makeUploadRequest({ url: server.url, path: path + '/me/avatar/pick', token: server.accessToken, fields, attaches });
            });
        });
        it('Should fail with a big file', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {};
                const attaches = {
                    'avatarfile': path_1.join(__dirname, '..', '..', 'fixtures', 'avatar-big.png')
                };
                yield utils_1.makeUploadRequest({ url: server.url, path: path + '/me/avatar/pick', token: server.accessToken, fields, attaches });
            });
        });
        it('Should fail with an unauthenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {};
                const attaches = {
                    'avatarfile': path_1.join(__dirname, '..', '..', 'fixtures', 'avatar.png')
                };
                yield utils_1.makeUploadRequest({
                    url: server.url,
                    path: path + '/me/avatar/pick',
                    fields,
                    attaches,
                    statusCodeExpected: 401
                });
            });
        });
        it('Should succeed with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {};
                const attaches = {
                    'avatarfile': path_1.join(__dirname, '..', '..', 'fixtures', 'avatar.png')
                };
                yield utils_1.makeUploadRequest({
                    url: server.url,
                    path: path + '/me/avatar/pick',
                    token: server.accessToken,
                    fields,
                    attaches,
                    statusCodeExpected: 200
                });
            });
        });
    });
    describe('When getting a user', function () {
        before(function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield utils_1.getUsersList(server.url, server.accessToken);
                userId = res.body.data[1].id;
            });
        });
        it('Should fail with an non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({ url: server.url, path: path + userId, token: 'super token', statusCodeExpected: 401 });
            });
        });
        it('Should fail with a non admin user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({ url: server.url, path, token: userAccessToken, statusCodeExpected: 403 });
            });
        });
        it('Should succeed with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({ url: server.url, path: path + userId, token: server.accessToken, statusCodeExpected: 200 });
            });
        });
    });
    describe('When updating a user', function () {
        before(function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield utils_1.getUsersList(server.url, server.accessToken);
                userId = res.body.data[1].id;
                rootId = res.body.data[2].id;
            });
        });
        it('Should fail with an invalid email attribute', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    email: 'blabla'
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields });
            });
        });
        it('Should fail with an invalid videoQuota attribute', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    videoQuota: -90
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields });
            });
        });
        it('Should fail with an invalid user role attribute', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    role: 54878
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields });
            });
        });
        it('Should fail with an non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    videoQuota: 42
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + userId, token: 'super token', fields, statusCodeExpected: 401 });
            });
        });
        it('Should fail when updating root role', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    role: shared_1.UserRole.MODERATOR
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + rootId, token: server.accessToken, fields });
            });
        });
        it('Should succeed with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    email: 'email@example.com',
                    videoQuota: 42,
                    role: shared_1.UserRole.MODERATOR
                };
                yield utils_1.makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields, statusCodeExpected: 204 });
                userAccessToken = yield utils_1.userLogin(server, user);
            });
        });
    });
    describe('When getting my information', function () {
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.getMyUserInformation(server.url, 'fake_token', 401);
            });
        });
        it('Should success with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.getMyUserInformation(server.url, userAccessToken);
            });
        });
    });
    describe('When getting my video rating', function () {
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.getMyUserVideoRating(server.url, 'fake_token', videoId, 401);
            });
        });
        it('Should fail with an incorrect video uuid', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.getMyUserVideoRating(server.url, server.accessToken, 'blabla', 400);
            });
        });
        it('Should fail with an unknown video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.getMyUserVideoRating(server.url, server.accessToken, '4da6fde3-88f7-4d16-b119-108df5630b06', 404);
            });
        });
        it('Should succeed with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.getMyUserVideoRating(server.url, server.accessToken, videoId);
            });
        });
    });
    describe('When blocking/unblocking/removing user', function () {
        it('Should fail with an incorrect id', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.removeUser(server.url, 'blabla', server.accessToken, 400);
                yield utils_1.blockUser(server.url, 'blabla', server.accessToken, 400);
                yield utils_1.unblockUser(server.url, 'blabla', server.accessToken, 400);
            });
        });
        it('Should fail with the root user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.removeUser(server.url, rootId, server.accessToken, 400);
                yield utils_1.blockUser(server.url, rootId, server.accessToken, 400);
                yield utils_1.unblockUser(server.url, rootId, server.accessToken, 400);
            });
        });
        it('Should return 404 with a non existing id', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.removeUser(server.url, 4545454, server.accessToken, 404);
                yield utils_1.blockUser(server.url, 4545454, server.accessToken, 404);
                yield utils_1.unblockUser(server.url, 4545454, server.accessToken, 404);
            });
        });
        it('Should fail with a non admin user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.removeUser(server.url, userId, userAccessToken, 403);
                yield utils_1.blockUser(server.url, userId, userAccessToken, 403);
                yield utils_1.unblockUser(server.url, userId, userAccessToken, 403);
            });
        });
    });
    describe('When deleting our account', function () {
        it('Should fail with with the root account', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.deleteMe(server.url, server.accessToken, 400);
            });
        });
    });
    describe('When register a new user', function () {
        const registrationPath = path + '/register';
        const baseCorrectParams = {
            username: 'user3',
            email: 'test3@example.com',
            password: 'my super password'
        };
        it('Should fail with a too small username', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { username: 'ji' });
                yield utils_1.makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields });
            });
        });
        it('Should fail with a too long username', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { username: 'my_super_username_which_is_very_long' });
                yield utils_1.makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields });
            });
        });
        it('Should fail with an incorrect username', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { username: 'my username' });
                yield utils_1.makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields });
            });
        });
        it('Should fail with a missing email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = lodash_1.omit(baseCorrectParams, 'email');
                yield utils_1.makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields });
            });
        });
        it('Should fail with an invalid email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { email: 'test_example.com' });
                yield utils_1.makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields });
            });
        });
        it('Should fail with a too small password', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { password: 'bla' });
                yield utils_1.makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields });
            });
        });
        it('Should fail with a too long password', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { password: 'super'.repeat(61) });
                yield utils_1.makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields });
            });
        });
        it('Should fail if we register a user with the same username', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { username: 'root' });
                yield utils_1.makePostBodyRequest({
                    url: server.url,
                    path: registrationPath,
                    token: server.accessToken,
                    fields,
                    statusCodeExpected: 409
                });
            });
        });
        it('Should fail with a "peertube" username', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { username: 'peertube' });
                yield utils_1.makePostBodyRequest({
                    url: server.url,
                    path: registrationPath,
                    token: server.accessToken,
                    fields,
                    statusCodeExpected: 409
                });
            });
        });
        it('Should fail if we register a user with the same email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { email: 'admin1@example.com' });
                yield utils_1.makePostBodyRequest({
                    url: server.url,
                    path: registrationPath,
                    token: server.accessToken,
                    fields,
                    statusCodeExpected: 409
                });
            });
        });
        it('Should succeed with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makePostBodyRequest({
                    url: server.url,
                    path: registrationPath,
                    token: server.accessToken,
                    fields: baseCorrectParams,
                    statusCodeExpected: 204
                });
            });
        });
        it('Should fail on a server with registration disabled', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    username: 'user4',
                    email: 'test4@example.com',
                    password: 'my super password 4'
                };
                yield utils_1.makePostBodyRequest({
                    url: serverWithRegistrationDisabled.url,
                    path: registrationPath,
                    token: serverWithRegistrationDisabled.accessToken,
                    fields,
                    statusCodeExpected: 403
                });
            });
        });
    });
    describe('When registering multiple users on a server with users limit', function () {
        it('Should fail when after 3 registrations', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.registerUser(server.url, 'user42', 'super password', 403);
            });
        });
    });
    describe('When having a video quota', function () {
        it('Should fail with a user having too many videos', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.updateUser({
                    url: server.url,
                    userId: rootId,
                    accessToken: server.accessToken,
                    videoQuota: 42
                });
                yield utils_1.uploadVideo(server.url, server.accessToken, {}, 403);
            });
        });
        it('Should fail with a registered user having too many videos', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(30000);
                const user = {
                    username: 'user3',
                    password: 'my super password'
                };
                userAccessToken = yield utils_1.userLogin(server, user);
                const videoAttributes = { fixture: 'video_short2.webm' };
                yield utils_1.uploadVideo(server.url, userAccessToken, videoAttributes);
                yield utils_1.uploadVideo(server.url, userAccessToken, videoAttributes);
                yield utils_1.uploadVideo(server.url, userAccessToken, videoAttributes);
                yield utils_1.uploadVideo(server.url, userAccessToken, videoAttributes);
                yield utils_1.uploadVideo(server.url, userAccessToken, videoAttributes);
                yield utils_1.uploadVideo(server.url, userAccessToken, videoAttributes, 403);
            });
        });
        it('Should fail to import with HTTP/Torrent/magnet', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(120000);
                const baseAttributes = {
                    channelId: 1,
                    privacy: videos_1.VideoPrivacy.PUBLIC
                };
                yield video_imports_1.importVideo(server.url, server.accessToken, utils_1.immutableAssign(baseAttributes, { targetUrl: video_imports_1.getYoutubeVideoUrl() }));
                yield video_imports_1.importVideo(server.url, server.accessToken, utils_1.immutableAssign(baseAttributes, { magnetUri: video_imports_1.getMagnetURI() }));
                yield video_imports_1.importVideo(server.url, server.accessToken, utils_1.immutableAssign(baseAttributes, { torrentfile: 'video-720p.torrent' }));
                yield jobs_1.waitJobs([server]);
                const res = yield video_imports_1.getMyVideoImports(server.url, server.accessToken);
                chai_1.expect(res.body.total).to.equal(3);
                const videoImports = res.body.data;
                chai_1.expect(videoImports).to.have.lengthOf(3);
                for (const videoImport of videoImports) {
                    chai_1.expect(videoImport.state.id).to.equal(shared_1.VideoImportState.FAILED);
                    chai_1.expect(videoImport.error).not.to.be.undefined;
                    chai_1.expect(videoImport.error).to.contain('user video quota is exceeded');
                }
            });
        });
    });
    describe('When having a daily video quota', function () {
        it('Should fail with a user having too many videos', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.updateUser({
                    url: server.url,
                    userId: rootId,
                    accessToken: server.accessToken,
                    videoQuotaDaily: 42
                });
                yield utils_1.uploadVideo(server.url, server.accessToken, {}, 403);
            });
        });
    });
    describe('When having an absolute and daily video quota', function () {
        it('Should fail if exceeding total quota', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.updateUser({
                    url: server.url,
                    userId: rootId,
                    accessToken: server.accessToken,
                    videoQuota: 42,
                    videoQuotaDaily: 1024 * 1024 * 1024
                });
                yield utils_1.uploadVideo(server.url, server.accessToken, {}, 403);
            });
        });
        it('Should fail if exceeding daily quota', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.updateUser({
                    url: server.url,
                    userId: rootId,
                    accessToken: server.accessToken,
                    videoQuota: 1024 * 1024 * 1024,
                    videoQuotaDaily: 42
                });
                yield utils_1.uploadVideo(server.url, server.accessToken, {}, 403);
            });
        });
    });
    describe('When asking a password reset', function () {
        const path = '/api/v1/users/ask-reset-password';
        it('Should fail with a missing email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {};
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with an invalid email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { email: 'hello' };
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should success with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { email: 'admin@example.com' };
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 204 });
            });
        });
    });
    describe('When asking for an account verification email', function () {
        const path = '/api/v1/users/ask-send-verify-email';
        it('Should fail with a missing email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {};
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with an invalid email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { email: 'hello' };
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should succeed with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { email: 'admin@example.com' };
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 204 });
            });
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers([server, serverWithRegistrationDisabled]);
            if (this['ok']) {
                yield utils_1.flushTests();
            }
        });
    });
});
