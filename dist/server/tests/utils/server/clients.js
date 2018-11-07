"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("supertest");
const urlUtil = require("url");
function getClient(url) {
    const path = '/api/v1/oauth-clients/local';
    return request(url)
        .get(path)
        .set('Host', urlUtil.parse(url).host)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getClient = getClient;
