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
const logger_1 = require("../../../helpers/logger");
const initializers_1 = require("../../../initializers");
const middlewares_1 = require("../../../middlewares");
const video_change_ownership_1 = require("../../../models/video/video-change-ownership");
const videos_1 = require("../../../../shared/models/videos");
const video_channel_1 = require("../../../models/video/video-channel");
const utils_1 = require("../../../helpers/utils");
const activitypub_1 = require("../../../lib/activitypub");
const send_1 = require("../../../lib/activitypub/send");
const ownershipVideoRouter = express.Router();
exports.ownershipVideoRouter = ownershipVideoRouter;
ownershipVideoRouter.post('/:videoId/give-ownership', middlewares_1.authenticate, middlewares_1.asyncMiddleware(middlewares_1.videosChangeOwnershipValidator), middlewares_1.asyncRetryTransactionMiddleware(giveVideoOwnership));
ownershipVideoRouter.get('/ownership', middlewares_1.authenticate, middlewares_1.paginationValidator, middlewares_1.setDefaultPagination, middlewares_1.asyncRetryTransactionMiddleware(listVideoOwnership));
ownershipVideoRouter.post('/ownership/:id/accept', middlewares_1.authenticate, middlewares_1.asyncMiddleware(middlewares_1.videosTerminateChangeOwnershipValidator), middlewares_1.asyncMiddleware(middlewares_1.videosAcceptChangeOwnershipValidator), middlewares_1.asyncRetryTransactionMiddleware(acceptOwnership));
ownershipVideoRouter.post('/ownership/:id/refuse', middlewares_1.authenticate, middlewares_1.asyncMiddleware(middlewares_1.videosTerminateChangeOwnershipValidator), middlewares_1.asyncRetryTransactionMiddleware(refuseOwnership));
function giveVideoOwnership(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoInstance = res.locals.video;
        const initiatorAccountId = res.locals.oauth.token.User.Account.id;
        const nextOwner = res.locals.nextOwner;
        yield initializers_1.sequelizeTypescript.transaction(t => {
            return video_change_ownership_1.VideoChangeOwnershipModel.findOrCreate({
                where: {
                    initiatorAccountId,
                    nextOwnerAccountId: nextOwner.id,
                    videoId: videoInstance.id,
                    status: videos_1.VideoChangeOwnershipStatus.WAITING
                },
                defaults: {
                    initiatorAccountId,
                    nextOwnerAccountId: nextOwner.id,
                    videoId: videoInstance.id,
                    status: videos_1.VideoChangeOwnershipStatus.WAITING
                },
                transaction: t
            });
        });
        logger_1.logger.info('Ownership change for video %s created.', videoInstance.name);
        return res.type('json').status(204).end();
    });
}
function listVideoOwnership(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentAccountId = res.locals.oauth.token.User.Account.id;
        const resultList = yield video_change_ownership_1.VideoChangeOwnershipModel.listForApi(currentAccountId, req.query.start || 0, req.query.count || 10, req.query.sort || 'createdAt');
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function acceptOwnership(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const videoChangeOwnership = res.locals.videoChangeOwnership;
            const targetVideo = videoChangeOwnership.Video;
            const channel = res.locals.videoChannel;
            const oldVideoChannel = yield video_channel_1.VideoChannelModel.loadByIdAndPopulateAccount(targetVideo.channelId);
            targetVideo.set('channelId', channel.id);
            const targetVideoUpdated = yield targetVideo.save({ transaction: t });
            targetVideoUpdated.VideoChannel = channel;
            if (targetVideoUpdated.privacy !== videos_1.VideoPrivacy.PRIVATE && targetVideoUpdated.state === videos_1.VideoState.PUBLISHED) {
                yield activitypub_1.changeVideoChannelShare(targetVideoUpdated, oldVideoChannel, t);
                yield send_1.sendUpdateVideo(targetVideoUpdated, t, oldVideoChannel.Account.Actor);
            }
            videoChangeOwnership.set('status', videos_1.VideoChangeOwnershipStatus.ACCEPTED);
            yield videoChangeOwnership.save({ transaction: t });
            return res.sendStatus(204);
        }));
    });
}
function refuseOwnership(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const videoChangeOwnership = res.locals.videoChangeOwnership;
            videoChangeOwnership.set('status', videos_1.VideoChangeOwnershipStatus.REFUSED);
            yield videoChangeOwnership.save({ transaction: t });
            return res.sendStatus(204);
        }));
    });
}
