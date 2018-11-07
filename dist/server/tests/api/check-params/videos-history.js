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
describe('Test videos history API validator', function () {
    let path;
    let server;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            const res = yield utils_1.uploadVideo(server.url, server.accessToken, {});
            const videoUUID = res.body.video.uuid;
            path = '/api/v1/videos/' + videoUUID + '/watching';
        });
    });
    describe('When notifying a user is watching a video', function () {
        it('Should fail with an unauthenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { currentTime: 5 };
                yield utils_1.makePutBodyRequest({ url: server.url, path, fields, statusCodeExpected: 401 });
            });
        });
        it('Should fail with an incorrect video id', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { currentTime: 5 };
                const path = '/api/v1/videos/blabla/watching';
                yield utils_1.makePutBodyRequest({ url: server.url, path, fields, token: server.accessToken, statusCodeExpected: 400 });
            });
        });
        it('Should fail with an unknown video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { currentTime: 5 };
                const path = '/api/v1/videos/d91fff41-c24d-4508-8e13-3bd5902c3b02/watching';
                yield utils_1.makePutBodyRequest({ url: server.url, path, fields, token: server.accessToken, statusCodeExpected: 404 });
            });
        });
        it('Should fail with a bad current time', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { currentTime: 'hello' };
                yield utils_1.makePutBodyRequest({ url: server.url, path, fields, token: server.accessToken, statusCodeExpected: 400 });
            });
        });
        it('Should succeed with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = { currentTime: 5 };
                yield utils_1.makePutBodyRequest({ url: server.url, path, fields, token: server.accessToken, statusCodeExpected: 204 });
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
