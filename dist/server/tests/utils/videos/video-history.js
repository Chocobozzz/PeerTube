"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const requests_1 = require("../requests/requests");
function userWatchVideo(url, token, videoId, currentTime) {
    const path = '/api/v1/videos/' + videoId + '/watching';
    const fields = { currentTime };
    return requests_1.makePutBodyRequest({ url, path, token, fields, statusCodeExpected: 204 });
}
exports.userWatchVideo = userWatchVideo;
//# sourceMappingURL=video-history.js.map