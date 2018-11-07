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
const request = require("supertest");
const jobs_1 = require("./jobs");
function getFollowersListPaginationAndSort(url, start, count, sort, search) {
    const path = '/api/v1/server/followers';
    return request(url)
        .get(path)
        .query({ start })
        .query({ count })
        .query({ sort })
        .query({ search })
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getFollowersListPaginationAndSort = getFollowersListPaginationAndSort;
function getFollowingListPaginationAndSort(url, start, count, sort, search) {
    const path = '/api/v1/server/following';
    return request(url)
        .get(path)
        .query({ start })
        .query({ count })
        .query({ sort })
        .query({ search })
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getFollowingListPaginationAndSort = getFollowingListPaginationAndSort;
function follow(follower, following, accessToken, expectedStatus = 204) {
    return __awaiter(this, void 0, void 0, function* () {
        const path = '/api/v1/server/following';
        const followingHosts = following.map(f => f.replace(/^http:\/\//, ''));
        const res = yield request(follower)
            .post(path)
            .set('Accept', 'application/json')
            .set('Authorization', 'Bearer ' + accessToken)
            .send({ 'hosts': followingHosts })
            .expect(expectedStatus);
        return res;
    });
}
exports.follow = follow;
function unfollow(url, accessToken, target, expectedStatus = 204) {
    return __awaiter(this, void 0, void 0, function* () {
        const path = '/api/v1/server/following/' + target.host;
        const res = yield request(url)
            .delete(path)
            .set('Accept', 'application/json')
            .set('Authorization', 'Bearer ' + accessToken)
            .expect(expectedStatus);
        return res;
    });
}
exports.unfollow = unfollow;
function doubleFollow(server1, server2) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            follow(server1.url, [server2.url], server1.accessToken),
            follow(server2.url, [server1.url], server2.accessToken)
        ]);
        yield jobs_1.waitJobs([server1, server2]);
        return true;
    });
}
exports.doubleFollow = doubleFollow;
