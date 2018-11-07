"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("supertest");
function getXMLfeed(url, feed, format) {
    const path = '/feeds/' + feed + '.xml';
    return request(url)
        .get(path)
        .query((format) ? { format: format } : {})
        .set('Accept', 'application/xml')
        .expect(200)
        .expect('Content-Type', /xml/);
}
exports.getXMLfeed = getXMLfeed;
function getJSONfeed(url, feed, query = {}) {
    const path = '/feeds/' + feed + '.json';
    return request(url)
        .get(path)
        .query(query)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getJSONfeed = getJSONfeed;
