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
const servers_1 = require("../../utils/server/servers");
const expect = chai.expect;
describe('Test services', function () {
    let server = null;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield index_1.flushTests();
            server = yield servers_1.runServer(1);
            yield index_1.setAccessTokensToServers([server]);
            const videoAttributes = {
                name: 'my super name'
            };
            yield index_1.uploadVideo(server.url, server.accessToken, videoAttributes);
            const res = yield index_1.getVideosList(server.url);
            server.video = res.body.data[0];
        });
    });
    it('Should have a valid oEmbed response', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const oembedUrl = 'http://localhost:9001/videos/watch/' + server.video.uuid;
            const res = yield index_1.getOEmbed(server.url, oembedUrl);
            const expectedHtml = '<iframe width="560" height="315" sandbox="allow-same-origin allow-scripts" ' +
                `src="http://localhost:9001/videos/embed/${server.video.uuid}" ` +
                'frameborder="0" allowfullscreen></iframe>';
            const expectedThumbnailUrl = 'http://localhost:9001/static/previews/' + server.video.uuid + '.jpg';
            expect(res.body.html).to.equal(expectedHtml);
            expect(res.body.title).to.equal(server.video.name);
            expect(res.body.author_name).to.equal(server.video.account.name);
            expect(res.body.width).to.equal(560);
            expect(res.body.height).to.equal(315);
            expect(res.body.thumbnail_url).to.equal(expectedThumbnailUrl);
            expect(res.body.thumbnail_width).to.equal(560);
            expect(res.body.thumbnail_height).to.equal(315);
        });
    });
    it('Should have a valid oEmbed response with small max height query', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const oembedUrl = 'http://localhost:9001/videos/watch/' + server.video.uuid;
            const format = 'json';
            const maxHeight = 50;
            const maxWidth = 50;
            const res = yield index_1.getOEmbed(server.url, oembedUrl, format, maxHeight, maxWidth);
            const expectedHtml = '<iframe width="50" height="50" sandbox="allow-same-origin allow-scripts" ' +
                `src="http://localhost:9001/videos/embed/${server.video.uuid}" ` +
                'frameborder="0" allowfullscreen></iframe>';
            expect(res.body.html).to.equal(expectedHtml);
            expect(res.body.title).to.equal(server.video.name);
            expect(res.body.author_name).to.equal(server.video.account.name);
            expect(res.body.height).to.equal(50);
            expect(res.body.width).to.equal(50);
            expect(res.body).to.not.have.property('thumbnail_url');
            expect(res.body).to.not.have.property('thumbnail_width');
            expect(res.body).to.not.have.property('thumbnail_height');
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers([server]);
        });
    });
});
