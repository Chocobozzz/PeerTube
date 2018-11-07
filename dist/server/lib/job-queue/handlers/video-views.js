"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("../../redis");
const logger_1 = require("../../../helpers/logger");
const video_1 = require("../../../models/video/video");
const video_views_1 = require("../../../models/video/video-views");
const core_utils_1 = require("../../../helpers/core-utils");
function processVideosViewsViews() {
    return __awaiter(this, void 0, void 0, function* () {
        const lastHour = new Date();
        if (!core_utils_1.isTestInstance())
            lastHour.setHours(lastHour.getHours() - 1);
        const hour = lastHour.getHours();
        const startDate = lastHour.setMinutes(0, 0, 0);
        const endDate = lastHour.setMinutes(59, 59, 999);
        const videoIds = yield redis_1.Redis.Instance.getVideosIdViewed(hour);
        if (videoIds.length === 0)
            return;
        logger_1.logger.info('Processing videos views in job for hour %d.', hour);
        for (const videoId of videoIds) {
            try {
                const views = yield redis_1.Redis.Instance.getVideoViews(videoId, hour);
                if (isNaN(views)) {
                    logger_1.logger.error('Cannot process videos views of video %d in hour %d: views number is NaN.', videoId, hour);
                }
                else {
                    logger_1.logger.debug('Adding %d views to video %d in hour %d.', views, videoId, hour);
                    yield video_1.VideoModel.incrementViews(videoId, views);
                    try {
                        yield video_views_1.VideoViewModel.create({
                            startDate,
                            endDate,
                            views,
                            videoId
                        });
                    }
                    catch (err) {
                        logger_1.logger.debug('Cannot create video views for video %d in hour %d. Maybe the video does not exist anymore?', videoId, hour);
                    }
                }
                yield redis_1.Redis.Instance.deleteVideoViews(videoId, hour);
            }
            catch (err) {
                logger_1.logger.error('Cannot update video views of video %d in hour %d.', videoId, hour);
            }
        }
    });
}
exports.processVideosViewsViews = processVideosViewsViews;
