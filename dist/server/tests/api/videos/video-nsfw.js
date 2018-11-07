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
const index_1 = require("../../utils/index");
const login_1 = require("../../utils/users/login");
const users_1 = require("../../utils/users/users");
const videos_1 = require("../../utils/videos/videos");
const utils_1 = require("../../utils");
const expect = chai.expect;
describe('Test video NSFW policy', function () {
    let server;
    let userAccessToken;
    let customConfig;
    function getVideosFunctions(token, query = {}) {
        return utils_1.getMyUserInformation(server.url, server.accessToken)
            .then(res => {
            const user = res.body;
            const videoChannelName = user.videoChannels[0].name;
            const accountName = user.account.name + '@' + user.account.host;
            if (token) {
                return Promise.all([
                    utils_1.getVideosListWithToken(server.url, token, query),
                    utils_1.searchVideoWithToken(server.url, 'n', token, query),
                    utils_1.getAccountVideos(server.url, token, accountName, 0, 5, undefined, query),
                    utils_1.getVideoChannelVideos(server.url, token, videoChannelName, 0, 5, undefined, query)
                ]);
            }
            return Promise.all([
                index_1.getVideosList(server.url),
                utils_1.searchVideo(server.url, 'n'),
                utils_1.getAccountVideos(server.url, undefined, accountName, 0, 5),
                utils_1.getVideoChannelVideos(server.url, undefined, videoChannelName, 0, 5)
            ]);
        });
    }
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(50000);
            yield index_1.flushTests();
            server = yield utils_1.runServer(1);
            yield index_1.setAccessTokensToServers([server]);
            {
                const attributes = { name: 'nsfw', nsfw: true };
                yield index_1.uploadVideo(server.url, server.accessToken, attributes);
            }
            {
                const attributes = { name: 'normal', nsfw: false };
                yield index_1.uploadVideo(server.url, server.accessToken, attributes);
            }
            {
                const res = yield utils_1.getCustomConfig(server.url, server.accessToken);
                customConfig = res.body;
            }
        });
    });
    describe('Instance default NSFW policy', function () {
        it('Should display NSFW videos with display default NSFW policy', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const resConfig = yield utils_1.getConfig(server.url);
                const serverConfig = resConfig.body;
                expect(serverConfig.instance.defaultNSFWPolicy).to.equal('display');
                for (const res of yield getVideosFunctions()) {
                    expect(res.body.total).to.equal(2);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(2);
                    expect(videos[0].name).to.equal('normal');
                    expect(videos[1].name).to.equal('nsfw');
                }
            });
        });
        it('Should not display NSFW videos with do_not_list default NSFW policy', function () {
            return __awaiter(this, void 0, void 0, function* () {
                customConfig.instance.defaultNSFWPolicy = 'do_not_list';
                yield utils_1.updateCustomConfig(server.url, server.accessToken, customConfig);
                const resConfig = yield utils_1.getConfig(server.url);
                const serverConfig = resConfig.body;
                expect(serverConfig.instance.defaultNSFWPolicy).to.equal('do_not_list');
                for (const res of yield getVideosFunctions()) {
                    expect(res.body.total).to.equal(1);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(1);
                    expect(videos[0].name).to.equal('normal');
                }
            });
        });
        it('Should display NSFW videos with blur default NSFW policy', function () {
            return __awaiter(this, void 0, void 0, function* () {
                customConfig.instance.defaultNSFWPolicy = 'blur';
                yield utils_1.updateCustomConfig(server.url, server.accessToken, customConfig);
                const resConfig = yield utils_1.getConfig(server.url);
                const serverConfig = resConfig.body;
                expect(serverConfig.instance.defaultNSFWPolicy).to.equal('blur');
                for (const res of yield getVideosFunctions()) {
                    expect(res.body.total).to.equal(2);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(2);
                    expect(videos[0].name).to.equal('normal');
                    expect(videos[1].name).to.equal('nsfw');
                }
            });
        });
    });
    describe('User NSFW policy', function () {
        it('Should create a user having the default nsfw policy', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const username = 'user1';
                const password = 'my super password';
                yield users_1.createUser(server.url, server.accessToken, username, password);
                userAccessToken = yield login_1.userLogin(server, { username, password });
                const res = yield utils_1.getMyUserInformation(server.url, userAccessToken);
                const user = res.body;
                expect(user.nsfwPolicy).to.equal('blur');
            });
        });
        it('Should display NSFW videos with blur user NSFW policy', function () {
            return __awaiter(this, void 0, void 0, function* () {
                customConfig.instance.defaultNSFWPolicy = 'do_not_list';
                yield utils_1.updateCustomConfig(server.url, server.accessToken, customConfig);
                for (const res of yield getVideosFunctions(userAccessToken)) {
                    expect(res.body.total).to.equal(2);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(2);
                    expect(videos[0].name).to.equal('normal');
                    expect(videos[1].name).to.equal('nsfw');
                }
            });
        });
        it('Should display NSFW videos with display user NSFW policy', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.updateMyUser({
                    url: server.url,
                    accessToken: server.accessToken,
                    nsfwPolicy: 'display'
                });
                for (const res of yield getVideosFunctions(server.accessToken)) {
                    expect(res.body.total).to.equal(2);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(2);
                    expect(videos[0].name).to.equal('normal');
                    expect(videos[1].name).to.equal('nsfw');
                }
            });
        });
        it('Should not display NSFW videos with do_not_list user NSFW policy', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.updateMyUser({
                    url: server.url,
                    accessToken: server.accessToken,
                    nsfwPolicy: 'do_not_list'
                });
                for (const res of yield getVideosFunctions(server.accessToken)) {
                    expect(res.body.total).to.equal(1);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(1);
                    expect(videos[0].name).to.equal('normal');
                }
            });
        });
        it('Should be able to see my NSFW videos even with do_not_list user NSFW policy', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield videos_1.getMyVideos(server.url, server.accessToken, 0, 5);
                expect(res.body.total).to.equal(2);
                const videos = res.body.data;
                expect(videos).to.have.lengthOf(2);
                expect(videos[0].name).to.equal('normal');
                expect(videos[1].name).to.equal('nsfw');
            });
        });
        it('Should display NSFW videos when the nsfw param === true', function () {
            return __awaiter(this, void 0, void 0, function* () {
                for (const res of yield getVideosFunctions(server.accessToken, { nsfw: true })) {
                    expect(res.body.total).to.equal(1);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(1);
                    expect(videos[0].name).to.equal('nsfw');
                }
            });
        });
        it('Should hide NSFW videos when the nsfw param === true', function () {
            return __awaiter(this, void 0, void 0, function* () {
                for (const res of yield getVideosFunctions(server.accessToken, { nsfw: false })) {
                    expect(res.body.total).to.equal(1);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(1);
                    expect(videos[0].name).to.equal('normal');
                }
            });
        });
        it('Should display both videos when the nsfw param === both', function () {
            return __awaiter(this, void 0, void 0, function* () {
                for (const res of yield getVideosFunctions(server.accessToken, { nsfw: 'both' })) {
                    expect(res.body.total).to.equal(2);
                    const videos = res.body.data;
                    expect(videos).to.have.lengthOf(2);
                    expect(videos[0].name).to.equal('normal');
                    expect(videos[1].name).to.equal('nsfw');
                }
            });
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers([server]);
        });
    });
});
//# sourceMappingURL=video-nsfw.js.map