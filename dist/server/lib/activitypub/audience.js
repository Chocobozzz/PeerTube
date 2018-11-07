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
const initializers_1 = require("../../initializers");
const actor_1 = require("../../models/activitypub/actor");
const video_share_1 = require("../../models/video/video-share");
function getRemoteVideoAudience(video, actorsInvolvedInVideo) {
    return {
        to: [video.VideoChannel.Account.Actor.url],
        cc: actorsInvolvedInVideo.map(a => a.followersUrl)
    };
}
exports.getRemoteVideoAudience = getRemoteVideoAudience;
function getVideoCommentAudience(videoComment, threadParentComments, actorsInvolvedInVideo, isOrigin = false) {
    const to = [initializers_1.ACTIVITY_PUB.PUBLIC];
    const cc = [];
    if (isOrigin === false) {
        cc.push(videoComment.Video.VideoChannel.Account.Actor.url);
    }
    cc.push(videoComment.Account.Actor.followersUrl);
    for (const parentComment of threadParentComments) {
        cc.push(parentComment.Account.Actor.url);
    }
    return {
        to,
        cc: cc.concat(actorsInvolvedInVideo.map(a => a.followersUrl))
    };
}
exports.getVideoCommentAudience = getVideoCommentAudience;
function getAudienceFromFollowersOf(actorsInvolvedInObject) {
    return {
        to: [initializers_1.ACTIVITY_PUB.PUBLIC].concat(actorsInvolvedInObject.map(a => a.followersUrl)),
        cc: []
    };
}
exports.getAudienceFromFollowersOf = getAudienceFromFollowersOf;
function getActorsInvolvedInVideo(video, t) {
    return __awaiter(this, void 0, void 0, function* () {
        const actors = yield video_share_1.VideoShareModel.loadActorsByShare(video.id, t);
        const videoActor = video.VideoChannel && video.VideoChannel.Account
            ? video.VideoChannel.Account.Actor
            : yield actor_1.ActorModel.loadAccountActorByVideoId(video.id, t);
        actors.push(videoActor);
        return actors;
    });
}
exports.getActorsInvolvedInVideo = getActorsInvolvedInVideo;
function getAudience(actorSender, isPublic = true) {
    return buildAudience([actorSender.followersUrl], isPublic);
}
exports.getAudience = getAudience;
function buildAudience(followerUrls, isPublic = true) {
    let to = [];
    let cc = [];
    if (isPublic) {
        to = [initializers_1.ACTIVITY_PUB.PUBLIC];
        cc = followerUrls;
    }
    else {
        to = [];
        cc = [];
    }
    return { to, cc };
}
exports.buildAudience = buildAudience;
function audiencify(object, audience) {
    return Object.assign(object, audience);
}
exports.audiencify = audiencify;
//# sourceMappingURL=audience.js.map