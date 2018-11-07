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
const shared_1 = require("../../../../shared");
const logger_1 = require("../../../helpers/logger");
const utils_1 = require("../../../helpers/utils");
const middlewares_1 = require("../../../middlewares");
const video_blacklist_1 = require("../../../models/video/video-blacklist");
const initializers_1 = require("../../../initializers");
const blacklistRouter = express.Router();
exports.blacklistRouter = blacklistRouter;
blacklistRouter.post('/:videoId/blacklist', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_VIDEO_BLACKLIST), middlewares_1.asyncMiddleware(middlewares_1.videosBlacklistAddValidator), middlewares_1.asyncMiddleware(addVideoToBlacklist));
blacklistRouter.get('/blacklist', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_VIDEO_BLACKLIST), middlewares_1.paginationValidator, middlewares_1.blacklistSortValidator, middlewares_1.setBlacklistSort, middlewares_1.setDefaultPagination, middlewares_1.asyncMiddleware(listBlacklist));
blacklistRouter.put('/:videoId/blacklist', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_VIDEO_BLACKLIST), middlewares_1.asyncMiddleware(middlewares_1.videosBlacklistUpdateValidator), middlewares_1.asyncMiddleware(updateVideoBlacklistController));
blacklistRouter.delete('/:videoId/blacklist', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_VIDEO_BLACKLIST), middlewares_1.asyncMiddleware(middlewares_1.videosBlacklistRemoveValidator), middlewares_1.asyncMiddleware(removeVideoFromBlacklistController));
function addVideoToBlacklist(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoInstance = res.locals.video;
        const body = req.body;
        const toCreate = {
            videoId: videoInstance.id,
            reason: body.reason
        };
        yield video_blacklist_1.VideoBlacklistModel.create(toCreate);
        return res.type('json').status(204).end();
    });
}
function updateVideoBlacklistController(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoBlacklist = res.locals.videoBlacklist;
        logger_1.logger.info(videoBlacklist);
        if (req.body.reason !== undefined)
            videoBlacklist.reason = req.body.reason;
        yield initializers_1.sequelizeTypescript.transaction(t => {
            return videoBlacklist.save({ transaction: t });
        });
        return res.type('json').status(204).end();
    });
}
function listBlacklist(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const resultList = yield video_blacklist_1.VideoBlacklistModel.listForApi(req.query.start, req.query.count, req.query.sort);
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function removeVideoFromBlacklistController(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoBlacklist = res.locals.videoBlacklist;
        yield initializers_1.sequelizeTypescript.transaction(t => {
            return videoBlacklist.destroy({ transaction: t });
        });
        logger_1.logger.info('Video %s removed from blacklist.', res.locals.video.uuid);
        return res.type('json').status(204).end();
    });
}
