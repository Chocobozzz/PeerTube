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
const requests_1 = require("../../utils/requests/requests");
describe('Test jobs API validators', function () {
    const path = '/api/v1/jobs/failed';
    let server;
    let userAccessToken = '';
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(120000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            const user = {
                username: 'user1',
                password: 'my super password'
            };
            yield utils_1.createUser(server.url, server.accessToken, user.username, user.password);
            userAccessToken = yield utils_1.userLogin(server, user);
        });
    });
    describe('When listing jobs', function () {
        it('Should fail with a bad state', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield requests_1.makeGetRequest({
                    url: server.url,
                    token: server.accessToken,
                    path: path + 'ade'
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
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield requests_1.makeGetRequest({
                    url: server.url,
                    path,
                    statusCodeExpected: 401
                });
            });
        });
        it('Should fail with a non admin user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield requests_1.makeGetRequest({
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
