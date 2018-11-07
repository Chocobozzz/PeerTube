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
const check_1 = require("express-validator/check");
const shared_1 = require("../../../../shared");
const misc_1 = require("../../../helpers/custom-validators/misc");
const video_comments_1 = require("../../../helpers/custom-validators/video-comments");
const videos_1 = require("../../../helpers/custom-validators/videos");
const logger_1 = require("../../../helpers/logger");
const video_comment_1 = require("../../../models/video/video-comment");
const utils_1 = require("../utils");
const listVideoCommentThreadsValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking listVideoCommentThreads parameters.', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res, 'only-video')))
            return;
        return next();
    })
];
exports.listVideoCommentThreadsValidator = listVideoCommentThreadsValidator;
const listVideoThreadCommentsValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
    check_1.param('threadId').custom(misc_1.isIdValid).not().isEmpty().withMessage('Should have a valid threadId'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking listVideoThreadComments parameters.', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res, 'only-video')))
            return;
        if (!(yield isVideoCommentThreadExist(req.params.threadId, res.locals.video, res)))
            return;
        return next();
    })
];
exports.listVideoThreadCommentsValidator = listVideoThreadCommentsValidator;
const addVideoCommentThreadValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
    check_1.body('text').custom(video_comments_1.isValidVideoCommentText).not().isEmpty().withMessage('Should have a valid comment text'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking addVideoCommentThread parameters.', { parameters: req.params, body: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return;
        if (!isVideoCommentsEnabled(res.locals.video, res))
            return;
        return next();
    })
];
exports.addVideoCommentThreadValidator = addVideoCommentThreadValidator;
const addVideoCommentReplyValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
    check_1.param('commentId').custom(misc_1.isIdValid).not().isEmpty().withMessage('Should have a valid commentId'),
    check_1.body('text').custom(video_comments_1.isValidVideoCommentText).not().isEmpty().withMessage('Should have a valid comment text'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking addVideoCommentReply parameters.', { parameters: req.params, body: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return;
        if (!isVideoCommentsEnabled(res.locals.video, res))
            return;
        if (!(yield isVideoCommentExist(req.params.commentId, res.locals.video, res)))
            return;
        return next();
    })
];
exports.addVideoCommentReplyValidator = addVideoCommentReplyValidator;
const videoCommentGetValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
    check_1.param('commentId').custom(misc_1.isIdValid).not().isEmpty().withMessage('Should have a valid commentId'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videoCommentGetValidator parameters.', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res, 'id')))
            return;
        if (!(yield isVideoCommentExist(req.params.commentId, res.locals.video, res)))
            return;
        return next();
    })
];
exports.videoCommentGetValidator = videoCommentGetValidator;
const removeVideoCommentValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
    check_1.param('commentId').custom(misc_1.isIdValid).not().isEmpty().withMessage('Should have a valid commentId'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking removeVideoCommentValidator parameters.', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return;
        if (!(yield isVideoCommentExist(req.params.commentId, res.locals.video, res)))
            return;
        if (!checkUserCanDeleteVideoComment(res.locals.oauth.token.User, res.locals.videoComment, res))
            return;
        return next();
    })
];
exports.removeVideoCommentValidator = removeVideoCommentValidator;
function isVideoCommentThreadExist(id, video, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoComment = yield video_comment_1.VideoCommentModel.loadById(id);
        if (!videoComment) {
            res.status(404)
                .json({ error: 'Video comment thread not found' })
                .end();
            return false;
        }
        if (videoComment.videoId !== video.id) {
            res.status(400)
                .json({ error: 'Video comment is associated to this video.' })
                .end();
            return false;
        }
        if (videoComment.inReplyToCommentId !== null) {
            res.status(400)
                .json({ error: 'Video comment is not a thread.' })
                .end();
            return false;
        }
        res.locals.videoCommentThread = videoComment;
        return true;
    });
}
function isVideoCommentExist(id, video, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoComment = yield video_comment_1.VideoCommentModel.loadByIdAndPopulateVideoAndAccountAndReply(id);
        if (!videoComment) {
            res.status(404)
                .json({ error: 'Video comment thread not found' })
                .end();
            return false;
        }
        if (videoComment.videoId !== video.id) {
            res.status(400)
                .json({ error: 'Video comment is associated to this video.' })
                .end();
            return false;
        }
        res.locals.videoComment = videoComment;
        return true;
    });
}
function isVideoCommentsEnabled(video, res) {
    if (video.commentsEnabled !== true) {
        res.status(409)
            .json({ error: 'Video comments are disabled for this video.' })
            .end();
        return false;
    }
    return true;
}
function checkUserCanDeleteVideoComment(user, videoComment, res) {
    const account = videoComment.Account;
    if (user.hasRight(shared_1.UserRight.REMOVE_ANY_VIDEO_COMMENT) === false && account.userId !== user.id) {
        res.status(403)
            .json({ error: 'Cannot remove video comment of another user' })
            .end();
        return false;
    }
    return true;
}
//# sourceMappingURL=video-comments.js.map