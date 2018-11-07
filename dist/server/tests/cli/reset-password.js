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
const utils_1 = require("../utils");
describe('Test reset password scripts', function () {
    let server;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            yield utils_1.createUser(server.url, server.accessToken, 'user_1', 'super password');
        });
    });
    it('Should change the user password from CLI', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(60000);
            const env = utils_1.getEnvCli(server);
            yield utils_1.execCLI(`echo coucou | ${env} npm run reset-password -- -u user_1`);
            yield utils_1.login(server.url, server.client, { username: 'user_1', password: 'coucou' }, 200);
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            utils_1.killallServers([server]);
        });
    });
});
