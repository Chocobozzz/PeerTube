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
require("mocha");
const utils_1 = require("../../utils");
const check_api_params_1 = require("../../utils/requests/check-api-params");
const chai_1 = require("chai");
describe('Test video blacklist API validators', function () {
    let server;
    let notBlacklistedVideoId;
    let userAccessToken1 = '';
    let userAccessToken2 = '';
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(120000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            {
                const username = 'user1';
                const password = 'my super password';
                yield utils_1.createUser(server.url, server.accessToken, username, password);
                userAccessToken1 = yield utils_1.userLogin(server, { username, password });
            }
            {
                const username = 'user2';
                const password = 'my super password';
                yield utils_1.createUser(server.url, server.accessToken, username, password);
                userAccessToken2 = yield utils_1.userLogin(server, { username, password });
            }
            {
                const res = yield utils_1.uploadVideo(server.url, userAccessToken1, {});
                server.video = res.body.video;
            }
            {
                const res = yield utils_1.uploadVideo(server.url, server.accessToken, {});
                notBlacklistedVideoId = res.body.video.uuid;
            }
        });
    });
    describe('When adding a video in blacklist', function () {
        const basePath = '/api/v1/videos/';
        it('Should fail with nothing', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = basePath + server.video + '/blacklist';
                const fields = {};
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a wrong video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const wrongPath = '/api/v1/videos/blabla/blacklist';
                const fields = {};
                yield utils_1.makePostBodyRequest({ url: server.url, path: wrongPath, token: server.accessToken, fields });
            });
        });
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = basePath + server.video + '/blacklist';
                const fields = {};
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: 'hello', fields, statusCodeExpected: 401 });
            });
        });
        it('Should fail with a non admin user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = basePath + server.video + '/blacklist';
                const fields = {};
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: userAccessToken2, fields, statusCodeExpected: 403 });
            });
        });
        it('Should fail with an invalid reason', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = basePath + server.video.uuid + '/blacklist';
                const fields = { reason: 'a'.repeat(305) };
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should succeed with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = basePath + server.video.uuid + '/blacklist';
                const fields = {};
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 204 });
            });
        });
    });
    describe('When updating a video in blacklist', function () {
        const basePath = '/api/v1/videos/';
        it('Should fail with a wrong video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const wrongPath = '/api/v1/videos/blabla/blacklist';
                const fields = {};
                yield utils_1.makePutBodyRequest({ url: server.url, path: wrongPath, token: server.accessToken, fields });
            });
        });
        it('Should fail with a video not blacklisted', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = '/api/v1/videos/' + notBlacklistedVideoId + '/blacklist';
                const fields = {};
                yield utils_1.makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 404 });
            });
        });
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = basePath + server.video + '/blacklist';
                const fields = {};
                yield utils_1.makePutBodyRequest({ url: server.url, path, token: 'hello', fields, statusCodeExpected: 401 });
            });
        });
        it('Should fail with a non admin user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = basePath + server.video + '/blacklist';
                const fields = {};
                yield utils_1.makePutBodyRequest({ url: server.url, path, token: userAccessToken2, fields, statusCodeExpected: 403 });
            });
        });
        it('Should fail with an invalid reason', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = basePath + server.video.uuid + '/blacklist';
                const fields = { reason: 'a'.repeat(305) };
                yield utils_1.makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should succeed with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = basePath + server.video.uuid + '/blacklist';
                const fields = { reason: 'hello' };
                yield utils_1.makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 204 });
            });
        });
    });
    describe('When getting blacklisted video', function () {
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.getVideo(server.url, server.video.uuid, 401);
            });
        });
        it('Should fail with another user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.getVideoWithToken(server.url, userAccessToken2, server.video.uuid, 403);
            });
        });
        it('Should succeed with the owner authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield utils_1.getVideoWithToken(server.url, userAccessToken1, server.video.uuid, 200);
                const video = res.body;
                chai_1.expect(video.blacklisted).to.be.true;
            });
        });
        it('Should succeed with an admin', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield utils_1.getVideoWithToken(server.url, server.accessToken, server.video.uuid, 200);
                const video = res.body;
                chai_1.expect(video.blacklisted).to.be.true;
            });
        });
    });
    describe('When removing a video in blacklist', function () {
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.removeVideoFromBlacklist(server.url, 'fake token', server.video.uuid, 401);
            });
        });
        it('Should fail with a non admin user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.removeVideoFromBlacklist(server.url, userAccessToken2, server.video.uuid, 403);
            });
        });
        it('Should fail with an incorrect id', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.removeVideoFromBlacklist(server.url, server.accessToken, 'hello', 400);
            });
        });
        it('Should fail with a not blacklisted video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.removeVideoFromBlacklist(server.url, server.accessToken, notBlacklistedVideoId, 404);
            });
        });
        it('Should succeed with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.removeVideoFromBlacklist(server.url, server.accessToken, server.video.uuid, 204);
            });
        });
    });
    describe('When listing videos in blacklist', function () {
        const basePath = '/api/v1/videos/blacklist/';
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.getBlacklistedVideosList(server.url, 'fake token', 401);
            });
        });
        it('Should fail with a non admin user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.getBlacklistedVideosList(server.url, userAccessToken2, 403);
            });
        });
        it('Should fail with a bad start pagination', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadStartPagination(server.url, basePath, server.accessToken);
            });
        });
        it('Should fail with a bad count pagination', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadCountPagination(server.url, basePath, server.accessToken);
            });
        });
        it('Should fail with an incorrect sort', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadSortPagination(server.url, basePath, server.accessToken);
            });
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers([server]);
            if (this['ok']) {
                yield utils_1.flushTests();
            }
        });
    });
});
