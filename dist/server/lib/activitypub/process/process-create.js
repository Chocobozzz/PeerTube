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
const shared_1 = require("../../../../shared");
const database_utils_1 = require("../../../helpers/database-utils");
const logger_1 = require("../../../helpers/logger");
const initializers_1 = require("../../../initializers");
const account_video_rate_1 = require("../../../models/account/account-video-rate");
const video_abuse_1 = require("../../../models/video/video-abuse");
const video_comments_1 = require("../video-comments");
const videos_1 = require("../videos");
const utils_1 = require("../send/utils");
const redis_1 = require("../../redis");
const cache_file_1 = require("../cache-file");
function processCreateActivity(activity, byActor) {
    return __awaiter(this, void 0, void 0, function* () {
        const activityObject = activity.object;
        const activityType = activityObject.type;
        if (activityType === 'View') {
            return processCreateView(byActor, activity);
        }
        else if (activityType === 'Dislike') {
            return database_utils_1.retryTransactionWrapper(processCreateDislike, byActor, activity);
        }
        else if (activityType === 'Video') {
            return processCreateVideo(activity);
        }
        else if (activityType === 'Flag') {
            return database_utils_1.retryTransactionWrapper(processCreateVideoAbuse, byActor, activityObject);
        }
        else if (activityType === 'Note') {
            return database_utils_1.retryTransactionWrapper(processCreateVideoComment, byActor, activity);
        }
        else if (activityType === 'CacheFile') {
            return database_utils_1.retryTransactionWrapper(processCacheFile, byActor, activity);
        }
        logger_1.logger.warn('Unknown activity object type %s when creating activity.', activityType, { activity: activity.id });
        return Promise.resolve(undefined);
    });
}
exports.processCreateActivity = processCreateActivity;
function processCreateVideo(activity) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoToCreateData = activity.object;
        const { video } = yield videos_1.getOrCreateVideoAndAccountAndChannel({ videoObject: videoToCreateData });
        return video;
    });
}
function processCreateDislike(byActor, activity) {
    return __awaiter(this, void 0, void 0, function* () {
        const dislike = activity.object;
        const byAccount = byActor.Account;
        if (!byAccount)
            throw new Error('Cannot create dislike with the non account actor ' + byActor.url);
        const { video } = yield videos_1.getOrCreateVideoAndAccountAndChannel({ videoObject: dislike.object });
        return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const rate = {
                type: 'dislike',
                videoId: video.id,
                accountId: byAccount.id
            };
            const [, created] = yield account_video_rate_1.AccountVideoRateModel.findOrCreate({
                where: rate,
                defaults: rate,
                transaction: t
            });
            if (created === true)
                yield video.increment('dislikes', { transaction: t });
            if (video.isOwned() && created === true) {
                const exceptions = [byActor];
                yield utils_1.forwardVideoRelatedActivity(activity, t, exceptions, video);
            }
        }));
    });
}
function processCreateView(byActor, activity) {
    return __awaiter(this, void 0, void 0, function* () {
        const view = activity.object;
        const options = {
            videoObject: view.object,
            fetchType: 'only-video'
        };
        const { video } = yield videos_1.getOrCreateVideoAndAccountAndChannel(options);
        yield redis_1.Redis.Instance.addVideoView(video.id);
        if (video.isOwned()) {
            const exceptions = [byActor];
            yield utils_1.forwardVideoRelatedActivity(activity, undefined, exceptions, video);
        }
    });
}
function processCacheFile(byActor, activity) {
    return __awaiter(this, void 0, void 0, function* () {
        const cacheFile = activity.object;
        const { video } = yield videos_1.getOrCreateVideoAndAccountAndChannel({ videoObject: cacheFile.object });
        yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            return cache_file_1.createOrUpdateCacheFile(cacheFile, video, byActor, t);
        }));
        if (video.isOwned()) {
            const exceptions = [byActor];
            yield utils_1.forwardVideoRelatedActivity(activity, undefined, exceptions, video);
        }
    });
}
function processCreateVideoAbuse(byActor, videoAbuseToCreateData) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Reporting remote abuse for video %s.', videoAbuseToCreateData.object);
        const account = byActor.Account;
        if (!account)
            throw new Error('Cannot create dislike with the non account actor ' + byActor.url);
        const { video } = yield videos_1.getOrCreateVideoAndAccountAndChannel({ videoObject: videoAbuseToCreateData.object });
        return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const videoAbuseData = {
                reporterAccountId: account.id,
                reason: videoAbuseToCreateData.content,
                videoId: video.id,
                state: shared_1.VideoAbuseState.PENDING
            };
            yield video_abuse_1.VideoAbuseModel.create(videoAbuseData, { transaction: t });
            logger_1.logger.info('Remote abuse for video uuid %s created', videoAbuseToCreateData.object);
        }));
    });
}
function processCreateVideoComment(byActor, activity) {
    return __awaiter(this, void 0, void 0, function* () {
        const commentObject = activity.object;
        const byAccount = byActor.Account;
        if (!byAccount)
            throw new Error('Cannot create video comment with the non account actor ' + byActor.url);
        const { video } = yield video_comments_1.resolveThread(commentObject.inReplyTo);
        const { created } = yield video_comments_1.addVideoComment(video, commentObject.id);
        if (video.isOwned() && created === true) {
            const exceptions = [byActor];
            yield utils_1.forwardVideoRelatedActivity(activity, undefined, exceptions, video);
        }
    });
}
//# sourceMappingURL=process-create.js.map