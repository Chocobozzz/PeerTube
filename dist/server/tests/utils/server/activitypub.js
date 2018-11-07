"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("supertest");
function makeActivityPubGetRequest(url, path) {
    return request(url)
        .get(path)
        .set('Accept', 'application/activity+json,text/html;q=0.9,\\*/\\*;q=0.8')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.makeActivityPubGetRequest = makeActivityPubGetRequest;
//# sourceMappingURL=activitypub.js.map