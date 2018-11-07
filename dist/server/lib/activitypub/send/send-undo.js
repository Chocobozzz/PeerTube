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
const video_1 = require("../../../models/video/video");
const url_1 = require("../url");
const utils_1 = require("./utils");
const audience_1 = require("../audience");
const send_create_1 = require("./send-create");
const send_follow_1 = require("./send-follow");
const send_like_1 = require("./send-like");
const send_announce_1 = require("./send-announce");
const logger_1 = require("../../../helpers/logger");
function sendUndoFollow(actorFollow, t) {
    return __awaiter(this, void 0, void 0, function* () {
        const me = actorFollow.ActorFollower;
        const following = actorFollow.ActorFollowing;
        if (!following.serverId)
            return;
        logger_1.logger.info('Creating job to send an unfollow request to %s.', following.url);
        const followUrl = url_1.getActorFollowActivityPubUrl(actorFollow);
        const undoUrl = url_1.getUndoActivityPubUrl(followUrl);
        const followActivity = send_follow_1.buildFollowActivity(followUrl, me, following);
        const undoActivity = undoActivityData(undoUrl, me, followActivity);
        return utils_1.unicastTo(undoActivity, me, following.inboxUrl);
    });
}
exports.sendUndoFollow = sendUndoFollow;
function sendUndoAnnounce(byActor, videoShare, video, t) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Creating job to undo announce %s.', videoShare.url);
        const undoUrl = url_1.getUndoActivityPubUrl(videoShare.url);
        const { activity: announceActivity, actorsInvolvedInVideo } = yield send_announce_1.buildAnnounceWithVideoAudience(byActor, videoShare, video, t);
        const undoActivity = undoActivityData(undoUrl, byActor, announceActivity);
        const followersException = [byActor];
        return utils_1.broadcastToFollowers(undoActivity, byActor, actorsInvolvedInVideo, t, followersException);
    });
}
exports.sendUndoAnnounce = sendUndoAnnounce;
function sendUndoLike(byActor, video, t) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Creating job to undo a like of video %s.', video.url);
        const likeUrl = url_1.getVideoLikeActivityPubUrl(byActor, video);
        const likeActivity = send_like_1.buildLikeActivity(likeUrl, byActor, video);
        return sendUndoVideoRelatedActivity({ byActor, video, url: likeUrl, activity: likeActivity, transaction: t });
    });
}
exports.sendUndoLike = sendUndoLike;
function sendUndoDislike(byActor, video, t) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Creating job to undo a dislike of video %s.', video.url);
        const dislikeUrl = url_1.getVideoDislikeActivityPubUrl(byActor, video);
        const dislikeActivity = send_create_1.buildDislikeActivity(byActor, video);
        const createDislikeActivity = send_create_1.buildCreateActivity(dislikeUrl, byActor, dislikeActivity);
        return sendUndoVideoRelatedActivity({ byActor, video, url: dislikeUrl, activity: createDislikeActivity, transaction: t });
    });
}
exports.sendUndoDislike = sendUndoDislike;
function sendUndoCacheFile(byActor, redundancyModel, t) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Creating job to undo cache file %s.', redundancyModel.url);
        const video = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(redundancyModel.VideoFile.Video.id);
        const createActivity = send_create_1.buildCreateActivity(redundancyModel.url, byActor, redundancyModel.toActivityPubObject());
        return sendUndoVideoRelatedActivity({ byActor, video, url: redundancyModel.url, activity: createActivity, transaction: t });
    });
}
exports.sendUndoCacheFile = sendUndoCacheFile;
function undoActivityData(url, byActor, object, audience) {
    if (!audience)
        audience = audience_1.getAudience(byActor);
    return audience_1.audiencify({
        type: 'Undo',
        id: url,
        actor: byActor.url,
        object
    }, audience);
}
function sendUndoVideoRelatedActivity(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const activityBuilder = (audience) => {
            const undoUrl = url_1.getUndoActivityPubUrl(options.url);
            return undoActivityData(undoUrl, options.byActor, options.activity, audience);
        };
        return utils_1.sendVideoRelatedActivity(activityBuilder, options);
    });
}
//# sourceMappingURL=send-undo.js.map