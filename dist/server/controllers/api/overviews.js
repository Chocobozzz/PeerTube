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
const express = require("express");
const express_utils_1 = require("../../helpers/express-utils");
const video_1 = require("../../models/video/video");
const middlewares_1 = require("../../middlewares");
const tag_1 = require("../../models/video/tag");
const initializers_1 = require("../../initializers");
const cache_1 = require("../../middlewares/cache");
const memoizee = require("memoizee");
const overviewsRouter = express.Router();
exports.overviewsRouter = overviewsRouter;
overviewsRouter.get('/videos', middlewares_1.asyncMiddleware(cache_1.cacheRoute(initializers_1.ROUTE_CACHE_LIFETIME.OVERVIEWS.VIDEOS)), middlewares_1.asyncMiddleware(getVideosOverview));
const buildSamples = memoizee(function () {
    return __awaiter(this, void 0, void 0, function* () {
        const [categories, channels, tags] = yield Promise.all([
            video_1.VideoModel.getRandomFieldSamples('category', initializers_1.OVERVIEWS.VIDEOS.SAMPLE_THRESHOLD, initializers_1.OVERVIEWS.VIDEOS.SAMPLES_COUNT),
            video_1.VideoModel.getRandomFieldSamples('channelId', initializers_1.OVERVIEWS.VIDEOS.SAMPLE_THRESHOLD, initializers_1.OVERVIEWS.VIDEOS.SAMPLES_COUNT),
            tag_1.TagModel.getRandomSamples(initializers_1.OVERVIEWS.VIDEOS.SAMPLE_THRESHOLD, initializers_1.OVERVIEWS.VIDEOS.SAMPLES_COUNT)
        ]);
        return { categories, channels, tags };
    });
}, { maxAge: initializers_1.MEMOIZE_TTL.OVERVIEWS_SAMPLE });
function getVideosOverview(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const attributes = yield buildSamples();
        const [categories, channels, tags] = yield Promise.all([
            Promise.all(attributes.categories.map(c => getVideosByCategory(c, res))),
            Promise.all(attributes.channels.map(c => getVideosByChannel(c, res))),
            Promise.all(attributes.tags.map(t => getVideosByTag(t, res)))
        ]);
        const result = {
            categories,
            channels,
            tags
        };
        for (const key of Object.keys(result)) {
            result[key] = result[key].filter(v => v !== undefined);
        }
        return res.json(result);
    });
}
function getVideosByTag(tag, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videos = yield getVideos(res, { tagsOneOf: [tag] });
        if (videos.length === 0)
            return undefined;
        return {
            tag,
            videos
        };
    });
}
function getVideosByCategory(category, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videos = yield getVideos(res, { categoryOneOf: [category] });
        if (videos.length === 0)
            return undefined;
        return {
            category: videos[0].category,
            videos
        };
    });
}
function getVideosByChannel(channelId, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videos = yield getVideos(res, { videoChannelId: channelId });
        if (videos.length === 0)
            return undefined;
        return {
            channel: videos[0].channel,
            videos
        };
    });
}
function getVideos(res, where) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = Object.assign({
            start: 0,
            count: 10,
            sort: '-createdAt',
            includeLocalVideos: true,
            nsfw: express_utils_1.buildNSFWFilter(res),
            withFiles: false
        }, where);
        const { data } = yield video_1.VideoModel.listForApi(query, false);
        return data.map(d => d.toFormattedJSON());
    });
}
//# sourceMappingURL=overviews.js.map