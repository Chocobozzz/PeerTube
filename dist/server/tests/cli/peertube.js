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
const chai_1 = require("chai");
const utils_1 = require("../utils");
describe('Test CLI wrapper', function () {
    let server;
    const cmd = 'node ./dist/server/tools/peertube.js';
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            yield utils_1.createUser(server.url, server.accessToken, 'user_1', 'super password');
        });
    });
    it('Should display no selected instance', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            const env = utils_1.getEnvCli(server);
            const stdout = yield utils_1.execCLI(`${env} ${cmd} --help`);
            chai_1.expect(stdout).to.contain('selected');
        });
    });
    it('Should remember the authentifying material of the user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            const env = utils_1.getEnvCli(server);
            yield utils_1.execCLI(`${env} ` + cmd + ` auth add --url ${server.url} -U user_1 -p "super password"`);
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield utils_1.execCLI(cmd + ` auth del ${server.url}`);
            utils_1.killallServers([server]);
        });
    });
});
