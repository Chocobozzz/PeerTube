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
const video_1 = require("../../../models/video/video");
const video_comment_1 = require("../../../models/video/video-comment");
const url_1 = require("../url");
const utils_1 = require("./utils");
const audience_1 = require("../audience");
const logger_1 = require("../../../helpers/logger");
function sendCreateVideo(video, t) {
    return __awaiter(this, void 0, void 0, function* () {
        if (video.privacy === videos_1.VideoPrivacy.PRIVATE)
            return undefined;
        logger_1.logger.info('Creating job to send video creation of %s.', video.url);
        const byActor = video.VideoChannel.Account.Actor;
        const videoObject = video.toActivityPubObject();
        const audience = audience_1.getAudience(byActor, video.privacy === videos_1.VideoPrivacy.PUBLIC);
        const createActivity = buildCreateActivity(video.url, byActor, videoObject, audience);
        return utils_1.broadcastToFollowers(createActivity, byActor, [byActor], t);
    });
}
exports.sendCreateVideo = sendCreateVideo;
function sendVideoAbuse(byActor, videoAbuse, video) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!video.VideoChannel.Account.Actor.serverId)
            return;
        const url = url_1.getVideoAbuseActivityPubUrl(videoAbuse);
        logger_1.logger.info('Creating job to send video abuse %s.', url);
        const audience = { to: [video.VideoChannel.Account.Actor.url], cc: [] };
        const createActivity = buildCreateActivity(url, byActor, videoAbuse.toActivityPubObject(), audience);
        return utils_1.unicastTo(createActivity, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl);
    });
}
exports.sendVideoAbuse = sendVideoAbuse;
function sendCreateCacheFile(byActor, fileRedundancy) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Creating job to send file cache of %s.', fileRedundancy.url);
        const video = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(fileRedundancy.VideoFile.Video.id);
        const redundancyObject = fileRedundancy.toActivityPubObject();
        return sendVideoRelatedCreateActivity({
            byActor,
            video,
            url: fileRedundancy.url,
            object: redundancyObject
        });
    });
}
exports.sendCreateCacheFile = sendCreateCacheFile;
function sendCreateVideoComment(comment, t) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Creating job to send comment %s.', comment.url);
        const isOrigin = comment.Video.isOwned();
        const byActor = comment.Account.Actor;
        const threadParentComments = yield video_comment_1.VideoCommentModel.listThreadParentComments(comment, t);
        const commentObject = comment.toActivityPubObject(threadParentComments);
        const actorsInvolvedInComment = yield audience_1.getActorsInvolvedInVideo(comment.Video, t);
        actorsInvolvedInComment.push(byActor);
        const parentsCommentActors = threadParentComments.map(c => c.Account.Actor);
        let audience;
        if (isOrigin) {
            audience = audience_1.getVideoCommentAudience(comment, threadParentComments, actorsInvolvedInComment, isOrigin);
        }
        else {
            audience = audience_1.getAudienceFromFollowersOf(actorsInvolvedInComment.concat(parentsCommentActors));
        }
        const createActivity = buildCreateActivity(comment.url, byActor, commentObject, audience);
        const actorsException = [byActor];
        yield utils_1.broadcastToActors(createActivity, byActor, parentsCommentActors, actorsException);
        yield utils_1.broadcastToFollowers(createActivity, byActor, [byActor], t);
        if (isOrigin)
            return utils_1.broadcastToFollowers(createActivity, byActor, actorsInvolvedInComment, t, actorsException);
        return utils_1.unicastTo(createActivity, byActor, comment.Video.VideoChannel.Account.Actor.sharedInboxUrl);
    });
}
exports.sendCreateVideoComment = sendCreateVideoComment;
function sendCreateView(byActor, video, t) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Creating job to send view of %s.', video.url);
        const url = url_1.getVideoViewActivityPubUrl(byActor, video);
        const viewActivity = buildViewActivity(byActor, video);
        return sendVideoRelatedCreateActivity({
            byActor,
            video,
            url,
            object: viewActivity,
            transaction: t
        });
    });
}
exports.sendCreateView = sendCreateView;
function sendCreateDislike(byActor, video, t) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Creating job to dislike %s.', video.url);
        const url = url_1.getVideoDislikeActivityPubUrl(byActor, video);
        const dislikeActivity = buildDislikeActivity(byActor, video);
        return sendVideoRelatedCreateActivity({
            byActor,
            video,
            url,
            object: dislikeActivity,
            transaction: t
        });
    });
}
exports.sendCreateDislike = sendCreateDislike;
function buildCreateActivity(url, byActor, object, audience) {
    if (!audience)
        audience = audience_1.getAudience(byActor);
    return audience_1.audiencify({
        type: 'Create',
        id: url + '/activity',
        actor: byActor.url,
        object: audience_1.audiencify(object, audience)
    }, audience);
}
exports.buildCreateActivity = buildCreateActivity;
function buildDislikeActivity(byActor, video) {
    return {
        type: 'Dislike',
        actor: byActor.url,
        object: video.url
    };
}
exports.buildDislikeActivity = buildDislikeActivity;
function buildViewActivity(byActor, video) {
    return {
        type: 'View',
        actor: byActor.url,
        object: video.url
    };
}
function sendVideoRelatedCreateActivity(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const activityBuilder = (audience) => {
            return buildCreateActivity(options.url, options.byActor, options.object, audience);
        };
        return utils_1.sendVideoRelatedActivity(activityBuilder, options);
    });
}
