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
const shared_1 = require("../../../../shared");
const misc_1 = require("../../../helpers/custom-validators/misc");
const videos_1 = require("../../../helpers/custom-validators/videos");
const ffmpeg_utils_1 = require("../../../helpers/ffmpeg-utils");
const logger_1 = require("../../../helpers/logger");
const initializers_1 = require("../../../initializers");
const video_share_1 = require("../../../models/video/video-share");
const oauth_1 = require("../../oauth");
const utils_1 = require("../utils");
const express_utils_1 = require("../../../helpers/express-utils");
const video_ownership_1 = require("../../../helpers/custom-validators/video-ownership");
const account_1 = require("../../../models/account/account");
const search_1 = require("../../../helpers/custom-validators/search");
const videosAddValidator = getCommonVideoAttributes().concat([
    check_1.body('videofile')
        .custom((value, { req }) => videos_1.isVideoFile(req.files)).withMessage('This file is not supported or too large. Please, make sure it is of the following type: '
        + initializers_1.CONSTRAINTS_FIELDS.VIDEOS.EXTNAME.join(', ')),
    check_1.body('name').custom(videos_1.isVideoNameValid).withMessage('Should have a valid name'),
    check_1.body('channelId')
        .toInt()
        .custom(misc_1.isIdValid).withMessage('Should have correct video channel id'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videosAdd parameters', { parameters: req.body, files: req.files });
        if (utils_1.areValidationErrors(req, res))
            return express_utils_1.cleanUpReqFiles(req);
        if (areErrorsInScheduleUpdate(req, res))
            return express_utils_1.cleanUpReqFiles(req);
        const videoFile = req.files['videofile'][0];
        const user = res.locals.oauth.token.User;
        if (!(yield videos_1.isVideoChannelOfAccountExist(req.body.channelId, user, res)))
            return express_utils_1.cleanUpReqFiles(req);
        const isAble = yield user.isAbleToUploadVideo(videoFile);
        if (isAble === false) {
            res.status(403)
                .json({ error: 'The user video quota is exceeded with this video.' });
            return express_utils_1.cleanUpReqFiles(req);
        }
        let duration;
        try {
            duration = yield ffmpeg_utils_1.getDurationFromVideoFile(videoFile.path);
        }
        catch (err) {
            logger_1.logger.error('Invalid input file in videosAddValidator.', { err });
            res.status(400)
                .json({ error: 'Invalid input file.' });
            return express_utils_1.cleanUpReqFiles(req);
        }
        videoFile['duration'] = duration;
        return next();
    })
]);
exports.videosAddValidator = videosAddValidator;
const videosUpdateValidator = getCommonVideoAttributes().concat([
    check_1.param('id').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
    check_1.body('name')
        .optional()
        .custom(videos_1.isVideoNameValid).withMessage('Should have a valid name'),
    check_1.body('channelId')
        .optional()
        .toInt()
        .custom(misc_1.isIdValid).withMessage('Should have correct video channel id'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videosUpdate parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return express_utils_1.cleanUpReqFiles(req);
        if (areErrorsInScheduleUpdate(req, res))
            return express_utils_1.cleanUpReqFiles(req);
        if (!(yield videos_1.isVideoExist(req.params.id, res)))
            return express_utils_1.cleanUpReqFiles(req);
        const video = res.locals.video;
        const user = res.locals.oauth.token.User;
        if (!videos_1.checkUserCanManageVideo(user, res.locals.video, shared_1.UserRight.UPDATE_ANY_VIDEO, res))
            return express_utils_1.cleanUpReqFiles(req);
        if (video.privacy !== shared_1.VideoPrivacy.PRIVATE && req.body.privacy === shared_1.VideoPrivacy.PRIVATE) {
            express_utils_1.cleanUpReqFiles(req);
            return res.status(409)
                .json({ error: 'Cannot set "private" a video that was not private.' });
        }
        if (req.body.channelId && !(yield videos_1.isVideoChannelOfAccountExist(req.body.channelId, user, res)))
            return express_utils_1.cleanUpReqFiles(req);
        return next();
    })
]);
exports.videosUpdateValidator = videosUpdateValidator;
const videosCustomGetValidator = (fetchType) => {
    return [
        check_1.param('id').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
        (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.debug('Checking videosGet parameters', { parameters: req.params });
            if (utils_1.areValidationErrors(req, res))
                return;
            if (!(yield videos_1.isVideoExist(req.params.id, res, fetchType)))
                return;
            const video = res.locals.video;
            if (video.privacy === shared_1.VideoPrivacy.PRIVATE || video.VideoBlacklist) {
                return oauth_1.authenticate(req, res, () => {
                    const user = res.locals.oauth.token.User;
                    if (video.VideoChannel.Account.userId !== user.id && !user.hasRight(shared_1.UserRight.MANAGE_VIDEO_BLACKLIST)) {
                        return res.status(403)
                            .json({ error: 'Cannot get this private or blacklisted video.' });
                    }
                    return next();
                });
            }
            if (video.privacy === shared_1.VideoPrivacy.PUBLIC)
                return next();
            if (video.privacy === shared_1.VideoPrivacy.UNLISTED) {
                if (misc_1.isUUIDValid(req.params.id))
                    return next();
                return res.status(404).end();
            }
        })
    ];
};
exports.videosCustomGetValidator = videosCustomGetValidator;
const videosGetValidator = videosCustomGetValidator('all');
exports.videosGetValidator = videosGetValidator;
const videosRemoveValidator = [
    check_1.param('id').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videosRemove parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.id, res)))
            return;
        if (!videos_1.checkUserCanManageVideo(res.locals.oauth.token.User, res.locals.video, shared_1.UserRight.REMOVE_ANY_VIDEO, res))
            return;
        return next();
    })
];
exports.videosRemoveValidator = videosRemoveValidator;
const videoRateValidator = [
    check_1.param('id').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
    check_1.body('rating').custom(videos_1.isVideoRatingTypeValid).withMessage('Should have a valid rate type'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videoRate parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.id, res)))
            return;
        return next();
    })
];
exports.videoRateValidator = videoRateValidator;
const videosShareValidator = [
    check_1.param('id').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
    check_1.param('accountId').custom(misc_1.isIdValid).not().isEmpty().withMessage('Should have a valid account id'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videoShare parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.id, res)))
            return;
        const share = yield video_share_1.VideoShareModel.load(req.params.accountId, res.locals.video.id, undefined);
        if (!share) {
            return res.status(404)
                .end();
        }
        res.locals.videoShare = share;
        return next();
    })
];
exports.videosShareValidator = videosShareValidator;
const videosChangeOwnershipValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking changeOwnership parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return;
        if (!videos_1.checkUserCanManageVideo(res.locals.oauth.token.User, res.locals.video, shared_1.UserRight.CHANGE_VIDEO_OWNERSHIP, res))
            return;
        const nextOwner = yield account_1.AccountModel.loadLocalByName(req.body.username);
        if (!nextOwner) {
            res.status(400)
                .json({ error: 'Changing video ownership to a remote account is not supported yet' });
            return;
        }
        res.locals.nextOwner = nextOwner;
        return next();
    })
];
exports.videosChangeOwnershipValidator = videosChangeOwnershipValidator;
const videosTerminateChangeOwnershipValidator = [
    check_1.param('id').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking changeOwnership parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield video_ownership_1.doesChangeVideoOwnershipExist(req.params.id, res)))
            return;
        if (!video_ownership_1.checkUserCanTerminateOwnershipChange(res.locals.oauth.token.User, res.locals.videoChangeOwnership, res))
            return;
        return next();
    }),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        const videoChangeOwnership = res.locals.videoChangeOwnership;
        if (videoChangeOwnership.status === shared_1.VideoChangeOwnershipStatus.WAITING) {
            return next();
        }
        else {
            res.status(403)
                .json({ error: 'Ownership already accepted or refused' });
            return;
        }
    })
];
exports.videosTerminateChangeOwnershipValidator = videosTerminateChangeOwnershipValidator;
const videosAcceptChangeOwnershipValidator = [
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        const body = req.body;
        if (!(yield videos_1.isVideoChannelOfAccountExist(body.channelId, res.locals.oauth.token.User, res)))
            return;
        const user = res.locals.oauth.token.User;
        const videoChangeOwnership = res.locals.videoChangeOwnership;
        const isAble = yield user.isAbleToUploadVideo(videoChangeOwnership.Video.getOriginalFile());
        if (isAble === false) {
            res.status(403)
                .json({ error: 'The user video quota is exceeded with this video.' });
            return;
        }
        return next();
    })
];
exports.videosAcceptChangeOwnershipValidator = videosAcceptChangeOwnershipValidator;
function getCommonVideoAttributes() {
    return [
        check_1.body('thumbnailfile')
            .custom((value, { req }) => videos_1.isVideoImage(req.files, 'thumbnailfile')).withMessage('This thumbnail file is not supported or too large. Please, make sure it is of the following type: '
            + initializers_1.CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME.join(', ')),
        check_1.body('previewfile')
            .custom((value, { req }) => videos_1.isVideoImage(req.files, 'previewfile')).withMessage('This preview file is not supported or too large. Please, make sure it is of the following type: '
            + initializers_1.CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME.join(', ')),
        check_1.body('category')
            .optional()
            .customSanitizer(misc_1.toIntOrNull)
            .custom(videos_1.isVideoCategoryValid).withMessage('Should have a valid category'),
        check_1.body('licence')
            .optional()
            .customSanitizer(misc_1.toIntOrNull)
            .custom(videos_1.isVideoLicenceValid).withMessage('Should have a valid licence'),
        check_1.body('language')
            .optional()
            .customSanitizer(misc_1.toValueOrNull)
            .custom(videos_1.isVideoLanguageValid).withMessage('Should have a valid language'),
        check_1.body('nsfw')
            .optional()
            .toBoolean()
            .custom(misc_1.isBooleanValid).withMessage('Should have a valid NSFW attribute'),
        check_1.body('waitTranscoding')
            .optional()
            .toBoolean()
            .custom(misc_1.isBooleanValid).withMessage('Should have a valid wait transcoding attribute'),
        check_1.body('privacy')
            .optional()
            .toInt()
            .custom(videos_1.isVideoPrivacyValid).withMessage('Should have correct video privacy'),
        check_1.body('description')
            .optional()
            .customSanitizer(misc_1.toValueOrNull)
            .custom(videos_1.isVideoDescriptionValid).withMessage('Should have a valid description'),
        check_1.body('support')
            .optional()
            .customSanitizer(misc_1.toValueOrNull)
            .custom(videos_1.isVideoSupportValid).withMessage('Should have a valid support text'),
        check_1.body('tags')
            .optional()
            .customSanitizer(misc_1.toValueOrNull)
            .custom(videos_1.isVideoTagsValid).withMessage('Should have correct tags'),
        check_1.body('commentsEnabled')
            .optional()
            .toBoolean()
            .custom(misc_1.isBooleanValid).withMessage('Should have comments enabled boolean'),
        check_1.body('scheduleUpdate')
            .optional()
            .customSanitizer(misc_1.toValueOrNull),
        check_1.body('scheduleUpdate.updateAt')
            .optional()
            .custom(misc_1.isDateValid).withMessage('Should have a valid schedule update date'),
        check_1.body('scheduleUpdate.privacy')
            .optional()
            .toInt()
            .custom(videos_1.isScheduleVideoUpdatePrivacyValid).withMessage('Should have correct schedule update privacy')
    ];
}
exports.getCommonVideoAttributes = getCommonVideoAttributes;
const commonVideosFiltersValidator = [
    check_1.query('categoryOneOf')
        .optional()
        .customSanitizer(misc_1.toArray)
        .custom(search_1.isNumberArray).withMessage('Should have a valid one of category array'),
    check_1.query('licenceOneOf')
        .optional()
        .customSanitizer(misc_1.toArray)
        .custom(search_1.isNumberArray).withMessage('Should have a valid one of licence array'),
    check_1.query('languageOneOf')
        .optional()
        .customSanitizer(misc_1.toArray)
        .custom(search_1.isStringArray).withMessage('Should have a valid one of language array'),
    check_1.query('tagsOneOf')
        .optional()
        .customSanitizer(misc_1.toArray)
        .custom(search_1.isStringArray).withMessage('Should have a valid one of tags array'),
    check_1.query('tagsAllOf')
        .optional()
        .customSanitizer(misc_1.toArray)
        .custom(search_1.isStringArray).withMessage('Should have a valid all of tags array'),
    check_1.query('nsfw')
        .optional()
        .custom(search_1.isNSFWQueryValid).withMessage('Should have a valid NSFW attribute'),
    check_1.query('filter')
        .optional()
        .custom(videos_1.isVideoFilterValid).withMessage('Should have a valid filter attribute'),
    (req, res, next) => {
        logger_1.logger.debug('Checking commons video filters query', { parameters: req.query });
        if (utils_1.areValidationErrors(req, res))
            return;
        const user = res.locals.oauth ? res.locals.oauth.token.User : undefined;
        if (req.query.filter === 'all-local' && (!user || user.hasRight(shared_1.UserRight.SEE_ALL_VIDEOS) === false)) {
            res.status(401)
                .json({ error: 'You are not allowed to see all local videos.' });
            return;
        }
        return next();
    }
];
exports.commonVideosFiltersValidator = commonVideosFiltersValidator;
function areErrorsInScheduleUpdate(req, res) {
    if (req.body.scheduleUpdate) {
        if (!req.body.scheduleUpdate.updateAt) {
            res.status(400)
                .json({ error: 'Schedule update at is mandatory.' });
            return true;
        }
    }
    return false;
}
