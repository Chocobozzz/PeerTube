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
const videos_1 = require("../../../../shared/models/videos");
describe('Test video abuses API validators', function () {
    let server;
    let userAccessToken = '';
    let videoAbuseId;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            const username = 'user1';
            const password = 'my super password';
            yield utils_1.createUser(server.url, server.accessToken, username, password);
            userAccessToken = yield utils_1.userLogin(server, { username, password });
            const res = yield utils_1.uploadVideo(server.url, server.accessToken, {});
            server.video = res.body.video;
        });
    });
    describe('When listing video abuses', function () {
        const path = '/api/v1/videos/abuse';
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
    describe('When reporting a video abuse', function () {
        const basePath = '/api/v1/videos/';
        let path;
        before(() => {
            path = basePath + server.video.id + '/abuse';
        });
        it('Should fail with nothing', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {};
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a wrong video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const wrongPath = '/api/v1/videos/blabla/abuse';
                const fields = { reason: 'my super reason' };
                yield utils_1.makePostBodyRequest({ url: server.url, path: wrongPath, token: server.accessToken, fields });
            });
        });
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { reason: 'my super reason' };
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: 'hello', fields, statusCodeExpected: 401 });
            });
        });
        it('Should fail with a reason too short', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { reason: 'h' };
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a reason too big', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { reason: 'super'.repeat(61) };
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should succeed with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { reason: 'super reason' };
                const res = yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 200 });
                videoAbuseId = res.body.videoAbuse.id;
            });
        });
    });
    describe('When updating a video abuse', function () {
        const basePath = '/api/v1/videos/';
        let path;
        before(() => {
            path = basePath + server.video.id + '/abuse/' + videoAbuseId;
        });
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.updateVideoAbuse(server.url, 'blabla', server.video.uuid, videoAbuseId, {}, 401);
            });
        });
        it('Should fail with a non admin user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.updateVideoAbuse(server.url, userAccessToken, server.video.uuid, videoAbuseId, {}, 403);
            });
        });
        it('Should fail with a bad video id or bad video abuse id', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.updateVideoAbuse(server.url, server.accessToken, server.video.uuid, 45, {}, 404);
                yield utils_1.updateVideoAbuse(server.url, server.accessToken, 52, videoAbuseId, {}, 404);
            });
        });
        it('Should fail with a bad state', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const body = { state: 5 };
                yield utils_1.updateVideoAbuse(server.url, server.accessToken, server.video.uuid, videoAbuseId, body, 400);
            });
        });
        it('Should fail with a bad moderation comment', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const body = { moderationComment: 'b'.repeat(305) };
                yield utils_1.updateVideoAbuse(server.url, server.accessToken, server.video.uuid, videoAbuseId, body, 400);
            });
        });
        it('Should succeed with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const body = { state: videos_1.VideoAbuseState.ACCEPTED };
                yield utils_1.updateVideoAbuse(server.url, server.accessToken, server.video.uuid, videoAbuseId, body);
            });
        });
    });
    describe('When deleting a video abuse', function () {
        const basePath = '/api/v1/videos/';
        let path;
        before(() => {
            path = basePath + server.video.id + '/abuse/' + videoAbuseId;
        });
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.deleteVideoAbuse(server.url, 'blabla', server.video.uuid, videoAbuseId, 401);
            });
        });
        it('Should fail with a non admin user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.deleteVideoAbuse(server.url, userAccessToken, server.video.uuid, videoAbuseId, 403);
            });
        });
        it('Should fail with a bad video id or bad video abuse id', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.deleteVideoAbuse(server.url, server.accessToken, server.video.uuid, 45, 404);
                yield utils_1.deleteVideoAbuse(server.url, server.accessToken, 52, videoAbuseId, 404);
            });
        });
        it('Should succeed with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.deleteVideoAbuse(server.url, server.accessToken, server.video.uuid, videoAbuseId);
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
//# sourceMappingURL=video-abuses.js.map