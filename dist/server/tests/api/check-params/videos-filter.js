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
const utils_1 = require("../../utils");
const users_1 = require("../../../../shared/models/users");
const expect = chai.expect;
function testEndpoints(server, token, filter, statusCodeExpected) {
    return __awaiter(this, void 0, void 0, function* () {
        const paths = [
            '/api/v1/video-channels/root_channel/videos',
            '/api/v1/accounts/root/videos',
            '/api/v1/videos',
            '/api/v1/search/videos'
        ];
        for (const path of paths) {
            yield utils_1.makeGetRequest({
                url: server.url,
                path,
                token,
                query: {
                    filter
                },
                statusCodeExpected
            });
        }
    });
}
describe('Test videos filters', function () {
    let server;
    let userAccessToken;
    let moderatorAccessToken;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            const user = { username: 'user1', password: 'my super password' };
            yield utils_1.createUser(server.url, server.accessToken, user.username, user.password);
            userAccessToken = yield utils_1.userLogin(server, user);
            const moderator = { username: 'moderator', password: 'my super password' };
            yield utils_1.createUser(server.url, server.accessToken, moderator.username, moderator.password, undefined, undefined, users_1.UserRole.MODERATOR);
            moderatorAccessToken = yield utils_1.userLogin(server, moderator);
        });
    });
    describe('When setting a video filter', function () {
        it('Should fail with a bad filter', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield testEndpoints(server, server.accessToken, 'bad-filter', 400);
            });
        });
        it('Should succeed with a good filter', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield testEndpoints(server, server.accessToken, 'local', 200);
            });
        });
        it('Should fail to list all-local with a simple user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield testEndpoints(server, userAccessToken, 'all-local', 401);
            });
        });
        it('Should succeed to list all-local with a moderator', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield testEndpoints(server, moderatorAccessToken, 'all-local', 200);
            });
        });
        it('Should succeed to list all-local with an admin', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield testEndpoints(server, server.accessToken, 'all-local', 200);
            });
        });
        it('Should fail on the feeds endpoint with the all-local filter', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/feeds/videos.json',
                    statusCodeExpected: 401,
                    query: {
                        filter: 'all-local'
                    }
                });
            });
        });
        it('Should succed on the feeds endpoint with the local filter', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/feeds/videos.json',
                    statusCodeExpected: 200,
                    query: {
                        filter: 'local'
                    }
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
//# sourceMappingURL=videos-filter.js.map