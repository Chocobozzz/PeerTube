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
const request = require("supertest");
const utils_1 = require("./utils");
const expect = chai.expect;
function checkIndexTags(html, title, description, css) {
    expect(html).to.contain('<title>' + title + '</title>');
    expect(html).to.contain('<meta name="description" content="' + description + '" />');
    expect(html).to.contain('<style class="custom-css-style">' + css + '</style>');
}
describe('Test a client controllers', function () {
    let server;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(120000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            server.accessToken = yield utils_1.serverLogin(server);
            const videoAttributes = {
                name: 'my super name for server 1',
                description: 'my super description for server 1'
            };
            yield utils_1.uploadVideo(server.url, server.accessToken, videoAttributes);
            const res = yield utils_1.getVideosList(server.url);
            const videos = res.body.data;
            expect(videos.length).to.equal(1);
            server.video = videos[0];
        });
    });
    it('Should have valid Open Graph tags on the watch page with video id', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield request(server.url)
                .get('/videos/watch/' + server.video.id)
                .set('Accept', 'text/html')
                .expect(200);
            expect(res.text).to.contain('<meta property="og:title" content="my super name for server 1" />');
            expect(res.text).to.contain('<meta property="og:description" content="my super description for server 1" />');
        });
    });
    it('Should have valid Open Graph tags on the watch page with video uuid', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield request(server.url)
                .get('/videos/watch/' + server.video.uuid)
                .set('Accept', 'text/html')
                .expect(200);
            expect(res.text).to.contain('<meta property="og:title" content="my super name for server 1" />');
            expect(res.text).to.contain('<meta property="og:description" content="my super description for server 1" />');
        });
    });
    it('Should have valid oEmbed discovery tags', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const path = '/videos/watch/' + server.video.uuid;
            const res = yield request(server.url)
                .get(path)
                .set('Accept', 'text/html')
                .expect(200);
            const expectedLink = '<link rel="alternate" type="application/json+oembed" href="http://localhost:9001/services/oembed?' +
                `url=http%3A%2F%2Flocalhost%3A9001%2Fvideos%2Fwatch%2F${server.video.uuid}" ` +
                `title="${server.video.name}" />`;
            expect(res.text).to.contain(expectedLink);
        });
    });
    it('Should have valid twitter card', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield request(server.url)
                .get('/videos/watch/' + server.video.uuid)
                .set('Accept', 'text/html')
                .expect(200);
            expect(res.text).to.contain('<meta property="twitter:card" content="summary_large_image" />');
            expect(res.text).to.contain('<meta property="twitter:site" content="@Chocobozzz" />');
        });
    });
    it('Should have valid twitter card if Twitter is whitelisted', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res1 = yield utils_1.getCustomConfig(server.url, server.accessToken);
            const config = res1.body;
            config.services.twitter = {
                username: '@Kuja',
                whitelisted: true
            };
            yield utils_1.updateCustomConfig(server.url, server.accessToken, config);
            const res = yield request(server.url)
                .get('/videos/watch/' + server.video.uuid)
                .set('Accept', 'text/html')
                .expect(200);
            expect(res.text).to.contain('<meta property="twitter:card" content="player" />');
            expect(res.text).to.contain('<meta property="twitter:site" content="@Kuja" />');
        });
    });
    it('Should have valid index html tags (title, description...)', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.makeHTMLRequest(server.url, '/videos/trending');
            const description = 'PeerTube, a federated (ActivityPub) video streaming platform using P2P (BitTorrent) directly in the web browser ' +
                'with WebTorrent and Angular.';
            checkIndexTags(res.text, 'PeerTube', description, '');
        });
    });
    it('Should update the customized configuration and have the correct index html tags', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield utils_1.updateCustomSubConfig(server.url, server.accessToken, {
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
                }
            });
            const res = yield utils_1.makeHTMLRequest(server.url, '/videos/trending');
            checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }');
        });
    });
    it('Should have valid index html updated tags (title, description...)', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.makeHTMLRequest(server.url, '/videos/trending');
            checkIndexTags(res.text, 'PeerTube updated', 'my short description', 'body { background-color: red; }');
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers([server]);
        });
    });
});
