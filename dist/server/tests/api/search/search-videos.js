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
const expect = chai.expect;
describe('Test a videos search', function () {
    let server = null;
    let startDate;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            {
                const attributes1 = {
                    name: '1111 2222 3333',
                    fixture: '60fps_720p_small.mp4',
                    category: 1,
                    licence: 1,
                    nsfw: false,
                    language: 'fr'
                };
                yield utils_1.uploadVideo(server.url, server.accessToken, attributes1);
                const attributes2 = utils_1.immutableAssign(attributes1, { name: attributes1.name + ' - 2', fixture: 'video_short.mp4' });
                yield utils_1.uploadVideo(server.url, server.accessToken, attributes2);
                const attributes3 = utils_1.immutableAssign(attributes1, { name: attributes1.name + ' - 3', language: 'en' });
                yield utils_1.uploadVideo(server.url, server.accessToken, attributes3);
                const attributes4 = utils_1.immutableAssign(attributes1, { name: attributes1.name + ' - 4', language: 'pl', nsfw: true });
                yield utils_1.uploadVideo(server.url, server.accessToken, attributes4);
                yield utils_1.wait(1000);
                startDate = new Date().toISOString();
                const attributes5 = utils_1.immutableAssign(attributes1, { name: attributes1.name + ' - 5', licence: 2 });
                yield utils_1.uploadVideo(server.url, server.accessToken, attributes5);
                const attributes6 = utils_1.immutableAssign(attributes1, { name: attributes1.name + ' - 6', tags: ['t1', 't2 '] });
                yield utils_1.uploadVideo(server.url, server.accessToken, attributes6);
                const attributes7 = utils_1.immutableAssign(attributes1, { name: attributes1.name + ' - 7' });
                yield utils_1.uploadVideo(server.url, server.accessToken, attributes7);
                const attributes8 = utils_1.immutableAssign(attributes1, { name: attributes1.name + ' - 8', licence: 4 });
                yield utils_1.uploadVideo(server.url, server.accessToken, attributes8);
            }
            {
                const attributes = {
                    name: '3333 4444 5555',
                    fixture: 'video_short.mp4',
                    category: 2,
                    licence: 2,
                    language: 'en'
                };
                yield utils_1.uploadVideo(server.url, server.accessToken, attributes);
                yield utils_1.uploadVideo(server.url, server.accessToken, utils_1.immutableAssign(attributes, { name: attributes.name + ' duplicate' }));
            }
            {
                const attributes = {
                    name: '6666 7777 8888',
                    fixture: 'video_short.mp4',
                    category: 3,
                    licence: 3,
                    language: 'pl'
                };
                yield utils_1.uploadVideo(server.url, server.accessToken, attributes);
            }
            {
                const attributes1 = {
                    name: '9999',
                    tags: ['aaaa', 'bbbb', 'cccc'],
                    category: 1
                };
                yield utils_1.uploadVideo(server.url, server.accessToken, attributes1);
                yield utils_1.uploadVideo(server.url, server.accessToken, utils_1.immutableAssign(attributes1, { category: 2 }));
                yield utils_1.uploadVideo(server.url, server.accessToken, utils_1.immutableAssign(attributes1, { tags: ['cccc', 'dddd'] }));
                yield utils_1.uploadVideo(server.url, server.accessToken, utils_1.immutableAssign(attributes1, { tags: ['eeee', 'ffff'] }));
            }
            {
                const attributes1 = {
                    name: 'aaaa 2',
                    category: 1
                };
                yield utils_1.uploadVideo(server.url, server.accessToken, attributes1);
                yield utils_1.uploadVideo(server.url, server.accessToken, utils_1.immutableAssign(attributes1, { category: 2 }));
            }
        });
    });
    it('Should make a simple search and not have results', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.searchVideo(server.url, 'abc');
            expect(res.body.total).to.equal(0);
            expect(res.body.data).to.have.lengthOf(0);
        });
    });
    it('Should make a simple search and have results', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield utils_1.searchVideo(server.url, '4444 5555 duplicate');
            expect(res.body.total).to.equal(2);
            const videos = res.body.data;
            expect(videos).to.have.lengthOf(2);
            expect(videos[0].name).to.equal('3333 4444 5555 duplicate');
            expect(videos[1].name).to.equal('3333 4444 5555');
        });
    });
    it('Should make a search on tags too, and have results', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                search: 'aaaa',
                categoryOneOf: [1]
            };
            const res = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res.body.total).to.equal(2);
            const videos = res.body.data;
            expect(videos).to.have.lengthOf(2);
            expect(videos[0].name).to.equal('aaaa 2');
            expect(videos[1].name).to.equal('9999');
        });
    });
    it('Should filter on tags without a search', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                tagsAllOf: ['bbbb']
            };
            const res = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res.body.total).to.equal(2);
            const videos = res.body.data;
            expect(videos).to.have.lengthOf(2);
            expect(videos[0].name).to.equal('9999');
            expect(videos[1].name).to.equal('9999');
        });
    });
    it('Should filter on category without a search', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                categoryOneOf: [3]
            };
            const res = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res.body.total).to.equal(1);
            const videos = res.body.data;
            expect(videos).to.have.lengthOf(1);
            expect(videos[0].name).to.equal('6666 7777 8888');
        });
    });
    it('Should search by tags (one of)', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                search: '9999',
                categoryOneOf: [1],
                tagsOneOf: ['aaaa', 'ffff']
            };
            const res1 = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res1.body.total).to.equal(2);
            const res2 = yield utils_1.advancedVideosSearch(server.url, utils_1.immutableAssign(query, { tagsOneOf: ['blabla'] }));
            expect(res2.body.total).to.equal(0);
        });
    });
    it('Should search by tags (all of)', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                search: '9999',
                categoryOneOf: [1],
                tagsAllOf: ['cccc']
            };
            const res1 = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res1.body.total).to.equal(2);
            const res2 = yield utils_1.advancedVideosSearch(server.url, utils_1.immutableAssign(query, { tagsAllOf: ['blabla'] }));
            expect(res2.body.total).to.equal(0);
            const res3 = yield utils_1.advancedVideosSearch(server.url, utils_1.immutableAssign(query, { tagsAllOf: ['bbbb', 'cccc'] }));
            expect(res3.body.total).to.equal(1);
        });
    });
    it('Should search by category', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                search: '6666',
                categoryOneOf: [3]
            };
            const res1 = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res1.body.total).to.equal(1);
            expect(res1.body.data[0].name).to.equal('6666 7777 8888');
            const res2 = yield utils_1.advancedVideosSearch(server.url, utils_1.immutableAssign(query, { categoryOneOf: [2] }));
            expect(res2.body.total).to.equal(0);
        });
    });
    it('Should search by licence', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                search: '4444 5555',
                licenceOneOf: [2]
            };
            const res1 = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res1.body.total).to.equal(2);
            expect(res1.body.data[0].name).to.equal('3333 4444 5555');
            expect(res1.body.data[1].name).to.equal('3333 4444 5555 duplicate');
            const res2 = yield utils_1.advancedVideosSearch(server.url, utils_1.immutableAssign(query, { licenceOneOf: [3] }));
            expect(res2.body.total).to.equal(0);
        });
    });
    it('Should search by languages', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                search: '1111 2222 3333',
                languageOneOf: ['pl', 'en']
            };
            const res1 = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res1.body.total).to.equal(2);
            expect(res1.body.data[0].name).to.equal('1111 2222 3333 - 3');
            expect(res1.body.data[1].name).to.equal('1111 2222 3333 - 4');
            const res2 = yield utils_1.advancedVideosSearch(server.url, utils_1.immutableAssign(query, { languageOneOf: ['eo'] }));
            expect(res2.body.total).to.equal(0);
        });
    });
    it('Should search by start date', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                search: '1111 2222 3333',
                startDate
            };
            const res = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res.body.total).to.equal(4);
            const videos = res.body.data;
            expect(videos[0].name).to.equal('1111 2222 3333 - 5');
            expect(videos[1].name).to.equal('1111 2222 3333 - 6');
            expect(videos[2].name).to.equal('1111 2222 3333 - 7');
            expect(videos[3].name).to.equal('1111 2222 3333 - 8');
        });
    });
    it('Should make an advanced search', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                search: '1111 2222 3333',
                languageOneOf: ['pl', 'fr'],
                durationMax: 4,
                nsfw: 'false',
                licenceOneOf: [1, 4]
            };
            const res = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res.body.total).to.equal(4);
            const videos = res.body.data;
            expect(videos[0].name).to.equal('1111 2222 3333');
            expect(videos[1].name).to.equal('1111 2222 3333 - 6');
            expect(videos[2].name).to.equal('1111 2222 3333 - 7');
            expect(videos[3].name).to.equal('1111 2222 3333 - 8');
        });
    });
    it('Should make an advanced search and sort results', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                search: '1111 2222 3333',
                languageOneOf: ['pl', 'fr'],
                durationMax: 4,
                nsfw: 'false',
                licenceOneOf: [1, 4],
                sort: '-name'
            };
            const res = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res.body.total).to.equal(4);
            const videos = res.body.data;
            expect(videos[0].name).to.equal('1111 2222 3333 - 8');
            expect(videos[1].name).to.equal('1111 2222 3333 - 7');
            expect(videos[2].name).to.equal('1111 2222 3333 - 6');
            expect(videos[3].name).to.equal('1111 2222 3333');
        });
    });
    it('Should make an advanced search and only show the first result', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                search: '1111 2222 3333',
                languageOneOf: ['pl', 'fr'],
                durationMax: 4,
                nsfw: 'false',
                licenceOneOf: [1, 4],
                sort: '-name',
                start: 0,
                count: 1
            };
            const res = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res.body.total).to.equal(4);
            const videos = res.body.data;
            expect(videos[0].name).to.equal('1111 2222 3333 - 8');
        });
    });
    it('Should make an advanced search and only show the last result', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                search: '1111 2222 3333',
                languageOneOf: ['pl', 'fr'],
                durationMax: 4,
                nsfw: 'false',
                licenceOneOf: [1, 4],
                sort: '-name',
                start: 3,
                count: 1
            };
            const res = yield utils_1.advancedVideosSearch(server.url, query);
            expect(res.body.total).to.equal(4);
            const videos = res.body.data;
            expect(videos[0].name).to.equal('1111 2222 3333');
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
//# sourceMappingURL=search-videos.js.map