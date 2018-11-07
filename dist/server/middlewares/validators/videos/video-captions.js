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
const utils_1 = require("../utils");
const videos_1 = require("../../../helpers/custom-validators/videos");
const misc_1 = require("../../../helpers/custom-validators/misc");
const check_1 = require("express-validator/check");
const initializers_1 = require("../../../initializers");
const shared_1 = require("../../../../shared");
const logger_1 = require("../../../helpers/logger");
const video_captions_1 = require("../../../helpers/custom-validators/video-captions");
const express_utils_1 = require("../../../helpers/express-utils");
const addVideoCaptionValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),
    check_1.param('captionLanguage').custom(video_captions_1.isVideoCaptionLanguageValid).not().isEmpty().withMessage('Should have a valid caption language'),
    check_1.body('captionfile')
        .custom((value, { req }) => video_captions_1.isVideoCaptionFile(req.files, 'captionfile')).withMessage('This caption file is not supported or too large. Please, make sure it is of the following type : '
        + initializers_1.CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.EXTNAME.join(', ')),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking addVideoCaption parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return express_utils_1.cleanUpReqFiles(req);
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return express_utils_1.cleanUpReqFiles(req);
        const user = res.locals.oauth.token.User;
        if (!videos_1.checkUserCanManageVideo(user, res.locals.video, shared_1.UserRight.UPDATE_ANY_VIDEO, res))
            return express_utils_1.cleanUpReqFiles(req);
        return next();
    })
];
exports.addVideoCaptionValidator = addVideoCaptionValidator;
const deleteVideoCaptionValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),
    check_1.param('captionLanguage').custom(video_captions_1.isVideoCaptionLanguageValid).not().isEmpty().withMessage('Should have a valid caption language'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking deleteVideoCaption parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return;
        if (!(yield video_captions_1.isVideoCaptionExist(res.locals.video, req.params.captionLanguage, res)))
            return;
        const user = res.locals.oauth.token.User;
        if (!videos_1.checkUserCanManageVideo(user, res.locals.video, shared_1.UserRight.UPDATE_ANY_VIDEO, res))
            return;
        return next();
    })
];
exports.deleteVideoCaptionValidator = deleteVideoCaptionValidator;
const listVideoCaptionsValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking listVideoCaptions parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res, 'id')))
            return;
        return next();
    })
];
exports.listVideoCaptionsValidator = listVideoCaptionsValidator;
//# sourceMappingURL=video-captions.js.map