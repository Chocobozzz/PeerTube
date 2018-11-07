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
const path_1 = require("path");
const video_captions_1 = require("../../utils/videos/video-captions");
describe('Test video captions API validator', function () {
    const path = '/api/v1/videos/';
    let server;
    let userAccessToken;
    let videoUUID;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            {
                const res = yield utils_1.uploadVideo(server.url, server.accessToken, {});
                videoUUID = res.body.video.uuid;
            }
            {
                const user = {
                    username: 'user1',
                    password: 'my super password'
                };
                yield utils_1.createUser(server.url, server.accessToken, user.username, user.password);
                userAccessToken = yield utils_1.userLogin(server, user);
            }
        });
    });
    describe('When adding video caption', function () {
        const fields = {};
        const attaches = {
            'captionfile': path_1.join(__dirname, '..', '..', 'fixtures', 'subtitle-good1.vtt')
        };
        it('Should fail without a valid uuid', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeUploadRequest({
                    method: 'PUT',
                    url: server.url,
                    path: path + '4da6fde3-88f7-4d16-b119-108df563d0b06/captions',
                    token: server.accessToken,
                    fields,
                    attaches
                });
            });
        });
        it('Should fail with an unknown id', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeUploadRequest({
                    method: 'PUT',
                    url: server.url,
                    path: path + '4da6fde3-88f7-4d16-b119-108df5630b06/captions',
                    token: server.accessToken,
                    fields,
                    attaches
                });
            });
        });
        it('Should fail with a missing language in path', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const captionPath = path + videoUUID + '/captions';
                yield utils_1.makeUploadRequest({
                    method: 'PUT',
                    url: server.url,
                    path: captionPath,
                    token: server.accessToken,
                    fields,
                    attaches
                });
            });
        });
        it('Should fail with an unknown language', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const captionPath = path + videoUUID + '/captions/15';
                yield utils_1.makeUploadRequest({
                    method: 'PUT',
                    url: server.url,
                    path: captionPath,
                    token: server.accessToken,
                    fields,
                    attaches
                });
            });
        });
        it('Should fail without access token', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const captionPath = path + videoUUID + '/captions/fr';
                yield utils_1.makeUploadRequest({
                    method: 'PUT',
                    url: server.url,
                    path: captionPath,
                    fields,
                    attaches,
                    statusCodeExpected: 401
                });
            });
        });
        it('Should fail with a bad access token', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const captionPath = path + videoUUID + '/captions/fr';
                yield utils_1.makeUploadRequest({
                    method: 'PUT',
                    url: server.url,
                    path: captionPath,
                    token: 'blabla',
                    fields,
                    attaches,
                    statusCodeExpected: 401
                });
            });
        });
        it('Should fail with an invalid captionfile extension', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const attaches = {
                    'captionfile': path_1.join(__dirname, '..', '..', 'fixtures', 'subtitle-bad.txt')
                };
                const captionPath = path + videoUUID + '/captions/fr';
                yield utils_1.makeUploadRequest({
                    method: 'PUT',
                    url: server.url,
                    path: captionPath,
                    token: server.accessToken,
                    fields,
                    attaches,
                    statusCodeExpected: 400
                });
            });
        });
        it('Should succeed with a valid captionfile extension and octet-stream mime type', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield video_captions_1.createVideoCaption({
                    url: server.url,
                    accessToken: server.accessToken,
                    language: 'zh',
                    videoId: videoUUID,
                    fixture: 'subtitle-good.srt',
                    mimeType: 'application/octet-stream'
                });
            });
        });
        it('Should success with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const captionPath = path + videoUUID + '/captions/fr';
                yield utils_1.makeUploadRequest({
                    method: 'PUT',
                    url: server.url,
                    path: captionPath,
                    token: server.accessToken,
                    fields,
                    attaches,
                    statusCodeExpected: 204
                });
            });
        });
    });
    describe('When listing video captions', function () {
        it('Should fail without a valid uuid', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({ url: server.url, path: path + '4da6fde3-88f7-4d16-b119-108df563d0b06/captions' });
            });
        });
        it('Should fail with an unknown id', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({ url: server.url, path: path + '4da6fde3-88f7-4d16-b119-108df5630b06/captions', statusCodeExpected: 404 });
            });
        });
        it('Should success with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({ url: server.url, path: path + videoUUID + '/captions', statusCodeExpected: 200 });
            });
        });
    });
    describe('When deleting video caption', function () {
        it('Should fail without a valid uuid', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeDeleteRequest({
                    url: server.url,
                    path: path + '4da6fde3-88f7-4d16-b119-108df563d0b06/captions/fr',
                    token: server.accessToken
                });
            });
        });
        it('Should fail with an unknown id', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeDeleteRequest({
                    url: server.url,
                    path: path + '4da6fde3-88f7-4d16-b119-108df5630b06/captions/fr',
                    token: server.accessToken,
                    statusCodeExpected: 404
                });
            });
        });
        it('Should fail with an invalid language', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeDeleteRequest({
                    url: server.url,
                    path: path + '4da6fde3-88f7-4d16-b119-108df5630b06/captions/16',
                    token: server.accessToken
                });
            });
        });
        it('Should fail with a missing language', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const captionPath = path + videoUUID + '/captions';
                yield utils_1.makeDeleteRequest({ url: server.url, path: captionPath, token: server.accessToken });
            });
        });
        it('Should fail with an unknown language', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const captionPath = path + videoUUID + '/captions/15';
                yield utils_1.makeDeleteRequest({ url: server.url, path: captionPath, token: server.accessToken });
            });
        });
        it('Should fail without access token', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const captionPath = path + videoUUID + '/captions/fr';
                yield utils_1.makeDeleteRequest({ url: server.url, path: captionPath, statusCodeExpected: 401 });
            });
        });
        it('Should fail with a bad access token', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const captionPath = path + videoUUID + '/captions/fr';
                yield utils_1.makeDeleteRequest({ url: server.url, path: captionPath, token: 'coucou', statusCodeExpected: 401 });
            });
        });
        it('Should fail with another user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const captionPath = path + videoUUID + '/captions/fr';
                yield utils_1.makeDeleteRequest({ url: server.url, path: captionPath, token: userAccessToken, statusCodeExpected: 403 });
            });
        });
        it('Should success with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const captionPath = path + videoUUID + '/captions/fr';
                yield utils_1.makeDeleteRequest({ url: server.url, path: captionPath, token: server.accessToken, statusCodeExpected: 204 });
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
//# sourceMappingURL=video-captions.js.map