"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("supertest");
const miscs_1 = require("../miscs/miscs");
const path_1 = require("path");
function makeGetRequest(options) {
    if (!options.statusCodeExpected)
        options.statusCodeExpected = 400;
    if (options.contentType === undefined)
        options.contentType = 'application/json';
    const req = request(options.url)
        .get(options.path);
    if (options.contentType)
        req.set('Accept', options.contentType);
    if (options.token)
        req.set('Authorization', 'Bearer ' + options.token);
    if (options.query)
        req.query(options.query);
    return req.expect(options.statusCodeExpected);
}
exports.makeGetRequest = makeGetRequest;
function makeDeleteRequest(options) {
    if (!options.statusCodeExpected)
        options.statusCodeExpected = 400;
    const req = request(options.url)
        .delete(options.path)
        .set('Accept', 'application/json');
    if (options.token)
        req.set('Authorization', 'Bearer ' + options.token);
    return req.expect(options.statusCodeExpected);
}
exports.makeDeleteRequest = makeDeleteRequest;
function makeUploadRequest(options) {
    if (!options.statusCodeExpected)
        options.statusCodeExpected = 400;
    let req;
    if (options.method === 'PUT') {
        req = request(options.url).put(options.path);
    }
    else {
        req = request(options.url).post(options.path);
    }
    req.set('Accept', 'application/json');
    if (options.token)
        req.set('Authorization', 'Bearer ' + options.token);
    Object.keys(options.fields).forEach(field => {
        const value = options.fields[field];
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                req.field(field + '[' + i + ']', value[i]);
            }
        }
        else {
            req.field(field, value);
        }
    });
    Object.keys(options.attaches).forEach(attach => {
        const value = options.attaches[attach];
        if (Array.isArray(value)) {
            req.attach(attach, miscs_1.buildAbsoluteFixturePath(value[0]), value[1]);
        }
        else {
            req.attach(attach, miscs_1.buildAbsoluteFixturePath(value));
        }
    });
    return req.expect(options.statusCodeExpected);
}
exports.makeUploadRequest = makeUploadRequest;
function makePostBodyRequest(options) {
    if (!options.fields)
        options.fields = {};
    if (!options.statusCodeExpected)
        options.statusCodeExpected = 400;
    const req = request(options.url)
        .post(options.path)
        .set('Accept', 'application/json');
    if (options.token)
        req.set('Authorization', 'Bearer ' + options.token);
    return req.send(options.fields)
        .expect(options.statusCodeExpected);
}
exports.makePostBodyRequest = makePostBodyRequest;
function makePutBodyRequest(options) {
    if (!options.statusCodeExpected)
        options.statusCodeExpected = 400;
    const req = request(options.url)
        .put(options.path)
        .set('Accept', 'application/json');
    if (options.token)
        req.set('Authorization', 'Bearer ' + options.token);
    return req.send(options.fields)
        .expect(options.statusCodeExpected);
}
exports.makePutBodyRequest = makePutBodyRequest;
function makeHTMLRequest(url, path) {
    return request(url)
        .get(path)
        .set('Accept', 'text/html')
        .expect(200);
}
exports.makeHTMLRequest = makeHTMLRequest;
function updateAvatarRequest(options) {
    let filePath = '';
    if (path_1.isAbsolute(options.fixture)) {
        filePath = options.fixture;
    }
    else {
        filePath = path_1.join(__dirname, '..', '..', 'fixtures', options.fixture);
    }
    return makeUploadRequest({
        url: options.url,
        path: options.path,
        token: options.accessToken,
        fields: {},
        attaches: { avatarfile: filePath },
        statusCodeExpected: 200
    });
}
exports.updateAvatarRequest = updateAvatarRequest;
