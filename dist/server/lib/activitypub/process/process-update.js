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
const database_utils_1 = require("../../../helpers/database-utils");
const logger_1 = require("../../../helpers/logger");
const initializers_1 = require("../../../initializers");
const actor_1 = require("../../../models/activitypub/actor");
const actor_2 = require("../actor");
const videos_1 = require("../videos");
const videos_2 = require("../../../helpers/custom-validators/activitypub/videos");
const cache_file_1 = require("../../../helpers/custom-validators/activitypub/cache-file");
const cache_file_2 = require("../cache-file");
const utils_1 = require("../send/utils");
function processUpdateActivity(activity, byActor) {
    return __awaiter(this, void 0, void 0, function* () {
        const objectType = activity.object.type;
        if (objectType === 'Video') {
            return database_utils_1.retryTransactionWrapper(processUpdateVideo, byActor, activity);
        }
        if (objectType === 'Person' || objectType === 'Application' || objectType === 'Group') {
            const byActorFull = yield actor_1.ActorModel.loadByUrlAndPopulateAccountAndChannel(byActor.url);
            return database_utils_1.retryTransactionWrapper(processUpdateActor, byActorFull, activity);
        }
        if (objectType === 'CacheFile') {
            const byActorFull = yield actor_1.ActorModel.loadByUrlAndPopulateAccountAndChannel(byActor.url);
            return database_utils_1.retryTransactionWrapper(processUpdateCacheFile, byActorFull, activity);
        }
        return undefined;
    });
}
exports.processUpdateActivity = processUpdateActivity;
function processUpdateVideo(actor, activity) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoObject = activity.object;
        if (videos_2.sanitizeAndCheckVideoTorrentObject(videoObject) === false) {
            logger_1.logger.debug('Video sent by update is not valid.', { videoObject });
            return undefined;
        }
        const { video } = yield videos_1.getOrCreateVideoAndAccountAndChannel({ videoObject: videoObject.id });
        const channelActor = yield videos_1.getOrCreateVideoChannelFromVideoObject(videoObject);
        const updateOptions = {
            video,
            videoObject,
            account: actor.Account,
            channel: channelActor.VideoChannel,
            updateViews: true,
            overrideTo: activity.to
        };
        return videos_1.updateVideoFromAP(updateOptions);
    });
}
function processUpdateCacheFile(byActor, activity) {
    return __awaiter(this, void 0, void 0, function* () {
        const cacheFileObject = activity.object;
        if (!cache_file_1.isCacheFileObjectValid(cacheFileObject)) {
            logger_1.logger.debug('Cache file object sent by update is not valid.', { cacheFileObject });
            return undefined;
        }
        const { video } = yield videos_1.getOrCreateVideoAndAccountAndChannel({ videoObject: cacheFileObject.object });
        yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            yield cache_file_2.createOrUpdateCacheFile(cacheFileObject, video, byActor, t);
        }));
        if (video.isOwned()) {
            const exceptions = [byActor];
            yield utils_1.forwardVideoRelatedActivity(activity, undefined, exceptions, video);
        }
    });
}
function processUpdateActor(actor, activity) {
    return __awaiter(this, void 0, void 0, function* () {
        const actorAttributesToUpdate = activity.object;
        logger_1.logger.debug('Updating remote account "%s".', actorAttributesToUpdate.uuid);
        let accountOrChannelInstance;
        let actorFieldsSave;
        let accountOrChannelFieldsSave;
        const avatarName = yield actor_2.fetchAvatarIfExists(actorAttributesToUpdate);
        try {
            yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
                actorFieldsSave = actor.toJSON();
                if (actorAttributesToUpdate.type === 'Group')
                    accountOrChannelInstance = actor.VideoChannel;
                else
                    accountOrChannelInstance = actor.Account;
                accountOrChannelFieldsSave = accountOrChannelInstance.toJSON();
                yield actor_2.updateActorInstance(actor, actorAttributesToUpdate);
                if (avatarName !== undefined) {
                    yield actor_2.updateActorAvatarInstance(actor, avatarName, t);
                }
                yield actor.save({ transaction: t });
                accountOrChannelInstance.set('name', actorAttributesToUpdate.name || actorAttributesToUpdate.preferredUsername);
                accountOrChannelInstance.set('description', actorAttributesToUpdate.summary);
                accountOrChannelInstance.set('support', actorAttributesToUpdate.support);
                yield accountOrChannelInstance.save({ transaction: t });
            }));
            logger_1.logger.info('Remote account with uuid %s updated', actorAttributesToUpdate.uuid);
        }
        catch (err) {
            if (actor !== undefined && actorFieldsSave !== undefined) {
                database_utils_1.resetSequelizeInstance(actor, actorFieldsSave);
            }
            if (accountOrChannelInstance !== undefined && accountOrChannelFieldsSave !== undefined) {
                database_utils_1.resetSequelizeInstance(accountOrChannelInstance, accountOrChannelFieldsSave);
            }
            logger_1.logger.debug('Cannot update the remote account.', { err });
            throw err;
        }
    });
}
//# sourceMappingURL=process-update.js.map