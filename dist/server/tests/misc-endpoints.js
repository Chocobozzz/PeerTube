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
const utils_1 = require("./utils");
const expect = chai.expect;
describe('Test misc endpoints', function () {
    let server;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(120000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
        });
    });
    describe('Test a well known endpoints', function () {
        it('Should get security.txt', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/.well-known/security.txt',
                    statusCodeExpected: 200
                });
                expect(res.text).to.contain('security issue');
            });
        });
        it('Should get nodeinfo', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/.well-known/nodeinfo',
                    statusCodeExpected: 200
                });
                expect(res.body.links).to.be.an('array');
                expect(res.body.links).to.have.lengthOf(1);
                expect(res.body.links[0].rel).to.equal('http://nodeinfo.diaspora.software/ns/schema/2.0');
            });
        });
        it('Should get dnt policy text', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/.well-known/dnt-policy.txt',
                    statusCodeExpected: 200
                });
                expect(res.text).to.contain('http://www.w3.org/TR/tracking-dnt');
            });
        });
        it('Should get dnt policy', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/.well-known/dnt',
                    statusCodeExpected: 200
                });
                expect(res.body.tracking).to.equal('N');
            });
        });
    });
    describe('Test classic static endpoints', function () {
        it('Should get robots.txt', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/robots.txt',
                    statusCodeExpected: 200
                });
                expect(res.text).to.contain('User-agent');
            });
        });
        it('Should get security.txt', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/security.txt',
                    statusCodeExpected: 301
                });
            });
        });
        it('Should get nodeinfo', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/nodeinfo/2.0.json',
                    statusCodeExpected: 200
                });
                expect(res.body.software.name).to.equal('peertube');
            });
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers([server]);
        });
    });
});
