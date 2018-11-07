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
const video_1 = require("../../../models/video/video");
const video_comment_1 = require("../../../models/video/video-comment");
const utils_1 = require("../send/utils");
function processDeleteActivity(activity, byActor) {
    return __awaiter(this, void 0, void 0, function* () {
        const objectUrl = typeof activity.object === 'string' ? activity.object : activity.object.id;
        if (activity.actor === objectUrl) {
            const byActorFull = yield actor_1.ActorModel.loadByUrlAndPopulateAccountAndChannel(byActor.url);
            if (byActorFull.type === 'Person') {
                if (!byActorFull.Account)
                    throw new Error('Actor ' + byActorFull.url + ' is a person but we cannot find it in database.');
                byActorFull.Account.Actor = (yield byActorFull.Account.$get('Actor'));
                return database_utils_1.retryTransactionWrapper(processDeleteAccount, byActorFull.Account);
            }
            else if (byActorFull.type === 'Group') {
                if (!byActorFull.VideoChannel)
                    throw new Error('Actor ' + byActorFull.url + ' is a group but we cannot find it in database.');
                byActorFull.VideoChannel.Actor = (yield byActorFull.VideoChannel.$get('Actor'));
                return database_utils_1.retryTransactionWrapper(processDeleteVideoChannel, byActorFull.VideoChannel);
            }
        }
        {
            const videoCommentInstance = yield video_comment_1.VideoCommentModel.loadByUrlAndPopulateAccount(objectUrl);
            if (videoCommentInstance) {
                return database_utils_1.retryTransactionWrapper(processDeleteVideoComment, byActor, videoCommentInstance, activity);
            }
        }
        {
            const videoInstance = yield video_1.VideoModel.loadByUrlAndPopulateAccount(objectUrl);
            if (videoInstance) {
                if (videoInstance.isOwned())
                    throw new Error(`Remote instance cannot delete owned video ${videoInstance.url}.`);
                return database_utils_1.retryTransactionWrapper(processDeleteVideo, byActor, videoInstance);
            }
        }
        return undefined;
    });
}
exports.processDeleteActivity = processDeleteActivity;
function processDeleteVideo(actor, videoToDelete) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Removing remote video "%s".', videoToDelete.uuid);
        yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            if (videoToDelete.VideoChannel.Account.Actor.id !== actor.id) {
                throw new Error('Account ' + actor.url + ' does not own video channel ' + videoToDelete.VideoChannel.Actor.url);
            }
            yield videoToDelete.destroy({ transaction: t });
        }));
        logger_1.logger.info('Remote video with uuid %s removed.', videoToDelete.uuid);
    });
}
function processDeleteAccount(accountToRemove) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Removing remote account "%s".', accountToRemove.Actor.uuid);
        yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            yield accountToRemove.destroy({ transaction: t });
        }));
        logger_1.logger.info('Remote account with uuid %s removed.', accountToRemove.Actor.uuid);
    });
}
function processDeleteVideoChannel(videoChannelToRemove) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Removing remote video channel "%s".', videoChannelToRemove.Actor.uuid);
        yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            yield videoChannelToRemove.destroy({ transaction: t });
        }));
        logger_1.logger.info('Remote video channel with uuid %s removed.', videoChannelToRemove.Actor.uuid);
    });
}
function processDeleteVideoComment(byActor, videoComment, activity) {
    logger_1.logger.debug('Removing remote video comment "%s".', videoComment.url);
    return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
        if (videoComment.Account.id !== byActor.Account.id) {
            throw new Error('Account ' + byActor.url + ' does not own video comment ' + videoComment.url);
        }
        yield videoComment.destroy({ transaction: t });
        if (videoComment.Video.isOwned()) {
            const exceptions = [byActor];
            yield utils_1.forwardVideoRelatedActivity(activity, t, exceptions, videoComment.Video);
        }
        logger_1.logger.info('Remote video comment %s removed.', videoComment.url);
    }));
}
//# sourceMappingURL=process-delete.js.map