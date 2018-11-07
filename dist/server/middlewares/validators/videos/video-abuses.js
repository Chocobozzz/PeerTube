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
require("express-validator");
const check_1 = require("express-validator/check");
const misc_1 = require("../../../helpers/custom-validators/misc");
const videos_1 = require("../../../helpers/custom-validators/videos");
const logger_1 = require("../../../helpers/logger");
const utils_1 = require("../utils");
const video_abuses_1 = require("../../../helpers/custom-validators/video-abuses");
const videoAbuseReportValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
    check_1.body('reason').custom(video_abuses_1.isVideoAbuseReasonValid).withMessage('Should have a valid reason'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videoAbuseReport parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return;
        return next();
    })
];
exports.videoAbuseReportValidator = videoAbuseReportValidator;
const videoAbuseGetValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
    check_1.param('id').custom(misc_1.isIdValid).not().isEmpty().withMessage('Should have a valid id'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videoAbuseGetValidator parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return;
        if (!(yield video_abuses_1.isVideoAbuseExist(req.params.id, res.locals.video.id, res)))
            return;
        return next();
    })
];
exports.videoAbuseGetValidator = videoAbuseGetValidator;
const videoAbuseUpdateValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
    check_1.param('id').custom(misc_1.isIdValid).not().isEmpty().withMessage('Should have a valid id'),
    check_1.body('state')
        .optional()
        .custom(video_abuses_1.isVideoAbuseStateValid).withMessage('Should have a valid video abuse state'),
    check_1.body('moderationComment')
        .optional()
        .custom(video_abuses_1.isVideoAbuseModerationCommentValid).withMessage('Should have a valid video moderation comment'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videoAbuseUpdateValidator parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return;
        if (!(yield video_abuses_1.isVideoAbuseExist(req.params.id, res.locals.video.id, res)))
            return;
        return next();
    })
];
exports.videoAbuseUpdateValidator = videoAbuseUpdateValidator;
