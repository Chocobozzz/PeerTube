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
const misc_1 = require("../../../helpers/custom-validators/misc");
const videos_1 = require("../../../helpers/custom-validators/videos");
const logger_1 = require("../../../helpers/logger");
const utils_1 = require("../utils");
const video_blacklist_1 = require("../../../helpers/custom-validators/video-blacklist");
const videosBlacklistRemoveValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking blacklistRemove parameters.', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return;
        if (!(yield video_blacklist_1.isVideoBlacklistExist(res.locals.video.id, res)))
            return;
        return next();
    })
];
exports.videosBlacklistRemoveValidator = videosBlacklistRemoveValidator;
const videosBlacklistAddValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
    check_1.body('reason')
        .optional()
        .custom(video_blacklist_1.isVideoBlacklistReasonValid).withMessage('Should have a valid reason'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videosBlacklistAdd parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return;
        return next();
    })
];
exports.videosBlacklistAddValidator = videosBlacklistAddValidator;
const videosBlacklistUpdateValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),
    check_1.body('reason')
        .optional()
        .custom(video_blacklist_1.isVideoBlacklistReasonValid).withMessage('Should have a valid reason'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videosBlacklistUpdate parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return;
        if (!(yield video_blacklist_1.isVideoBlacklistExist(res.locals.video.id, res)))
            return;
        return next();
    })
];
exports.videosBlacklistUpdateValidator = videosBlacklistUpdateValidator;
//# sourceMappingURL=video-blacklist.js.map