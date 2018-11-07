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
const videos_1 = require("../../../../shared/models/videos");
const account_1 = require("../../../models/account/account");
const video_1 = require("../../../models/video/video");
const video_share_1 = require("../../../models/video/video-share");
const url_1 = require("../url");
const utils_1 = require("./utils");
const audience_1 = require("../audience");
const logger_1 = require("../../../helpers/logger");
function sendUpdateVideo(video, t, overrodeByActor) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Creating job to update video %s.', video.url);
        const byActor = overrodeByActor ? overrodeByActor : video.VideoChannel.Account.Actor;
        const url = url_1.getUpdateActivityPubUrl(video.url, video.updatedAt.toISOString());
        if (!video.VideoCaptions)
            video.VideoCaptions = (yield video.$get('VideoCaptions'));
        const videoObject = video.toActivityPubObject();
        const audience = audience_1.getAudience(byActor, video.privacy === videos_1.VideoPrivacy.PUBLIC);
        const updateActivity = buildUpdateActivity(url, byActor, videoObject, audience);
        const actorsInvolved = yield audience_1.getActorsInvolvedInVideo(video, t);
        if (overrodeByActor)
            actorsInvolved.push(overrodeByActor);
        return utils_1.broadcastToFollowers(updateActivity, byActor, actorsInvolved, t);
    });
}
exports.sendUpdateVideo = sendUpdateVideo;
function sendUpdateActor(accountOrChannel, t) {
    return __awaiter(this, void 0, void 0, function* () {
        const byActor = accountOrChannel.Actor;
        logger_1.logger.info('Creating job to update actor %s.', byActor.url);
        const url = url_1.getUpdateActivityPubUrl(byActor.url, byActor.updatedAt.toISOString());
        const accountOrChannelObject = accountOrChannel.toActivityPubObject();
        const audience = audience_1.getAudience(byActor);
        const updateActivity = buildUpdateActivity(url, byActor, accountOrChannelObject, audience);
        let actorsInvolved;
        if (accountOrChannel instanceof account_1.AccountModel) {
            actorsInvolved = yield video_share_1.VideoShareModel.loadActorsByVideoOwner(byActor.id, t);
        }
        else {
            actorsInvolved = yield video_share_1.VideoShareModel.loadActorsByVideoChannel(accountOrChannel.id, t);
        }
        actorsInvolved.push(byActor);
        return utils_1.broadcastToFollowers(updateActivity, byActor, actorsInvolved, t);
    });
}
exports.sendUpdateActor = sendUpdateActor;
function sendUpdateCacheFile(byActor, redundancyModel) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Creating job to update cache file %s.', redundancyModel.url);
        const video = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(redundancyModel.VideoFile.Video.id);
        const activityBuilder = (audience) => {
            const redundancyObject = redundancyModel.toActivityPubObject();
            const url = url_1.getUpdateActivityPubUrl(redundancyModel.url, redundancyModel.updatedAt.toISOString());
            return buildUpdateActivity(url, byActor, redundancyObject, audience);
        };
        return utils_1.sendVideoRelatedActivity(activityBuilder, { byActor, video });
    });
}
exports.sendUpdateCacheFile = sendUpdateCacheFile;
function buildUpdateActivity(url, byActor, object, audience) {
    if (!audience)
        audience = audience_1.getAudience(byActor);
    return audience_1.audiencify({
        type: 'Update',
        id: url,
        actor: byActor.url,
        object: audience_1.audiencify(object, audience)
    }, audience);
}
