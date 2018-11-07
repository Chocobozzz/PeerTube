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
const video_comments_1 = require("../../helpers/custom-validators/activitypub/video-comments");
const logger_1 = require("../../helpers/logger");
const requests_1 = require("../../helpers/requests");
const initializers_1 = require("../../initializers");
const video_comment_1 = require("../../models/video/video-comment");
const actor_1 = require("./actor");
const videos_1 = require("./videos");
const Bluebird = require("bluebird");
function videoCommentActivityObjectToDBAttributes(video, actor, comment) {
    return __awaiter(this, void 0, void 0, function* () {
        let originCommentId = null;
        let inReplyToCommentId = null;
        if (video.url !== comment.inReplyTo) {
            const { comment: parent } = yield addVideoComment(video, comment.inReplyTo);
            if (!parent) {
                logger_1.logger.warn('Cannot fetch or get parent comment %s of comment %s.', comment.inReplyTo, comment.id);
                return undefined;
            }
            originCommentId = parent.originCommentId || parent.id;
            inReplyToCommentId = parent.id;
        }
        return {
            url: comment.id,
            text: comment.content,
            videoId: video.id,
            accountId: actor.Account.id,
            inReplyToCommentId,
            originCommentId,
            createdAt: new Date(comment.published),
            updatedAt: new Date(comment.updated)
        };
    });
}
exports.videoCommentActivityObjectToDBAttributes = videoCommentActivityObjectToDBAttributes;
function addVideoComments(commentUrls, instance) {
    return __awaiter(this, void 0, void 0, function* () {
        return Bluebird.map(commentUrls, commentUrl => {
            return addVideoComment(instance, commentUrl);
        }, { concurrency: initializers_1.CRAWL_REQUEST_CONCURRENCY });
    });
}
exports.addVideoComments = addVideoComments;
function addVideoComment(videoInstance, commentUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Fetching remote video comment %s.', commentUrl);
        const { body } = yield requests_1.doRequest({
            uri: commentUrl,
            json: true,
            activityPub: true
        });
        if (video_comments_1.sanitizeAndCheckVideoCommentObject(body) === false) {
            logger_1.logger.debug('Remote video comment JSON is not valid.', { body });
            return { created: false };
        }
        const actorUrl = body.attributedTo;
        if (!actorUrl)
            return { created: false };
        const actor = yield actor_1.getOrCreateActorAndServerAndModel(actorUrl);
        const entry = yield videoCommentActivityObjectToDBAttributes(videoInstance, actor, body);
        if (!entry)
            return { created: false };
        const [comment, created] = yield video_comment_1.VideoCommentModel.findOrCreate({
            where: {
                url: body.id
            },
            defaults: entry
        });
        return { comment, created };
    });
}
exports.addVideoComment = addVideoComment;
function resolveThread(url, comments = []) {
    return __awaiter(this, void 0, void 0, function* () {
        const commentFromDatabase = yield video_comment_1.VideoCommentModel.loadByUrlAndPopulateReplyAndVideo(url);
        if (commentFromDatabase) {
            let parentComments = comments.concat([commentFromDatabase]);
            if (commentFromDatabase.InReplyToVideoComment) {
                const data = yield video_comment_1.VideoCommentModel.listThreadParentComments(commentFromDatabase, undefined, 'DESC');
                parentComments = parentComments.concat(data);
            }
            return resolveThread(commentFromDatabase.Video.url, parentComments);
        }
        try {
            const { video } = yield videos_1.getOrCreateVideoAndAccountAndChannel({ videoObject: url });
            if (comments.length !== 0) {
                const firstReply = comments[comments.length - 1];
                firstReply.inReplyToCommentId = null;
                firstReply.originCommentId = null;
                firstReply.videoId = video.id;
                comments[comments.length - 1] = yield firstReply.save();
                for (let i = comments.length - 2; i >= 0; i--) {
                    const comment = comments[i];
                    comment.originCommentId = firstReply.id;
                    comment.inReplyToCommentId = comments[i + 1].id;
                    comment.videoId = video.id;
                    comments[i] = yield comment.save();
                }
            }
            return { video, parents: comments };
        }
        catch (err) {
            logger_1.logger.debug('Cannot get or create account and video and channel for reply %s, fetch comment', url, { err });
            if (comments.length > initializers_1.ACTIVITY_PUB.MAX_RECURSION_COMMENTS) {
                throw new Error('Recursion limit reached when resolving a thread');
            }
            const { body } = yield requests_1.doRequest({
                uri: url,
                json: true,
                activityPub: true
            });
            if (video_comments_1.sanitizeAndCheckVideoCommentObject(body) === false) {
                throw new Error('Remote video comment JSON is not valid :' + JSON.stringify(body));
            }
            const actorUrl = body.attributedTo;
            if (!actorUrl)
                throw new Error('Miss attributed to in comment');
            const actor = yield actor_1.getOrCreateActorAndServerAndModel(actorUrl);
            const comment = new video_comment_1.VideoCommentModel({
                url: body.id,
                text: body.content,
                videoId: null,
                accountId: actor.Account.id,
                inReplyToCommentId: null,
                originCommentId: null,
                createdAt: new Date(body.published),
                updatedAt: new Date(body.updated)
            });
            return resolveThread(body.inReplyTo, comments.concat([comment]));
        }
    });
}
exports.resolveThread = resolveThread;
//# sourceMappingURL=video-comments.js.map