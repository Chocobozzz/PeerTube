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
const check_api_params_1 = require("../../utils/requests/check-api-params");
const video_comments_1 = require("../../utils/videos/video-comments");
const expect = chai.expect;
describe('Test video comments API validator', function () {
    let pathThread;
    let pathComment;
    let server;
    let videoUUID;
    let userAccessToken;
    let commentId;
    before(function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(30000);
            yield utils_1.flushTests();
            server = yield utils_1.runServer(1);
            yield utils_1.setAccessTokensToServers([server]);
            {
                const res = yield utils_1.uploadVideo(server.url, server.accessToken, {});
                videoUUID = res.body.video.uuid;
                pathThread = '/api/v1/videos/' + videoUUID + '/comment-threads';
            }
            {
                const res = yield video_comments_1.addVideoCommentThread(server.url, server.accessToken, videoUUID, 'coucou');
                commentId = res.body.comment.id;
                pathComment = '/api/v1/videos/' + videoUUID + '/comments/' + commentId;
            }
            {
                const user = {
                    username: 'user1',
                    password: 'my super password'
                };
                yield utils_1.createUser(server.url, server.accessToken, user.username, user.password);
                userAccessToken = yield utils_1.userLogin(server, user);
            }
        });
    });
    describe('When listing video comment threads', function () {
        it('Should fail with a bad start pagination', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadStartPagination(server.url, pathThread, server.accessToken);
            });
        });
        it('Should fail with a bad count pagination', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadCountPagination(server.url, pathThread, server.accessToken);
            });
        });
        it('Should fail with an incorrect sort', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield check_api_params_1.checkBadSortPagination(server.url, pathThread, server.accessToken);
            });
        });
        it('Should fail with an incorrect video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comment-threads',
                    statusCodeExpected: 404
                });
            });
        });
    });
    describe('When listing comments of a thread', function () {
        it('Should fail with an incorrect video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comment-threads/' + commentId,
                    statusCodeExpected: 404
                });
            });
        });
        it('Should fail with an incorrect thread id', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/api/v1/videos/' + videoUUID + '/comment-threads/156',
                    statusCodeExpected: 404
                });
            });
        });
        it('Should success with the correct params', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeGetRequest({
                    url: server.url,
                    path: '/api/v1/videos/' + videoUUID + '/comment-threads/' + commentId,
                    statusCodeExpected: 200
                });
            });
        });
    });
    describe('When adding a video thread', function () {
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    text: 'text'
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path: pathThread, token: 'none', fields, statusCodeExpected: 401 });
            });
        });
        it('Should fail with nothing', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {};
                yield utils_1.makePostBodyRequest({ url: server.url, path: pathThread, token: server.accessToken, fields });
            });
        });
        it('Should fail with a short comment', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    text: ''
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path: pathThread, token: server.accessToken, fields });
            });
        });
        it('Should fail with a long comment', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    text: 'h'.repeat(3001)
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path: pathThread, token: server.accessToken, fields });
            });
        });
        it('Should fail with an incorrect video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = '/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comment-threads';
                const fields = {
                    text: 'super comment'
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 404 });
            });
        });
        it('Should succeed with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    text: 'super comment'
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path: pathThread, token: server.accessToken, fields, statusCodeExpected: 200 });
            });
        });
    });
    describe('When adding a comment to a thread', function () {
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    text: 'text'
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path: pathComment, token: 'none', fields, statusCodeExpected: 401 });
            });
        });
        it('Should fail with nothing', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {};
                yield utils_1.makePostBodyRequest({ url: server.url, path: pathComment, token: server.accessToken, fields });
            });
        });
        it('Should fail with a short comment', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    text: ''
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path: pathComment, token: server.accessToken, fields });
            });
        });
        it('Should fail with a long comment', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    text: 'h'.repeat(3001)
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path: pathComment, token: server.accessToken, fields });
            });
        });
        it('Should fail with an incorrect video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = '/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comments/' + commentId;
                const fields = {
                    text: 'super comment'
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 404 });
            });
        });
        it('Should fail with an incorrect comment', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = '/api/v1/videos/' + videoUUID + '/comments/124';
                const fields = {
                    text: 'super comment'
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 404 });
            });
        });
        it('Should succeed with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    text: 'super comment'
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path: pathComment, token: server.accessToken, fields, statusCodeExpected: 200 });
            });
        });
    });
    describe('When removing video comments', function () {
        it('Should fail with a non authenticated user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeDeleteRequest({ url: server.url, path: pathComment, token: 'none', statusCodeExpected: 401 });
            });
        });
        it('Should fail with another user', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeDeleteRequest({ url: server.url, path: pathComment, token: userAccessToken, statusCodeExpected: 403 });
            });
        });
        it('Should fail with an incorrect video', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = '/api/v1/videos/ba708d62-e3d7-45d9-9d73-41b9097cc02d/comments/' + commentId;
                yield utils_1.makeDeleteRequest({ url: server.url, path, token: server.accessToken, statusCodeExpected: 404 });
            });
        });
        it('Should fail with an incorrect comment', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const path = '/api/v1/videos/' + videoUUID + '/comments/124';
                yield utils_1.makeDeleteRequest({ url: server.url, path, token: server.accessToken, statusCodeExpected: 404 });
            });
        });
        it('Should succeed with the correct parameters', function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield utils_1.makeDeleteRequest({ url: server.url, path: pathComment, token: server.accessToken, statusCodeExpected: 204 });
            });
        });
    });
    describe('When a video has comments disabled', function () {
        before(function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield utils_1.uploadVideo(server.url, server.accessToken, { commentsEnabled: false });
                videoUUID = res.body.video.uuid;
                pathThread = '/api/v1/videos/' + videoUUID + '/comment-threads';
            });
        });
        it('Should return an empty thread list', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const res = yield utils_1.makeGetRequest({
                    url: server.url,
                    path: pathThread,
                    statusCodeExpected: 200
                });
                expect(res.body.total).to.equal(0);
                expect(res.body.data).to.have.lengthOf(0);
            });
        });
        it('Should return an thread comments list');
        it('Should return conflict on thread add', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const fields = {
                    text: 'super comment'
                };
                yield utils_1.makePostBodyRequest({ url: server.url, path: pathThread, token: server.accessToken, fields, statusCodeExpected: 409 });
            });
        });
        it('Should return conflict on comment thread add');
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
