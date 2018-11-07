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
const login_1 = require("../../utils/users/login");
const email_1 = require("../../utils/miscs/email");
const jobs_1 = require("../../utils/server/jobs");
const expect = chai.expect;
describe('Test users account verification', function () {
    let server;
    let userId;
    let verificationString;
    let expectedEmailsLength = 0;
    const user1 = {
        username: 'user_1',
        password: 'super password'
    };
    const user2 = {
        username: 'user_2',
        password: 'super password'
    };
    const emails = [];
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield email_1.mockSmtpServer(emails);
            yield utils_1.flushTests();
            const overrideConfig = {
                smtp: {
                    hostname: 'localhost'
                }
            };
            server = yield utils_1.runServer(1, overrideConfig);
            yield login_1.setAccessTokensToServers([server]);
        });
    });
    it('Should register user and send verification email if verification required', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(5000);
            yield utils_1.updateCustomSubConfig(server.url, server.accessToken, {
                signup: {
                    enabled: true,
                    requiresEmailVerification: true,
                    limit: 10
                }
            });
            yield utils_1.registerUser(server.url, user1.username, user1.password);
            yield jobs_1.waitJobs(server);
            expectedEmailsLength++;
            expect(emails).to.have.lengthOf(expectedEmailsLength);
            const email = emails[expectedEmailsLength - 1];
            const verificationStringMatches = /verificationString=([a-z0-9]+)/.exec(email['text']);
            expect(verificationStringMatches).not.to.be.null;
            verificationString = verificationStringMatches[1];
            expect(verificationString).to.have.length.above(2);
            const userIdMatches = /userId=([0-9]+)/.exec(email['text']);
            expect(userIdMatches).not.to.be.null;
            userId = parseInt(userIdMatches[1], 10);
            const resUserInfo = yield utils_1.getUserInformation(server.url, server.accessToken, userId);
            expect(resUserInfo.body.emailVerified).to.be.false;
        });
    });
    it('Should not allow login for user with unverified email', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const resLogin = yield utils_1.login(server.url, server.client, user1, 400);
            expect(resLogin.body.error).to.contain('User email is not verified.');
        });
    });
    it('Should verify the user via email and allow login', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield utils_1.verifyEmail(server.url, userId, verificationString);
            yield utils_1.login(server.url, server.client, user1);
            const resUserVerified = yield utils_1.getUserInformation(server.url, server.accessToken, userId);
            expect(resUserVerified.body.emailVerified).to.be.true;
        });
    });
    it('Should register user not requiring email verification if setting not enabled', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(5000);
            yield utils_1.updateCustomSubConfig(server.url, server.accessToken, {
                signup: {
                    enabled: true,
                    requiresEmailVerification: false,
                    limit: 10
                }
            });
            yield utils_1.registerUser(server.url, user2.username, user2.password);
            yield jobs_1.waitJobs(server);
            expect(emails).to.have.lengthOf(expectedEmailsLength);
            const accessToken = yield utils_1.userLogin(server, user2);
            const resMyUserInfo = yield utils_1.getMyUserInformation(server.url, accessToken);
            expect(resMyUserInfo.body.emailVerified).to.be.null;
        });
    });
    it('Should allow login for user with unverified email when setting later enabled', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield utils_1.updateCustomSubConfig(server.url, server.accessToken, {
                signup: {
                    enabled: true,
                    requiresEmailVerification: true,
                    limit: 10
                }
            });
            yield utils_1.userLogin(server, user2);
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
