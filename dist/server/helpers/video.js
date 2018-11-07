"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const video_1 = require("../models/video/video");
function fetchVideo(id, fetchType, userId) {
    if (fetchType === 'all')
        return video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(id, undefined, userId);
    if (fetchType === 'only-video')
        return video_1.VideoModel.load(id);
    if (fetchType === 'id' || fetchType === 'none')
        return video_1.VideoModel.loadOnlyId(id);
}
exports.fetchVideo = fetchVideo;
function fetchVideoByUrl(url, fetchType) {
    if (fetchType === 'all')
        return video_1.VideoModel.loadByUrlAndPopulateAccount(url);
    if (fetchType === 'only-video')
        return video_1.VideoModel.loadByUrl(url);
}
exports.fetchVideoByUrl = fetchVideoByUrl;
