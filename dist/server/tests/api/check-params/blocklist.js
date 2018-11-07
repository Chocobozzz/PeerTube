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
describe('Test blocklist API validators', function () {
    let servers;
    let server;
    let userAccessToken;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            yield utils_1.flushTests();
            servers = yield utils_1.flushAndRunMultipleServers(2);
            yield utils_1.setAccessTokensToServers(servers);
            server = servers[0];
            const user = { username: 'user1', password: 'password' };
            yield utils_1.createUser(server.url, server.accessToken, user.username, user.password);
            userAccessToken = yield utils_1.userLogin(server, user);
            yield utils_1.doubleFollow(servers[0], servers[1]);
        });
    });
    describe('When managing user blocklist', function () {
        describe('When managing user accounts blocklist', function () {
            const path = '/api/v1/users/me/blocklist/accounts';
            describe('When listing blocked accounts', function () {
                it('Should fail with an unauthenticated user', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeGetRequest({
                            url: server.url,
                            path,
                            statusCodeExpected: 401
                        });
                    });
                });
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
            });
            describe('When blocking an account', function () {
                it('Should fail with an unauthenticated user', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            path,
                            fields: { accountName: 'user1' },
                            statusCodeExpected: 401
                        });
                    });
                });
                it('Should fail with an unknown account', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: server.accessToken,
                            path,
                            fields: { accountName: 'user2' },
                            statusCodeExpected: 404
                        });
                    });
                });
                it('Should fail to block ourselves', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: server.accessToken,
                            path,
                            fields: { accountName: 'root' },
                            statusCodeExpected: 409
                        });
                    });
                });
                it('Should succeed with the correct params', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: server.accessToken,
                            path,
                            fields: { accountName: 'user1' },
                            statusCodeExpected: 204
                        });
                    });
                });
            });
            describe('When unblocking an account', function () {
                it('Should fail with an unauthenticated user', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/user1',
                            statusCodeExpected: 401
                        });
                    });
                });
                it('Should fail with an unknown account block', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/user2',
                            token: server.accessToken,
                            statusCodeExpected: 404
                        });
                    });
                });
                it('Should succeed with the correct params', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/user1',
                            token: server.accessToken,
                            statusCodeExpected: 204
                        });
                    });
                });
            });
        });
        describe('When managing user servers blocklist', function () {
            const path = '/api/v1/users/me/blocklist/servers';
            describe('When listing blocked servers', function () {
                it('Should fail with an unauthenticated user', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeGetRequest({
                            url: server.url,
                            path,
                            statusCodeExpected: 401
                        });
                    });
                });
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
            });
            describe('When blocking a server', function () {
                it('Should fail with an unauthenticated user', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            path,
                            fields: { host: 'localhost:9002' },
                            statusCodeExpected: 401
                        });
                    });
                });
                it('Should fail with an unknown server', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: server.accessToken,
                            path,
                            fields: { host: 'localhost:9003' },
                            statusCodeExpected: 404
                        });
                    });
                });
                it('Should fail with our own server', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: server.accessToken,
                            path,
                            fields: { host: 'localhost:9001' },
                            statusCodeExpected: 409
                        });
                    });
                });
                it('Should succeed with the correct params', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: server.accessToken,
                            path,
                            fields: { host: 'localhost:9002' },
                            statusCodeExpected: 204
                        });
                    });
                });
            });
            describe('When unblocking a server', function () {
                it('Should fail with an unauthenticated user', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/localhost:9002',
                            statusCodeExpected: 401
                        });
                    });
                });
                it('Should fail with an unknown server block', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/localhost:9003',
                            token: server.accessToken,
                            statusCodeExpected: 404
                        });
                    });
                });
                it('Should succeed with the correct params', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/localhost:9002',
                            token: server.accessToken,
                            statusCodeExpected: 204
                        });
                    });
                });
            });
        });
    });
    describe('When managing server blocklist', function () {
        describe('When managing server accounts blocklist', function () {
            const path = '/api/v1/server/blocklist/accounts';
            describe('When listing blocked accounts', function () {
                it('Should fail with an unauthenticated user', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeGetRequest({
                            url: server.url,
                            path,
                            statusCodeExpected: 401
                        });
                    });
                });
                it('Should fail with a user without the appropriate rights', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeGetRequest({
                            url: server.url,
                            token: userAccessToken,
                            path,
                            statusCodeExpected: 403
                        });
                    });
                });
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
            });
            describe('When blocking an account', function () {
                it('Should fail with an unauthenticated user', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            path,
                            fields: { accountName: 'user1' },
                            statusCodeExpected: 401
                        });
                    });
                });
                it('Should fail with a user without the appropriate rights', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: userAccessToken,
                            path,
                            fields: { accountName: 'user1' },
                            statusCodeExpected: 403
                        });
                    });
                });
                it('Should fail with an unknown account', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: server.accessToken,
                            path,
                            fields: { accountName: 'user2' },
                            statusCodeExpected: 404
                        });
                    });
                });
                it('Should fail to block ourselves', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: server.accessToken,
                            path,
                            fields: { accountName: 'root' },
                            statusCodeExpected: 409
                        });
                    });
                });
                it('Should succeed with the correct params', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: server.accessToken,
                            path,
                            fields: { accountName: 'user1' },
                            statusCodeExpected: 204
                        });
                    });
                });
            });
            describe('When unblocking an account', function () {
                it('Should fail with an unauthenticated user', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/user1',
                            statusCodeExpected: 401
                        });
                    });
                });
                it('Should fail with a user without the appropriate rights', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/user1',
                            token: userAccessToken,
                            statusCodeExpected: 403
                        });
                    });
                });
                it('Should fail with an unknown account block', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/user2',
                            token: server.accessToken,
                            statusCodeExpected: 404
                        });
                    });
                });
                it('Should succeed with the correct params', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/user1',
                            token: server.accessToken,
                            statusCodeExpected: 204
                        });
                    });
                });
            });
        });
        describe('When managing server servers blocklist', function () {
            const path = '/api/v1/server/blocklist/servers';
            describe('When listing blocked servers', function () {
                it('Should fail with an unauthenticated user', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeGetRequest({
                            url: server.url,
                            path,
                            statusCodeExpected: 401
                        });
                    });
                });
                it('Should fail with a user without the appropriate rights', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeGetRequest({
                            url: server.url,
                            token: userAccessToken,
                            path,
                            statusCodeExpected: 403
                        });
                    });
                });
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
            });
            describe('When blocking a server', function () {
                it('Should fail with an unauthenticated user', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            path,
                            fields: { host: 'localhost:9002' },
                            statusCodeExpected: 401
                        });
                    });
                });
                it('Should fail with a user without the appropriate rights', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: userAccessToken,
                            path,
                            fields: { host: 'localhost:9002' },
                            statusCodeExpected: 403
                        });
                    });
                });
                it('Should fail with an unknown server', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: server.accessToken,
                            path,
                            fields: { host: 'localhost:9003' },
                            statusCodeExpected: 404
                        });
                    });
                });
                it('Should fail with our own server', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: server.accessToken,
                            path,
                            fields: { host: 'localhost:9001' },
                            statusCodeExpected: 409
                        });
                    });
                });
                it('Should succeed with the correct params', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makePostBodyRequest({
                            url: server.url,
                            token: server.accessToken,
                            path,
                            fields: { host: 'localhost:9002' },
                            statusCodeExpected: 204
                        });
                    });
                });
            });
            describe('When unblocking a server', function () {
                it('Should fail with an unauthenticated user', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/localhost:9002',
                            statusCodeExpected: 401
                        });
                    });
                });
                it('Should fail with a user without the appropriate rights', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/localhost:9002',
                            token: userAccessToken,
                            statusCodeExpected: 403
                        });
                    });
                });
                it('Should fail with an unknown server block', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/localhost:9003',
                            token: server.accessToken,
                            statusCodeExpected: 404
                        });
                    });
                });
                it('Should succeed with the correct params', function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        yield utils_1.makeDeleteRequest({
                            url: server.url,
                            path: path + '/localhost:9002',
                            token: server.accessToken,
                            statusCodeExpected: 204
                        });
                    });
                });
            });
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers(servers);
            if (this['ok']) {
                yield utils_1.flushTests();
            }
        });
    });
});
