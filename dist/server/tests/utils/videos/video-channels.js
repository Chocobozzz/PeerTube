"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("supertest");
const index_1 = require("../index");
function getVideoChannelsList(url, start, count, sort) {
    const path = '/api/v1/video-channels';
    const req = request(url)
        .get(path)
        .query({ start: start })
        .query({ count: count });
    if (sort)
        req.query({ sort });
    return req.set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getVideoChannelsList = getVideoChannelsList;
function getAccountVideoChannelsList(url, accountName, specialStatus = 200) {
    const path = '/api/v1/accounts/' + accountName + '/video-channels';
    return request(url)
        .get(path)
        .set('Accept', 'application/json')
        .expect(specialStatus)
        .expect('Content-Type', /json/);
}
exports.getAccountVideoChannelsList = getAccountVideoChannelsList;
function addVideoChannel(url, token, videoChannelAttributesArg, expectedStatus = 200) {
    const path = '/api/v1/video-channels/';
    let attributes = {
        displayName: 'my super video channel',
        description: 'my super channel description',
        support: 'my super channel support'
    };
    attributes = Object.assign(attributes, videoChannelAttributesArg);
    return request(url)
        .post(path)
        .send(attributes)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .expect(expectedStatus);
}
exports.addVideoChannel = addVideoChannel;
function updateVideoChannel(url, token, channelName, attributes, expectedStatus = 204) {
    const body = {};
    const path = '/api/v1/video-channels/' + channelName;
    if (attributes.displayName)
        body['displayName'] = attributes.displayName;
    if (attributes.description)
        body['description'] = attributes.description;
    if (attributes.support)
        body['support'] = attributes.support;
    return request(url)
        .put(path)
        .send(body)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .expect(expectedStatus);
}
exports.updateVideoChannel = updateVideoChannel;
function deleteVideoChannel(url, token, channelName, expectedStatus = 204) {
    const path = '/api/v1/video-channels/' + channelName;
    return request(url)
        .delete(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .expect(expectedStatus);
}
exports.deleteVideoChannel = deleteVideoChannel;
function getVideoChannel(url, channelName) {
    const path = '/api/v1/video-channels/' + channelName;
    return request(url)
        .get(path)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getVideoChannel = getVideoChannel;
function updateVideoChannelAvatar(options) {
    const path = '/api/v1/video-channels/' + options.videoChannelName + '/avatar/pick';
    return index_1.updateAvatarRequest(Object.assign(options, { path }));
}
exports.updateVideoChannelAvatar = updateVideoChannelAvatar;
