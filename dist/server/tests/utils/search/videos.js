"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("supertest");
const __1 = require("..");
function searchVideo(url, search) {
    const path = '/api/v1/search/videos';
    const req = request(url)
        .get(path)
        .query({ sort: '-publishedAt', search })
        .set('Accept', 'application/json');
    return req.expect(200)
        .expect('Content-Type', /json/);
}
exports.searchVideo = searchVideo;
function searchVideoWithToken(url, search, token, query = {}) {
    const path = '/api/v1/search/videos';
    const req = request(url)
        .get(path)
        .set('Authorization', 'Bearer ' + token)
        .query(__1.immutableAssign(query, { sort: '-publishedAt', search }))
        .set('Accept', 'application/json');
    return req.expect(200)
        .expect('Content-Type', /json/);
}
exports.searchVideoWithToken = searchVideoWithToken;
function searchVideoWithPagination(url, search, start, count, sort) {
    const path = '/api/v1/search/videos';
    const req = request(url)
        .get(path)
        .query({ start })
        .query({ search })
        .query({ count });
    if (sort)
        req.query({ sort });
    return req.set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.searchVideoWithPagination = searchVideoWithPagination;
function searchVideoWithSort(url, search, sort) {
    const path = '/api/v1/search/videos';
    return request(url)
        .get(path)
        .query({ search })
        .query({ sort })
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.searchVideoWithSort = searchVideoWithSort;
function advancedVideosSearch(url, options) {
    const path = '/api/v1/search/videos';
    return request(url)
        .get(path)
        .query(options)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.advancedVideosSearch = advancedVideosSearch;
//# sourceMappingURL=videos.js.map