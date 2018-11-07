"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("supertest");
const __1 = require("..");
function reportVideoAbuse(url, token, videoId, reason, specialStatus = 200) {
    const path = '/api/v1/videos/' + videoId + '/abuse';
    return request(url)
        .post(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .send({ reason })
        .expect(specialStatus);
}
exports.reportVideoAbuse = reportVideoAbuse;
function getVideoAbusesList(url, token) {
    const path = '/api/v1/videos/abuse';
    return request(url)
        .get(path)
        .query({ sort: 'createdAt' })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getVideoAbusesList = getVideoAbusesList;
function updateVideoAbuse(url, token, videoId, videoAbuseId, body, statusCodeExpected = 204) {
    const path = '/api/v1/videos/' + videoId + '/abuse/' + videoAbuseId;
    return __1.makePutBodyRequest({
        url,
        token,
        path,
        fields: body,
        statusCodeExpected
    });
}
exports.updateVideoAbuse = updateVideoAbuse;
function deleteVideoAbuse(url, token, videoId, videoAbuseId, statusCodeExpected = 204) {
    const path = '/api/v1/videos/' + videoId + '/abuse/' + videoAbuseId;
    return __1.makeDeleteRequest({
        url,
        token,
        path,
        statusCodeExpected
    });
}
exports.deleteVideoAbuse = deleteVideoAbuse;
