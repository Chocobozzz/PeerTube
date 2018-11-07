"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const requests_1 = require("../requests/requests");
function searchVideoChannel(url, search, token, statusCodeExpected = 200) {
    const path = '/api/v1/search/video-channels';
    return requests_1.makeGetRequest({
        url,
        path,
        query: {
            sort: '-createdAt',
            search
        },
        token,
        statusCodeExpected
    });
}
exports.searchVideoChannel = searchVideoChannel;
