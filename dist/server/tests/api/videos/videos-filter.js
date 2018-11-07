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
const videos_1 = require("../../../../shared/models/videos");
const users_1 = require("../../../../shared/models/users");
const expect = chai.expect;
function getVideosNames(server, token, filter, statusCodeExpected = 200) {
    return __awaiter(this, void 0, void 0, function* () {
        const paths = [
            '/api/v1/video-channels/root_channel/videos',
            '/api/v1/accounts/root/videos',
            '/api/v1/videos',
            '/api/v1/search/videos'
        ];
        const videosResults = [];
        for (const path of paths) {
            const res = yield utils_1.makeGetRequest({
                url: server.url,
                path,
                token,
                query: {
                    sort: 'createdAt',
                    filter
                },
                statusCodeExpected
            });
            videosResults.push(res.body.data.map(v => v.name));
        }
        return videosResults;
    });
}
describe('Test videos filter validator', function () {
    let servers;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(120000);
            yield utils_1.flushTests();
            servers = yield utils_1.flushAndRunMultipleServers(2);
            yield utils_1.setAccessTokensToServers(servers);
            for (const server of servers) {
                const moderator = { username: 'moderator', password: 'my super password' };
                yield utils_1.createUser(server.url, server.accessToken, moderator.username, moderator.password, undefined, undefined, users_1.UserRole.MODERATOR);
                server['moderatorAccessToken'] = yield utils_1.userLogin(server, moderator);
                yield utils_1.uploadVideo(server.url, server.accessToken, { name: 'public ' + server.serverNumber });
                {
                    const attributes = { name: 'unlisted ' + server.serverNumber, privacy: videos_1.VideoPrivacy.UNLISTED };
                    yield utils_1.uploadVideo(server.url, server.accessToken, attributes);
                }
                {
                    const attributes = { name: 'private ' + server.serverNumber, privacy: videos_1.VideoPrivacy.PRIVATE };
                    yield utils_1.uploadVideo(server.url, server.accessToken, attributes);
                }
            }
            yield utils_1.doubleFollow(servers[0], servers[1]);
        });
    });
    describe('Check videos filter', function () {
        it('Should display local videos', function () {
            return __awaiter(this, void 0, void 0, function* () {
                for (const server of servers) {
                    const namesResults = yield getVideosNames(server, server.accessToken, 'local');
                    for (const names of namesResults) {
                        expect(names).to.have.lengthOf(1);
                        expect(names[0]).to.equal('public ' + server.serverNumber);
                    }
                }
            });
        });
        it('Should display all local videos by the admin or the moderator', function () {
            return __awaiter(this, void 0, void 0, function* () {
                for (const server of servers) {
                    for (const token of [server.accessToken, server['moderatorAccessToken']]) {
                        const namesResults = yield getVideosNames(server, token, 'all-local');
                        for (const names of namesResults) {
                            expect(names).to.have.lengthOf(3);
                            expect(names[0]).to.equal('public ' + server.serverNumber);
                            expect(names[1]).to.equal('unlisted ' + server.serverNumber);
                            expect(names[2]).to.equal('private ' + server.serverNumber);
                        }
                    }
                }
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
//# sourceMappingURL=videos-filter.js.map