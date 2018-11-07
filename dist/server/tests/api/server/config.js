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
const chai = require("chai");
const utils_1 = require("../../utils");
const index_1 = require("../../utils/index");
const expect = chai.expect;
function checkInitialConfig(data) {
    expect(data.instance.name).to.equal('PeerTube');
    expect(data.instance.shortDescription).to.equal('PeerTube, a federated (ActivityPub) video streaming platform using P2P (BitTorrent) directly in the web browser ' +
        'with WebTorrent and Angular.');
    expect(data.instance.description).to.equal('Welcome to this PeerTube instance!');
    expect(data.instance.terms).to.equal('No terms for now.');
    expect(data.instance.defaultClientRoute).to.equal('/videos/trending');
    expect(data.instance.defaultNSFWPolicy).to.equal('display');
    expect(data.instance.customizations.css).to.be.empty;
    expect(data.instance.customizations.javascript).to.be.empty;
    expect(data.services.twitter.username).to.equal('@Chocobozzz');
    expect(data.services.twitter.whitelisted).to.be.false;
    expect(data.cache.previews.size).to.equal(1);
    expect(data.cache.captions.size).to.equal(1);
    expect(data.signup.enabled).to.be.true;
    expect(data.signup.limit).to.equal(4);
    expect(data.signup.requiresEmailVerification).to.be.false;
    expect(data.admin.email).to.equal('admin1@example.com');
    expect(data.user.videoQuota).to.equal(5242880);
    expect(data.user.videoQuotaDaily).to.equal(-1);
    expect(data.transcoding.enabled).to.be.false;
    expect(data.transcoding.threads).to.equal(2);
    expect(data.transcoding.resolutions['240p']).to.be.true;
    expect(data.transcoding.resolutions['360p']).to.be.true;
    expect(data.transcoding.resolutions['480p']).to.be.true;
    expect(data.transcoding.resolutions['720p']).to.be.true;
    expect(data.transcoding.resolutions['1080p']).to.be.true;
    expect(data.import.videos.http.enabled).to.be.true;
    expect(data.import.videos.torrent.enabled).to.be.true;
}
function checkUpdatedConfig(data) {
    expect(data.instance.name).to.equal('PeerTube updated');
    expect(data.instance.shortDescription).to.equal('my short description');
    expect(data.instance.description).to.equal('my super description');
    expect(data.instance.terms).to.equal('my super terms');
    expect(data.instance.defaultClientRoute).to.equal('/videos/recently-added');
    expect(data.instance.defaultNSFWPolicy).to.equal('blur');
    expect(data.instance.customizations.javascript).to.equal('alert("coucou")');
    expect(data.instance.customizations.css).to.equal('body { background-color: red; }');
    expect(data.services.twitter.username).to.equal('@Kuja');
    expect(data.services.twitter.whitelisted).to.be.true;
    expect(data.cache.previews.size).to.equal(2);
    expect(data.cache.captions.size).to.equal(3);
    expect(data.signup.enabled).to.be.false;
    expect(data.signup.limit).to.equal(5);
    expect(data.signup.requiresEmailVerification).to.be.true;
    expect(data.admin.email).to.equal('superadmin1@example.com');
    expect(data.user.videoQuota).to.equal(5242881);
    expect(data.user.videoQuotaDaily).to.equal(318742);
    expect(data.transcoding.enabled).to.be.true;
    expect(data.transcoding.threads).to.equal(1);
    expect(data.transcoding.resolutions['240p']).to.be.false;
    expect(data.transcoding.resolutions['360p']).to.be.true;
    expect(data.transcoding.resolutions['480p']).to.be.true;
    expect(data.transcoding.resolutions['720p']).to.be.false;
    expect(data.transcoding.resolutions['1080p']).to.be.false;
    expect(data.import.videos.http.enabled).to.be.false;
    expect(data.import.videos.torrent.enabled).to.be.false;
}
describe('Test config', function () {
    let server = null;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield index_1.flushTests();
            server = yield index_1.runServer(1);
            yield index_1.setAccessTokensToServers([server]);
        });
    });
    it('Should have a correct config on a server with registration enabled', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.getConfig(server.url);
            const data = res.body;
            expect(data.signup.allowed).to.be.true;
        });
    });
    it('Should have a correct config on a server with registration enabled and a users limit', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(5000);
            yield Promise.all([
                index_1.registerUser(server.url, 'user1', 'super password'),
                index_1.registerUser(server.url, 'user2', 'super password'),
                index_1.registerUser(server.url, 'user3', 'super password')
            ]);
            const res = yield index_1.getConfig(server.url);
            const data = res.body;
            expect(data.signup.allowed).to.be.false;
        });
    });
    it('Should get the customized configuration', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield index_1.getCustomConfig(server.url, server.accessToken);
            const data = res.body;
            checkInitialConfig(data);
        });
    });
    it('Should update the customized configuration', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const newCustomConfig = {
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
                        username: '@Kuja',
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
                    requiresEmailVerification: true
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
            yield index_1.updateCustomConfig(server.url, server.accessToken, newCustomConfig);
            const res = yield index_1.getCustomConfig(server.url, server.accessToken);
            const data = res.body;
            checkUpdatedConfig(data);
        });
    });
    it('Should have the configuration updated after a restart', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            utils_1.killallServers([server]);
            yield utils_1.reRunServer(server);
            const res = yield index_1.getCustomConfig(server.url, server.accessToken);
            const data = res.body;
            checkUpdatedConfig(data);
        });
    });
    it('Should fetch the about information', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.getAbout(server.url);
            const data = res.body;
            expect(data.instance.name).to.equal('PeerTube updated');
            expect(data.instance.shortDescription).to.equal('my short description');
            expect(data.instance.description).to.equal('my super description');
            expect(data.instance.terms).to.equal('my super terms');
        });
    });
    it('Should remove the custom configuration', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(10000);
            yield utils_1.deleteCustomConfig(server.url, server.accessToken);
            const res = yield index_1.getCustomConfig(server.url, server.accessToken);
            const data = res.body;
            checkInitialConfig(data);
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers([server]);
        });
    });
});
//# sourceMappingURL=config.js.map