"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("supertest");
function addVideoToBlacklist(url, token, videoId, reason, specialStatus = 204) {
    const path = '/api/v1/videos/' + videoId + '/blacklist';
    return request(url)
        .post(path)
        .send({ reason })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .expect(specialStatus);
}
exports.addVideoToBlacklist = addVideoToBlacklist;
function updateVideoBlacklist(url, token, videoId, reason, specialStatus = 204) {
    const path = '/api/v1/videos/' + videoId + '/blacklist';
    return request(url)
        .put(path)
        .send({ reason })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .expect(specialStatus);
}
exports.updateVideoBlacklist = updateVideoBlacklist;
function removeVideoFromBlacklist(url, token, videoId, specialStatus = 204) {
    const path = '/api/v1/videos/' + videoId + '/blacklist';
    return request(url)
        .delete(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .expect(specialStatus);
}
exports.removeVideoFromBlacklist = removeVideoFromBlacklist;
function getBlacklistedVideosList(url, token, specialStatus = 200) {
    const path = '/api/v1/videos/blacklist/';
    return request(url)
        .get(path)
        .query({ sort: 'createdAt' })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .expect(specialStatus)
        .expect('Content-Type', /json/);
}
exports.getBlacklistedVideosList = getBlacklistedVideosList;
function getSortedBlacklistedVideosList(url, token, sort, specialStatus = 200) {
    const path = '/api/v1/videos/blacklist/';
    return request(url)
        .get(path)
        .query({ sort: sort })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .expect(specialStatus)
        .expect('Content-Type', /json/);
}
exports.getSortedBlacklistedVideosList = getSortedBlacklistedVideosList;
//# sourceMappingURL=video-blacklist.js.map