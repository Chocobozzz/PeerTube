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
const overviews_1 = require("../../utils/overviews/overviews");
const expect = chai.expect;
describe('Test a videos overview', function () {
    let server = null;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
        });
    });
    it('Should send empty overview', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield overviews_1.getVideosOverview(server.url);
            const overview = res.body;
            expect(overview.tags).to.have.lengthOf(0);
            expect(overview.categories).to.have.lengthOf(0);
            expect(overview.channels).to.have.lengthOf(0);
        });
    });
    it('Should upload 5 videos in a specific category, tag and channel but not include them in overview', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(15000);
            for (let i = 0; i < 5; i++) {
                yield utils_1.uploadVideo(server.url, server.accessToken, {
                    name: 'video ' + i,
                    category: 3,
                    tags: ['coucou1', 'coucou2']
                });
            }
            const res = yield overviews_1.getVideosOverview(server.url);
            const overview = res.body;
            expect(overview.tags).to.have.lengthOf(0);
            expect(overview.categories).to.have.lengthOf(0);
            expect(overview.channels).to.have.lengthOf(0);
        });
    });
    it('Should upload another video and include all videos in the overview', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield utils_1.uploadVideo(server.url, server.accessToken, {
                name: 'video 5',
                category: 3,
                tags: ['coucou1', 'coucou2']
            });
            const res = yield overviews_1.getVideosOverview(server.url);
            const overview = res.body;
            expect(overview.tags).to.have.lengthOf(2);
            expect(overview.categories).to.have.lengthOf(1);
            expect(overview.channels).to.have.lengthOf(1);
        });
    });
    it('Should have the correct overview', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield overviews_1.getVideosOverview(server.url);
            const overview = res.body;
            for (const attr of ['tags', 'categories', 'channels']) {
                const obj = overview[attr][0];
                expect(obj.videos).to.have.lengthOf(6);
                expect(obj.videos[0].name).to.equal('video 5');
                expect(obj.videos[1].name).to.equal('video 4');
                expect(obj.videos[2].name).to.equal('video 3');
                expect(obj.videos[3].name).to.equal('video 2');
                expect(obj.videos[4].name).to.equal('video 1');
                expect(obj.videos[5].name).to.equal('video 0');
            }
            expect(overview.tags.find(t => t.tag === 'coucou1')).to.not.be.undefined;
            expect(overview.tags.find(t => t.tag === 'coucou2')).to.not.be.undefined;
            expect(overview.categories[0].category.id).to.equal(3);
            expect(overview.channels[0].channel.name).to.equal('root_channel');
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
//# sourceMappingURL=videos-overview.js.map