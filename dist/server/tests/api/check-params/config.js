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
const utils_1 = require("../../utils");
describe('Test config API validators', function () {
    const path = '/api/v1/config/custom';
    let server;
    let userAccessToken;
    const updateParams = {
        instance: {
            name: 'PeerTube updated',
            shortDescription: 'my short description',
            description: 'my super description',
            terms: 'my super terms',
            defaultClientRoute: '/videos/recently-added',
            defaultNSFWPolicy: 'blur',
            customizations: {
                javascript: 'alert("coucou")',
                css: 'body { background-color: red; }'
            }
        },
        services: {
            twitter: {
                username: '@MySuperUsername',
                whitelisted: true
            }
        },
        cache: {
            previews: {
                size: 2
            },
            captions: {
                size: 3
            }
        },
        signup: {
            enabled: false,
            limit: 5,
            requiresEmailVerification: false
        },
        admin: {
            email: 'superadmin1@example.com'
        },
        user: {
            videoQuota: 5242881,
            videoQuotaDaily: 318742
        },
        transcoding: {
            enabled: true,
            threads: 1,
            resolutions: {
                '240p': false,
                '360p': true,
                '480p': true,
                '720p': false,
                '1080p': false
            }
        },
        import: {
            videos: {
                http: {
                    enabled: false
                },
                torrent: {
                    enabled: false
                }
            }
        }
    };
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            const user = {
                username: 'user1',
                password: 'password'
            };
            yield utils_1.createUser(server.url, server.accessToken, user.username, user.password);
            userAccessToken = yield utils_1.userLogin(server, user);
        });
    });
    describe('When getting the configuration', function () {
        it('Should fail without token', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({
                    url: server.url,
                    path,
                    statusCodeExpected: 401
                });
            });
        });
        it('Should fail if the user is not an administrator', function () {
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
    describe('When updating the configuration', function () {
        it('Should fail without token', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makePutBodyRequest({
                    url: server.url,
                    path,
                    fields: updateParams,
                    statusCodeExpected: 401
                });
            });
        });
        it('Should fail if the user is not an administrator', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makePutBodyRequest({
                    url: server.url,
                    path,
                    fields: updateParams,
                    token: userAccessToken,
                    statusCodeExpected: 403
                });
            });
        });
        it('Should fail if it misses a key', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const newUpdateParams = lodash_1.omit(updateParams, 'admin.email');
                yield utils_1.makePutBodyRequest({
                    url: server.url,
                    path,
                    fields: newUpdateParams,
                    token: server.accessToken,
                    statusCodeExpected: 400
                });
            });
        });
        it('Should fail with a bad default NSFW policy', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const newUpdateParams = utils_1.immutableAssign(updateParams, {
                    instance: {
                        defaultNSFWPolicy: 'hello'
                    }
                });
                yield utils_1.makePutBodyRequest({
                    url: server.url,
                    path,
                    fields: newUpdateParams,
                    token: server.accessToken,
                    statusCodeExpected: 400
                });
            });
        });
        it('Should success with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makePutBodyRequest({
                    url: server.url,
                    path,
                    fields: updateParams,
                    token: server.accessToken,
                    statusCodeExpected: 200
                });
            });
        });
    });
    describe('When deleting the configuration', function () {
        it('Should fail without token', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeDeleteRequest({
                    url: server.url,
                    path,
                    statusCodeExpected: 401
                });
            });
        });
        it('Should fail if the user is not an administrator', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeDeleteRequest({
                    url: server.url,
                    path,
                    token: userAccessToken,
                    statusCodeExpected: 403
                });
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
//# sourceMappingURL=config.js.map