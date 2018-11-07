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
const video_privacy_enum_1 = require("../../../../shared/models/videos/video-privacy.enum");
const utils_1 = require("../../utils");
const check_api_params_1 = require("../../utils/requests/check-api-params");
const video_imports_1 = require("../../utils/videos/video-imports");
describe('Test video imports API validator', function () {
    const path = '/api/v1/videos/imports';
    let server;
    let userAccessToken = '';
    let accountName;
    let channelId;
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
            {
                const res = yield utils_1.getMyUserInformation(server.url, server.accessToken);
                channelId = res.body.videoChannels[0].id;
                accountName = res.body.account.name + '@' + res.body.account.host;
            }
        });
    });
    describe('When listing my video imports', function () {
        const myPath = '/api/v1/users/me/videos/imports';
        it('Should fail with a bad start pagination', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadStartPagination(server.url, myPath, server.accessToken);
            });
        });
        it('Should fail with a bad count pagination', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadCountPagination(server.url, myPath, server.accessToken);
            });
        });
        it('Should fail with an incorrect sort', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadSortPagination(server.url, myPath, server.accessToken);
            });
        });
        it('Should success with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({ url: server.url, path: myPath, statusCodeExpected: 200, token: server.accessToken });
            });
        });
    });
    describe('When adding a video import', function () {
        let baseCorrectParams;
        before(function () {
            baseCorrectParams = {
                targetUrl: video_imports_1.getYoutubeVideoUrl(),
                name: 'my super name',
                category: 5,
                licence: 1,
                language: 'pt',
                nsfw: false,
                commentsEnabled: true,
                waitTranscoding: true,
                description: 'my super description',
                support: 'my super support text',
                tags: ['tag1', 'tag2'],
                privacy: video_privacy_enum_1.VideoPrivacy.PUBLIC,
                channelId: channelId
            };
        });
        it('Should fail with nothing', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {};
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail without a target url', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = lodash_1.omit(baseCorrectParams, 'targetUrl');
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 400 });
            });
        });
        it('Should fail with a bad target url', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { targetUrl: 'htt://hello' });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a long name', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { name: 'super'.repeat(65) });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a bad category', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { category: 125 });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a bad licence', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { licence: 125 });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a bad language', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { language: 'a'.repeat(15) });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a long description', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { description: 'super'.repeat(2500) });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a long support text', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { support: 'super'.repeat(201) });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail without a channel', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = lodash_1.omit(baseCorrectParams, 'channelId');
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a bad channel', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { channelId: 545454 });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with another user channel', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const user = {
                    username: 'fake',
                    password: 'fake_password'
                };
                yield utils_1.createUser(server.url, server.accessToken, user.username, user.password);
                const accessTokenUser = yield utils_1.userLogin(server, user);
                const res = yield utils_1.getMyUserInformation(server.url, accessTokenUser);
                const customChannelId = res.body.videoChannels[0].id;
                const fields = utils_1.immutableAssign(baseCorrectParams, { channelId: customChannelId });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields });
            });
        });
        it('Should fail with too many tags', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'] });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a tag length too low', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { tags: ['tag1', 't'] });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with a tag length too big', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = utils_1.immutableAssign(baseCorrectParams, { tags: ['tag1', 'my_super_tag_too_long_long_long_long_long_long'] });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should fail with an incorrect thumbnail file', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = baseCorrectParams;
                const attaches = {
                    'thumbnailfile': path_1.join(__dirname, '..', '..', 'fixtures', 'avatar.png')
                };
                yield utils_1.makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches });
            });
        });
        it('Should fail with a big thumbnail file', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = baseCorrectParams;
                const attaches = {
                    'thumbnailfile': path_1.join(__dirname, '..', '..', 'fixtures', 'avatar-big.png')
                };
                yield utils_1.makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches });
            });
        });
        it('Should fail with an incorrect preview file', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = baseCorrectParams;
                const attaches = {
                    'previewfile': path_1.join(__dirname, '..', '..', 'fixtures', 'avatar.png')
                };
                yield utils_1.makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches });
            });
        });
        it('Should fail with a big preview file', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = baseCorrectParams;
                const attaches = {
                    'previewfile': path_1.join(__dirname, '..', '..', 'fixtures', 'avatar-big.png')
                };
                yield utils_1.makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches });
            });
        });
        it('Should fail with an invalid torrent file', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = lodash_1.omit(baseCorrectParams, 'targetUrl');
                const attaches = {
                    'torrentfile': path_1.join(__dirname, '..', '..', 'fixtures', 'avatar-big.png')
                };
                yield utils_1.makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches });
            });
        });
        it('Should fail with an invalid magnet URI', function () {
            return __awaiter(this, void 0, void 0, function* () {
                let fields = lodash_1.omit(baseCorrectParams, 'targetUrl');
                fields = utils_1.immutableAssign(fields, { magnetUri: 'blabla' });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields });
            });
        });
        it('Should succeed with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(30000);
                {
                    yield utils_1.makePostBodyRequest({
                        url: server.url,
                        path,
                        token: server.accessToken,
                        fields: baseCorrectParams,
                        statusCodeExpected: 200
                    });
                }
            });
        });
        it('Should forbid to import http videos', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.updateCustomSubConfig(server.url, server.accessToken, {
                    import: {
                        videos: {
                            http: {
                                enabled: false
                            },
                            torrent: {
                                enabled: true
                            }
                        }
                    }
                });
                yield utils_1.makePostBodyRequest({
                    url: server.url,
                    path,
                    token: server.accessToken,
                    fields: baseCorrectParams,
                    statusCodeExpected: 409
                });
            });
        });
        it('Should forbid to import torrent videos', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.updateCustomSubConfig(server.url, server.accessToken, {
                    import: {
                        videos: {
                            http: {
                                enabled: true
                            },
                            torrent: {
                                enabled: false
                            }
                        }
                    }
                });
                let fields = lodash_1.omit(baseCorrectParams, 'targetUrl');
                fields = utils_1.immutableAssign(fields, { magnetUri: video_imports_1.getMagnetURI() });
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 409 });
                fields = lodash_1.omit(fields, 'magnetUri');
                const attaches = {
                    'torrentfile': path_1.join(__dirname, '..', '..', 'fixtures', 'video-720p.torrent')
                };
                yield utils_1.makeUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches, statusCodeExpected: 409 });
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
//# sourceMappingURL=video-imports.js.map