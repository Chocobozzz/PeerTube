"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("supertest");
const __1 = require("../");
const index_1 = require("../../../../shared/index");
function createUser(url, accessToken, username, password, videoQuota = 1000000, videoQuotaDaily = -1, role = index_1.UserRole.USER, specialStatus = 200) {
    const path = '/api/v1/users';
    const body = {
        username,
        password,
        role,
        email: username + '@example.com',
        videoQuota,
        videoQuotaDaily
    };
    return request(url)
        .post(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .send(body)
        .expect(specialStatus);
}
exports.createUser = createUser;
function registerUser(url, username, password, specialStatus = 204) {
    const path = '/api/v1/users/register';
    const body = {
        username,
        password,
        email: username + '@example.com'
    };
    return request(url)
        .post(path)
        .set('Accept', 'application/json')
        .send(body)
        .expect(specialStatus);
}
exports.registerUser = registerUser;
function getMyUserInformation(url, accessToken, specialStatus = 200) {
    const path = '/api/v1/users/me';
    return request(url)
        .get(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(specialStatus)
        .expect('Content-Type', /json/);
}
exports.getMyUserInformation = getMyUserInformation;
function deleteMe(url, accessToken, specialStatus = 204) {
    const path = '/api/v1/users/me';
    return request(url)
        .delete(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(specialStatus);
}
exports.deleteMe = deleteMe;
function getMyUserVideoQuotaUsed(url, accessToken, specialStatus = 200) {
    const path = '/api/v1/users/me/video-quota-used';
    return request(url)
        .get(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(specialStatus)
        .expect('Content-Type', /json/);
}
exports.getMyUserVideoQuotaUsed = getMyUserVideoQuotaUsed;
function getUserInformation(url, accessToken, userId) {
    const path = '/api/v1/users/' + userId;
    return request(url)
        .get(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getUserInformation = getUserInformation;
function getMyUserVideoRating(url, accessToken, videoId, specialStatus = 200) {
    const path = '/api/v1/users/me/videos/' + videoId + '/rating';
    return request(url)
        .get(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(specialStatus)
        .expect('Content-Type', /json/);
}
exports.getMyUserVideoRating = getMyUserVideoRating;
function getUsersList(url, accessToken) {
    const path = '/api/v1/users';
    return request(url)
        .get(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getUsersList = getUsersList;
function getUsersListPaginationAndSort(url, accessToken, start, count, sort, search) {
    const path = '/api/v1/users';
    return request(url)
        .get(path)
        .query({ start })
        .query({ count })
        .query({ sort })
        .query({ search })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getUsersListPaginationAndSort = getUsersListPaginationAndSort;
function removeUser(url, userId, accessToken, expectedStatus = 204) {
    const path = '/api/v1/users';
    return request(url)
        .delete(path + '/' + userId)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(expectedStatus);
}
exports.removeUser = removeUser;
function blockUser(url, userId, accessToken, expectedStatus = 204, reason) {
    const path = '/api/v1/users';
    let body;
    if (reason)
        body = { reason };
    return request(url)
        .post(path + '/' + userId + '/block')
        .send(body)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(expectedStatus);
}
exports.blockUser = blockUser;
function unblockUser(url, userId, accessToken, expectedStatus = 204) {
    const path = '/api/v1/users';
    return request(url)
        .post(path + '/' + userId + '/unblock')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(expectedStatus);
}
exports.unblockUser = unblockUser;
function updateMyUser(options) {
    const path = '/api/v1/users/me';
    const toSend = {};
    if (options.currentPassword !== undefined && options.currentPassword !== null)
        toSend['currentPassword'] = options.currentPassword;
    if (options.newPassword !== undefined && options.newPassword !== null)
        toSend['password'] = options.newPassword;
    if (options.nsfwPolicy !== undefined && options.nsfwPolicy !== null)
        toSend['nsfwPolicy'] = options.nsfwPolicy;
    if (options.autoPlayVideo !== undefined && options.autoPlayVideo !== null)
        toSend['autoPlayVideo'] = options.autoPlayVideo;
    if (options.email !== undefined && options.email !== null)
        toSend['email'] = options.email;
    if (options.description !== undefined && options.description !== null)
        toSend['description'] = options.description;
    if (options.displayName !== undefined && options.displayName !== null)
        toSend['displayName'] = options.displayName;
    return __1.makePutBodyRequest({
        url: options.url,
        path,
        token: options.accessToken,
        fields: toSend,
        statusCodeExpected: 204
    });
}
exports.updateMyUser = updateMyUser;
function updateMyAvatar(options) {
    const path = '/api/v1/users/me/avatar/pick';
    return __1.updateAvatarRequest(Object.assign(options, { path }));
}
exports.updateMyAvatar = updateMyAvatar;
function updateUser(options) {
    const path = '/api/v1/users/' + options.userId;
    const toSend = {};
    if (options.email !== undefined && options.email !== null)
        toSend['email'] = options.email;
    if (options.videoQuota !== undefined && options.videoQuota !== null)
        toSend['videoQuota'] = options.videoQuota;
    if (options.videoQuotaDaily !== undefined && options.videoQuotaDaily !== null)
        toSend['videoQuotaDaily'] = options.videoQuotaDaily;
    if (options.role !== undefined && options.role !== null)
        toSend['role'] = options.role;
    return __1.makePutBodyRequest({
        url: options.url,
        path,
        token: options.accessToken,
        fields: toSend,
        statusCodeExpected: 204
    });
}
exports.updateUser = updateUser;
function askResetPassword(url, email) {
    const path = '/api/v1/users/ask-reset-password';
    return __1.makePostBodyRequest({
        url,
        path,
        fields: { email },
        statusCodeExpected: 204
    });
}
exports.askResetPassword = askResetPassword;
function resetPassword(url, userId, verificationString, password, statusCodeExpected = 204) {
    const path = '/api/v1/users/' + userId + '/reset-password';
    return __1.makePostBodyRequest({
        url,
        path,
        fields: { password, verificationString },
        statusCodeExpected
    });
}
exports.resetPassword = resetPassword;
function askSendVerifyEmail(url, email) {
    const path = '/api/v1/users/ask-send-verify-email';
    return __1.makePostBodyRequest({
        url,
        path,
        fields: { email },
        statusCodeExpected: 204
    });
}
exports.askSendVerifyEmail = askSendVerifyEmail;
function verifyEmail(url, userId, verificationString, statusCodeExpected = 204) {
    const path = '/api/v1/users/' + userId + '/verify-email';
    return __1.makePostBodyRequest({
        url,
        path,
        fields: { verificationString },
        statusCodeExpected
    });
}
exports.verifyEmail = verifyEmail;
//# sourceMappingURL=users.js.map