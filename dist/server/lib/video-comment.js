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
const video_comment_1 = require("../models/video/video-comment");
const activitypub_1 = require("./activitypub");
const send_1 = require("./activitypub/send");
function createVideoComment(obj, t) {
    return __awaiter(this, void 0, void 0, function* () {
        let originCommentId = null;
        let inReplyToCommentId = null;
        if (obj.inReplyToComment && obj.inReplyToComment !== null) {
            originCommentId = obj.inReplyToComment.originCommentId || obj.inReplyToComment.id;
            inReplyToCommentId = obj.inReplyToComment.id;
        }
        const comment = yield video_comment_1.VideoCommentModel.create({
            text: obj.text,
            originCommentId,
            inReplyToCommentId,
            videoId: obj.video.id,
            accountId: obj.account.id,
            url: 'fake url'
        }, { transaction: t, validate: false });
        comment.set('url', activitypub_1.getVideoCommentActivityPubUrl(obj.video, comment));
        const savedComment = yield comment.save({ transaction: t });
        savedComment.InReplyToVideoComment = obj.inReplyToComment;
        savedComment.Video = obj.video;
        savedComment.Account = obj.account;
        yield send_1.sendCreateVideoComment(savedComment, t);
        return savedComment;
    });
}
exports.createVideoComment = createVideoComment;
function buildFormattedCommentTree(resultList) {
    const comments = resultList.data;
    const comment = comments.shift();
    const thread = {
        comment: comment.toFormattedJSON(),
        children: []
    };
    const idx = {
        [comment.id]: thread
    };
    while (comments.length !== 0) {
        const childComment = comments.shift();
        const childCommentThread = {
            comment: childComment.toFormattedJSON(),
            children: []
        };
        const parentCommentThread = idx[childComment.inReplyToCommentId];
        if (!parentCommentThread)
            continue;
        parentCommentThread.children.push(childCommentThread);
        idx[childComment.id] = childCommentThread;
    }
    return thread;
}
exports.buildFormattedCommentTree = buildFormattedCommentTree;
