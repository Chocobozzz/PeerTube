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
const accounts_1 = require("../../helpers/custom-validators/accounts");
const misc_1 = require("../../helpers/custom-validators/misc");
const logger_1 = require("../../helpers/logger");
const utils_1 = require("./utils");
const feeds_1 = require("../../helpers/custom-validators/feeds");
const video_channels_1 = require("../../helpers/custom-validators/video-channels");
const videos_1 = require("../../helpers/custom-validators/videos");
const actor_1 = require("../../helpers/custom-validators/activitypub/actor");
const videoFeedsValidator = [
    check_1.param('format').optional().custom(feeds_1.isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
    check_1.query('format').optional().custom(feeds_1.isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
    check_1.query('accountId').optional().custom(misc_1.isIdOrUUIDValid),
    check_1.query('accountName').optional().custom(accounts_1.isAccountNameValid),
    check_1.query('videoChannelId').optional().custom(misc_1.isIdOrUUIDValid),
    check_1.query('videoChannelName').optional().custom(actor_1.isActorPreferredUsernameValid),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking feeds parameters', { parameters: req.query });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (req.query.accountId && !(yield accounts_1.isAccountIdExist(req.query.accountId, res)))
            return;
        if (req.query.videoChannelId && !(yield video_channels_1.isVideoChannelIdExist(req.query.videoChannelId, res)))
            return;
        if (req.query.accountName && !(yield accounts_1.isAccountNameWithHostExist(req.query.accountName, res)))
            return;
        if (req.query.videoChannelName && !(yield video_channels_1.isVideoChannelNameWithHostExist(req.query.videoChannelName, res)))
            return;
        return next();
    })
];
exports.videoFeedsValidator = videoFeedsValidator;
const videoCommentsFeedsValidator = [
    check_1.param('format').optional().custom(feeds_1.isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
    check_1.query('format').optional().custom(feeds_1.isValidRSSFeed).withMessage('Should have a valid format (rss, atom, json)'),
    check_1.query('videoId').optional().custom(misc_1.isIdOrUUIDValid),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking feeds parameters', { parameters: req.query });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (req.query.videoId && !(yield videos_1.isVideoExist(req.query.videoId, res)))
            return;
        return next();
    })
];
exports.videoCommentsFeedsValidator = videoCommentsFeedsValidator;
//# sourceMappingURL=feeds.js.map