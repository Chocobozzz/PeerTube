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
const index_1 = require("../../utils/index");
const email_1 = require("../../utils/miscs/email");
const jobs_1 = require("../../utils/server/jobs");
const expect = chai.expect;
describe('Test emails', function () {
    let server;
    let userId;
    let userAccessToken;
    let videoUUID;
    let videoUserUUID;
    let verificationString;
    const emails = [];
    const user = {
        username: 'user_1',
        password: 'super_password'
    };
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield email_1.mockSmtpServer(emails);
            yield index_1.flushTests();
            const overrideConfig = {
                smtp: {
                    hostname: 'localhost'
                }
            };
            server = yield utils_1.runServer(1, overrideConfig);
            yield index_1.setAccessTokensToServers([server]);
            {
                const res = yield utils_1.createUser(server.url, server.accessToken, user.username, user.password);
                userId = res.body.user.id;
                userAccessToken = yield utils_1.userLogin(server, user);
            }
            {
                const attributes = {
                    name: 'my super user video'
                };
                const res = yield utils_1.uploadVideo(server.url, userAccessToken, attributes);
                videoUserUUID = res.body.video.uuid;
            }
            {
                const attributes = {
                    name: 'my super name'
                };
                const res = yield utils_1.uploadVideo(server.url, server.accessToken, attributes);
                videoUUID = res.body.video.uuid;
            }
        });
    });
    describe('When resetting user password', function () {
        it('Should ask to reset the password', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(10000);
                yield utils_1.askResetPassword(server.url, 'user_1@example.com');
                yield jobs_1.waitJobs(server);
                expect(emails).to.have.lengthOf(1);
                const email = emails[0];
                expect(email['from'][0]['address']).equal('test-admin@localhost');
                expect(email['to'][0]['address']).equal('user_1@example.com');
                expect(email['subject']).contains('password');
                const verificationStringMatches = /verificationString=([a-z0-9]+)/.exec(email['text']);
                expect(verificationStringMatches).not.to.be.null;
                verificationString = verificationStringMatches[1];
                expect(verificationString).to.have.length.above(2);
                const userIdMatches = /userId=([0-9]+)/.exec(email['text']);
                expect(userIdMatches).not.to.be.null;
                userId = parseInt(userIdMatches[1], 10);
                expect(verificationString).to.not.be.undefined;
            });
        });
        it('Should not reset the password with an invalid verification string', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.resetPassword(server.url, userId, verificationString + 'b', 'super_password2', 403);
            });
        });
        it('Should reset the password', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.resetPassword(server.url, userId, verificationString, 'super_password2');
            });
        });
        it('Should login with this new password', function () {
            return __awaiter(this, void 0, void 0, function* () {
                user.password = 'super_password2';
                yield utils_1.userLogin(server, user);
            });
        });
    });
    describe('When creating a video abuse', function () {
        it('Should send the notification email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(10000);
                const reason = 'my super bad reason';
                yield utils_1.reportVideoAbuse(server.url, server.accessToken, videoUUID, reason);
                yield jobs_1.waitJobs(server);
                expect(emails).to.have.lengthOf(2);
                const email = emails[1];
                expect(email['from'][0]['address']).equal('test-admin@localhost');
                expect(email['to'][0]['address']).equal('admin1@example.com');
                expect(email['subject']).contains('abuse');
                expect(email['text']).contains(videoUUID);
            });
        });
    });
    describe('When blocking/unblocking user', function () {
        return __awaiter(this, void 0, void 0, function* () {
            it('Should send the notification email when blocking a user', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    this.timeout(10000);
                    const reason = 'my super bad reason';
                    yield utils_1.blockUser(server.url, userId, server.accessToken, 204, reason);
                    yield jobs_1.waitJobs(server);
                    expect(emails).to.have.lengthOf(3);
                    const email = emails[2];
                    expect(email['from'][0]['address']).equal('test-admin@localhost');
                    expect(email['to'][0]['address']).equal('user_1@example.com');
                    expect(email['subject']).contains(' blocked');
                    expect(email['text']).contains(' blocked');
                    expect(email['text']).contains(reason);
                });
            });
            it('Should send the notification email when unblocking a user', function () {
                return __awaiter(this, void 0, void 0, function* () {
                    this.timeout(10000);
                    yield utils_1.unblockUser(server.url, userId, server.accessToken, 204);
                    yield jobs_1.waitJobs(server);
                    expect(emails).to.have.lengthOf(4);
                    const email = emails[3];
                    expect(email['from'][0]['address']).equal('test-admin@localhost');
                    expect(email['to'][0]['address']).equal('user_1@example.com');
                    expect(email['subject']).contains(' unblocked');
                    expect(email['text']).contains(' unblocked');
                });
            });
        });
    });
    describe('When blacklisting a video', function () {
        it('Should send the notification email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(10000);
                const reason = 'my super reason';
                yield utils_1.addVideoToBlacklist(server.url, server.accessToken, videoUserUUID, reason);
                yield jobs_1.waitJobs(server);
                expect(emails).to.have.lengthOf(5);
                const email = emails[4];
                expect(email['from'][0]['address']).equal('test-admin@localhost');
                expect(email['to'][0]['address']).equal('user_1@example.com');
                expect(email['subject']).contains(' blacklisted');
                expect(email['text']).contains('my super user video');
                expect(email['text']).contains('my super reason');
            });
        });
        it('Should send the notification email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(10000);
                yield utils_1.removeVideoFromBlacklist(server.url, server.accessToken, videoUserUUID);
                yield jobs_1.waitJobs(server);
                expect(emails).to.have.lengthOf(6);
                const email = emails[5];
                expect(email['from'][0]['address']).equal('test-admin@localhost');
                expect(email['to'][0]['address']).equal('user_1@example.com');
                expect(email['subject']).contains(' unblacklisted');
                expect(email['text']).contains('my super user video');
            });
        });
    });
    describe('When verifying a user email', function () {
        it('Should ask to send the verification email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(10000);
                yield utils_1.askSendVerifyEmail(server.url, 'user_1@example.com');
                yield jobs_1.waitJobs(server);
                expect(emails).to.have.lengthOf(7);
                const email = emails[6];
                expect(email['from'][0]['address']).equal('test-admin@localhost');
                expect(email['to'][0]['address']).equal('user_1@example.com');
                expect(email['subject']).contains('Verify');
                const verificationStringMatches = /verificationString=([a-z0-9]+)/.exec(email['text']);
                expect(verificationStringMatches).not.to.be.null;
                verificationString = verificationStringMatches[1];
                expect(verificationString).to.not.be.undefined;
                expect(verificationString).to.have.length.above(2);
                const userIdMatches = /userId=([0-9]+)/.exec(email['text']);
                expect(userIdMatches).not.to.be.null;
                userId = parseInt(userIdMatches[1], 10);
            });
        });
        it('Should not verify the email with an invalid verification string', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.verifyEmail(server.url, userId, verificationString + 'b', 403);
            });
        });
        it('Should verify the email', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.verifyEmail(server.url, userId, verificationString);
            });
        });
    });
    after(function () {
        return __awaiter(this, void 0, void 0, function* () {
            index_1.killallServers([server]);
        });
    });
});
