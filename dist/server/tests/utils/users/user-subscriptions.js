"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("../");
function addUserSubscription(url, token, targetUri, statusCodeExpected = 204) {
    const path = '/api/v1/users/me/subscriptions';
    return __1.makePostBodyRequest({
        url,
        path,
        token,
        statusCodeExpected,
        fields: { uri: targetUri }
    });
}
exports.addUserSubscription = addUserSubscription;
function listUserSubscriptions(url, token, sort = '-createdAt', statusCodeExpected = 200) {
    const path = '/api/v1/users/me/subscriptions';
    return __1.makeGetRequest({
        url,
        path,
        token,
        statusCodeExpected,
        query: { sort }
    });
}
exports.listUserSubscriptions = listUserSubscriptions;
function listUserSubscriptionVideos(url, token, sort = '-createdAt', statusCodeExpected = 200) {
    const path = '/api/v1/users/me/subscriptions/videos';
    return __1.makeGetRequest({
        url,
        path,
        token,
        statusCodeExpected,
        query: { sort }
    });
}
exports.listUserSubscriptionVideos = listUserSubscriptionVideos;
function getUserSubscription(url, token, uri, statusCodeExpected = 200) {
    const path = '/api/v1/users/me/subscriptions/' + uri;
    return __1.makeGetRequest({
        url,
        path,
        token,
        statusCodeExpected
    });
}
exports.getUserSubscription = getUserSubscription;
function removeUserSubscription(url, token, uri, statusCodeExpected = 204) {
    const path = '/api/v1/users/me/subscriptions/' + uri;
    return __1.makeDeleteRequest({
        url,
        path,
        token,
        statusCodeExpected
    });
}
exports.removeUserSubscription = removeUserSubscription;
function areSubscriptionsExist(url, token, uris, statusCodeExpected = 200) {
    const path = '/api/v1/users/me/subscriptions/exist';
    return __1.makeGetRequest({
        url,
        path,
        query: { 'uris[]': uris },
        token,
        statusCodeExpected
    });
}
exports.areSubscriptionsExist = areSubscriptionsExist;
//# sourceMappingURL=user-subscriptions.js.map