"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const requests_1 = require("../requests/requests");
function getVideosOverview(url, useCache = false) {
    const path = '/api/v1/overviews/videos';
    const query = {
        t: useCache ? undefined : new Date().getTime()
    };
    return requests_1.makeGetRequest({
        url,
        path,
        query,
        statusCodeExpected: 200
    });
}
exports.getVideosOverview = getVideosOverview;
