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
const logger_1 = require("../../../helpers/logger");
const process_1 = require("../../activitypub/process");
const video_comments_1 = require("../../activitypub/video-comments");
const crawl_1 = require("../../activitypub/crawl");
const video_1 = require("../../../models/video/video");
const activitypub_1 = require("../../activitypub");
function processActivityPubHttpFetcher(job) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Processing ActivityPub fetcher in job %d.', job.id);
        const payload = job.data;
        let video;
        if (payload.videoId)
            video = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoId);
        const fetcherType = {
            'activity': items => process_1.processActivities(items),
            'video-likes': items => activitypub_1.createRates(items, video, 'like'),
            'video-dislikes': items => activitypub_1.createRates(items, video, 'dislike'),
            'video-shares': items => activitypub_1.addVideoShares(items, video),
            'video-comments': items => video_comments_1.addVideoComments(items, video)
        };
        return crawl_1.crawlCollectionPage(payload.uri, fetcherType[payload.type]);
    });
}
exports.processActivityPubHttpFetcher = processActivityPubHttpFetcher;
//# sourceMappingURL=activitypub-http-fetcher.js.map