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
describe('Test videos API validator', function () {
    let server;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
        });
    });
    describe('When searching videos', function () {
        const path = '/api/v1/search/videos/';
        const query = {
            search: 'coucou'
        };
        it('Should fail with a bad start pagination', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadStartPagination(server.url, path, null, query);
            });
        });
        it('Should fail with a bad count pagination', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadCountPagination(server.url, path, null, query);
            });
        });
        it('Should fail with an incorrect sort', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadSortPagination(server.url, path, null, query);
            });
        });
        it('Should success with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({ url: server.url, path, query, statusCodeExpected: 200 });
            });
        });
        it('Should fail with an invalid category', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const customQuery1 = utils_1.immutableAssign(query, { categoryOneOf: ['aa', 'b'] });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 400 });
                const customQuery2 = utils_1.immutableAssign(query, { categoryOneOf: 'a' });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 400 });
            });
        });
        it('Should succeed with a valid category', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const customQuery1 = utils_1.immutableAssign(query, { categoryOneOf: [1, 7] });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 200 });
                const customQuery2 = utils_1.immutableAssign(query, { categoryOneOf: 1 });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 200 });
            });
        });
        it('Should fail with an invalid licence', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const customQuery1 = utils_1.immutableAssign(query, { licenceOneOf: ['aa', 'b'] });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 400 });
                const customQuery2 = utils_1.immutableAssign(query, { licenceOneOf: 'a' });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 400 });
            });
        });
        it('Should succeed with a valid licence', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const customQuery1 = utils_1.immutableAssign(query, { licenceOneOf: [1, 2] });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 200 });
                const customQuery2 = utils_1.immutableAssign(query, { licenceOneOf: 1 });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 200 });
            });
        });
        it('Should succeed with a valid language', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const customQuery1 = utils_1.immutableAssign(query, { languageOneOf: ['fr', 'en'] });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 200 });
                const customQuery2 = utils_1.immutableAssign(query, { languageOneOf: 'fr' });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 200 });
            });
        });
        it('Should succeed with valid tags', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const customQuery1 = utils_1.immutableAssign(query, { tagsOneOf: ['tag1', 'tag2'] });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 200 });
                const customQuery2 = utils_1.immutableAssign(query, { tagsOneOf: 'tag1' });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 200 });
                const customQuery3 = utils_1.immutableAssign(query, { tagsAllOf: ['tag1', 'tag2'] });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery3, statusCodeExpected: 200 });
                const customQuery4 = utils_1.immutableAssign(query, { tagsAllOf: 'tag1' });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery4, statusCodeExpected: 200 });
            });
        });
        it('Should fail with invalid durations', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const customQuery1 = utils_1.immutableAssign(query, { durationMin: 'hello' });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 400 });
                const customQuery2 = utils_1.immutableAssign(query, { durationMax: 'hello' });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 400 });
            });
        });
        it('Should fail with invalid dates', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const customQuery1 = utils_1.immutableAssign(query, { startDate: 'hello' });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery1, statusCodeExpected: 400 });
                const customQuery2 = utils_1.immutableAssign(query, { endDate: 'hello' });
                yield utils_1.makeGetRequest({ url: server.url, path, query: customQuery2, statusCodeExpected: 400 });
            });
        });
    });
    describe('When searching video channels', function () {
        const path = '/api/v1/search/video-channels/';
        const query = {
            search: 'coucou'
        };
        it('Should fail with a bad start pagination', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadStartPagination(server.url, path, null, query);
            });
        });
        it('Should fail with a bad count pagination', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadCountPagination(server.url, path, null, query);
            });
        });
        it('Should fail with an incorrect sort', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadSortPagination(server.url, path, null, query);
            });
        });
        it('Should success with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({ url: server.url, path, query, statusCodeExpected: 200 });
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
