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
describe('Test server redundancy API validators', function () {
    let servers;
    let userAccessToken = null;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            servers = yield utils_1.flushAndRunMultipleServers(2);
            yield utils_1.setAccessTokensToServers(servers);
            yield utils_1.doubleFollow(servers[0], servers[1]);
            const user = {
                username: 'user1',
                password: 'password'
            };
            yield utils_1.createUser(servers[0].url, servers[0].accessToken, user.username, user.password);
            userAccessToken = yield utils_1.userLogin(servers[0], user);
        });
    });
    describe('When updating redundancy', function () {
        const path = '/api/v1/server/redundancy';
        it('Should fail with an invalid token', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makePutBodyRequest({
                    url: servers[0].url,
                    path: path + '/localhost:9002',
                    fields: { redundancyAllowed: true },
                    token: 'fake_token',
                    statusCodeExpected: 401
                });
            });
        });
        it('Should fail if the user is not an administrator', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makePutBodyRequest({
                    url: servers[0].url,
                    path: path + '/localhost:9002',
                    fields: { redundancyAllowed: true },
                    token: userAccessToken,
                    statusCodeExpected: 403
                });
            });
        });
        it('Should fail if we do not follow this server', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makePutBodyRequest({
                    url: servers[0].url,
                    path: path + '/example.com',
                    fields: { redundancyAllowed: true },
                    token: servers[0].accessToken,
                    statusCodeExpected: 404
                });
            });
        });
        it('Should fail without de redundancyAllowed param', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makePutBodyRequest({
                    url: servers[0].url,
                    path: path + '/localhost:9002',
                    fields: { blabla: true },
                    token: servers[0].accessToken,
                    statusCodeExpected: 400
                });
            });
        });
        it('Should succeed with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makePutBodyRequest({
                    url: servers[0].url,
                    path: path + '/localhost:9002',
                    fields: { redundancyAllowed: true },
                    token: servers[0].accessToken,
                    statusCodeExpected: 204
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
