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
const videos_1 = require("../../../shared/models/videos");
const activitypub_1 = require("../../helpers/activitypub");
const initializers_1 = require("../../initializers");
const send_1 = require("../../lib/activitypub/send");
const audience_1 = require("../../lib/activitypub/audience");
const send_create_1 = require("../../lib/activitypub/send/send-create");
const middlewares_1 = require("../../middlewares");
const validators_1 = require("../../middlewares/validators");
const actor_follow_1 = require("../../models/activitypub/actor-follow");
const video_comment_1 = require("../../models/video/video-comment");
const video_share_1 = require("../../models/video/video-share");
const cache_1 = require("../../middlewares/cache");
const utils_1 = require("./utils");
const account_video_rate_1 = require("../../models/account/account-video-rate");
const activitypub_2 = require("../../lib/activitypub");
const video_caption_1 = require("../../models/video/video-caption");
const redundancy_1 = require("../../middlewares/validators/redundancy");
const utils_2 = require("../../helpers/utils");
const activityPubClientRouter = express.Router();
exports.activityPubClientRouter = activityPubClientRouter;
activityPubClientRouter.get('/accounts?/:name', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(middlewares_1.localAccountValidator)), middlewares_1.executeIfActivityPub(accountController));
activityPubClientRouter.get('/accounts?/:name/followers', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(middlewares_1.localAccountValidator)), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(accountFollowersController)));
activityPubClientRouter.get('/accounts?/:name/following', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(middlewares_1.localAccountValidator)), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(accountFollowingController)));
activityPubClientRouter.get('/videos/watch/:id', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(cache_1.cacheRoute(initializers_1.ROUTE_CACHE_LIFETIME.ACTIVITY_PUB.VIDEOS))), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(validators_1.videosGetValidator)), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoController)));
activityPubClientRouter.get('/videos/watch/:id/activity', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(validators_1.videosGetValidator)), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoController)));
activityPubClientRouter.get('/videos/watch/:id/announces', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(middlewares_1.videosCustomGetValidator('only-video'))), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoAnnouncesController)));
activityPubClientRouter.get('/videos/watch/:id/announces/:accountId', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(validators_1.videosShareValidator)), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoAnnounceController)));
activityPubClientRouter.get('/videos/watch/:id/likes', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(middlewares_1.videosCustomGetValidator('only-video'))), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoLikesController)));
activityPubClientRouter.get('/videos/watch/:id/dislikes', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(middlewares_1.videosCustomGetValidator('only-video'))), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoDislikesController)));
activityPubClientRouter.get('/videos/watch/:id/comments', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(middlewares_1.videosCustomGetValidator('only-video'))), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoCommentsController)));
activityPubClientRouter.get('/videos/watch/:videoId/comments/:commentId', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(validators_1.videoCommentGetValidator)), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoCommentController)));
activityPubClientRouter.get('/videos/watch/:videoId/comments/:commentId/activity', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(validators_1.videoCommentGetValidator)), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoCommentController)));
activityPubClientRouter.get('/video-channels/:name', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(middlewares_1.localVideoChannelValidator)), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoChannelController)));
activityPubClientRouter.get('/video-channels/:name/followers', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(middlewares_1.localVideoChannelValidator)), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoChannelFollowersController)));
activityPubClientRouter.get('/video-channels/:name/following', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(middlewares_1.localVideoChannelValidator)), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoChannelFollowingController)));
activityPubClientRouter.get('/redundancy/videos/:videoId/:resolution([0-9]+)(-:fps([0-9]+))?', middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(redundancy_1.videoRedundancyGetValidator)), middlewares_1.executeIfActivityPub(middlewares_1.asyncMiddleware(videoRedundancyController)));
function accountController(req, res, next) {
    const account = res.locals.account;
    return utils_1.activityPubResponse(activitypub_1.activityPubContextify(account.toActivityPubObject()), res);
}
function accountFollowersController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const account = res.locals.account;
        const activityPubResult = yield actorFollowers(req, account.Actor);
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(activityPubResult), res);
    });
}
function accountFollowingController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const account = res.locals.account;
        const activityPubResult = yield actorFollowing(req, account.Actor);
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(activityPubResult), res);
    });
}
function videoController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const video = res.locals.video;
        video.VideoCaptions = yield video_caption_1.VideoCaptionModel.listVideoCaptions(video.id);
        const audience = audience_1.getAudience(video.VideoChannel.Account.Actor, video.privacy === videos_1.VideoPrivacy.PUBLIC);
        const videoObject = audience_1.audiencify(video.toActivityPubObject(), audience);
        if (req.path.endsWith('/activity')) {
            const data = send_create_1.buildCreateActivity(video.url, video.VideoChannel.Account.Actor, videoObject, audience);
            return utils_1.activityPubResponse(activitypub_1.activityPubContextify(data), res);
        }
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(videoObject), res);
    });
}
function videoAnnounceController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const share = res.locals.videoShare;
        const { activity } = yield send_1.buildAnnounceWithVideoAudience(share.Actor, share, res.locals.video, undefined);
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(activity), res);
    });
}
function videoAnnouncesController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const video = res.locals.video;
        const handler = (start, count) => __awaiter(this, void 0, void 0, function* () {
            const result = yield video_share_1.VideoShareModel.listAndCountByVideoId(video.id, start, count);
            return {
                total: result.count,
                data: result.rows.map(r => r.url)
            };
        });
        const json = yield activitypub_1.activityPubCollectionPagination(activitypub_2.getVideoSharesActivityPubUrl(video), handler, req.query.page);
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(json), res);
    });
}
function videoLikesController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const video = res.locals.video;
        const json = yield videoRates(req, 'like', video, activitypub_2.getVideoLikesActivityPubUrl(video));
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(json), res);
    });
}
function videoDislikesController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const video = res.locals.video;
        const json = yield videoRates(req, 'dislike', video, activitypub_2.getVideoDislikesActivityPubUrl(video));
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(json), res);
    });
}
function videoCommentsController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const video = res.locals.video;
        const handler = (start, count) => __awaiter(this, void 0, void 0, function* () {
            const result = yield video_comment_1.VideoCommentModel.listAndCountByVideoId(video.id, start, count);
            return {
                total: result.count,
                data: result.rows.map(r => r.url)
            };
        });
        const json = yield activitypub_1.activityPubCollectionPagination(activitypub_2.getVideoCommentsActivityPubUrl(video), handler, req.query.page);
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(json), res);
    });
}
function videoChannelController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoChannel = res.locals.videoChannel;
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(videoChannel.toActivityPubObject()), res);
    });
}
function videoChannelFollowersController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoChannel = res.locals.videoChannel;
        const activityPubResult = yield actorFollowers(req, videoChannel.Actor);
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(activityPubResult), res);
    });
}
function videoChannelFollowingController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoChannel = res.locals.videoChannel;
        const activityPubResult = yield actorFollowing(req, videoChannel.Actor);
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(activityPubResult), res);
    });
}
function videoCommentController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoComment = res.locals.videoComment;
        const threadParentComments = yield video_comment_1.VideoCommentModel.listThreadParentComments(videoComment, undefined);
        const isPublic = true;
        const audience = audience_1.getAudience(videoComment.Account.Actor, isPublic);
        const videoCommentObject = audience_1.audiencify(videoComment.toActivityPubObject(threadParentComments), audience);
        if (req.path.endsWith('/activity')) {
            const data = send_create_1.buildCreateActivity(videoComment.url, videoComment.Account.Actor, videoCommentObject, audience);
            return utils_1.activityPubResponse(activitypub_1.activityPubContextify(data), res);
        }
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(videoCommentObject), res);
    });
}
function videoRedundancyController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoRedundancy = res.locals.videoRedundancy;
        const serverActor = yield utils_2.getServerActor();
        const audience = audience_1.getAudience(serverActor);
        const object = audience_1.audiencify(videoRedundancy.toActivityPubObject(), audience);
        if (req.path.endsWith('/activity')) {
            const data = send_create_1.buildCreateActivity(videoRedundancy.url, serverActor, object, audience);
            return utils_1.activityPubResponse(activitypub_1.activityPubContextify(data), res);
        }
        return utils_1.activityPubResponse(activitypub_1.activityPubContextify(object), res);
    });
}
function actorFollowing(req, actor) {
    return __awaiter(this, void 0, void 0, function* () {
        const handler = (start, count) => {
            return actor_follow_1.ActorFollowModel.listAcceptedFollowingUrlsForApi([actor.id], undefined, start, count);
        };
        return activitypub_1.activityPubCollectionPagination(initializers_1.CONFIG.WEBSERVER.URL + req.url, handler, req.query.page);
    });
}
function actorFollowers(req, actor) {
    return __awaiter(this, void 0, void 0, function* () {
        const handler = (start, count) => {
            return actor_follow_1.ActorFollowModel.listAcceptedFollowerUrlsForApi([actor.id], undefined, start, count);
        };
        return activitypub_1.activityPubCollectionPagination(initializers_1.CONFIG.WEBSERVER.URL + req.url, handler, req.query.page);
    });
}
function videoRates(req, rateType, video, url) {
    const handler = (start, count) => __awaiter(this, void 0, void 0, function* () {
        const result = yield account_video_rate_1.AccountVideoRateModel.listAndCountAccountUrlsByVideoId(rateType, video.id, start, count);
        return {
            total: result.count,
            data: result.rows.map(r => r.Account.Actor.url)
        };
    });
    return activitypub_1.activityPubCollectionPagination(url, handler, req.query.page);
}
//# sourceMappingURL=client.js.map