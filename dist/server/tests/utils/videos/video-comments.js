"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("supertest");
const __1 = require("../");
function getVideoCommentThreads(url, videoId, start, count, sort, token) {
    const path = '/api/v1/videos/' + videoId + '/comment-threads';
    const req = request(url)
        .get(path)
        .query({ start: start })
        .query({ count: count });
    if (sort)
        req.query({ sort });
    if (token)
        req.set('Authorization', 'Bearer ' + token);
    return req.set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getVideoCommentThreads = getVideoCommentThreads;
function getVideoThreadComments(url, videoId, threadId, token) {
    const path = '/api/v1/videos/' + videoId + '/comment-threads/' + threadId;
    const req = request(url)
        .get(path)
        .set('Accept', 'application/json');
    if (token)
        req.set('Authorization', 'Bearer ' + token);
    return req.expect(200)
        .expect('Content-Type', /json/);
}
exports.getVideoThreadComments = getVideoThreadComments;
function addVideoCommentThread(url, token, videoId, text, expectedStatus = 200) {
    const path = '/api/v1/videos/' + videoId + '/comment-threads';
    return request(url)
        .post(path)
        .send({ text })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .expect(expectedStatus);
}
exports.addVideoCommentThread = addVideoCommentThread;
function addVideoCommentReply(url, token, videoId, inReplyToCommentId, text, expectedStatus = 200) {
    const path = '/api/v1/videos/' + videoId + '/comments/' + inReplyToCommentId;
    return request(url)
        .post(path)
        .send({ text })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .expect(expectedStatus);
}
exports.addVideoCommentReply = addVideoCommentReply;
function deleteVideoComment(url, token, videoId, commentId, statusCodeExpected = 204) {
    const path = '/api/v1/videos/' + videoId + '/comments/' + commentId;
    return __1.makeDeleteRequest({
        url,
        path,
        token,
        statusCodeExpected
    });
}
exports.deleteVideoComment = deleteVideoComment;
//# sourceMappingURL=video-comments.js.map