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
const utils_1 = require("../../helpers/utils");
const middlewares_1 = require("../../middlewares");
const video_channel_1 = require("../../models/video/video-channel");
const validators_1 = require("../../middlewares/validators");
const send_1 = require("../../lib/activitypub/send");
const video_channel_2 = require("../../lib/video-channel");
const express_utils_1 = require("../../helpers/express-utils");
const activitypub_1 = require("../../lib/activitypub");
const account_1 = require("../../models/account/account");
const initializers_1 = require("../../initializers");
const logger_1 = require("../../helpers/logger");
const video_1 = require("../../models/video/video");
const avatar_1 = require("../../middlewares/validators/avatar");
const avatar_2 = require("../../lib/avatar");
const audit_logger_1 = require("../../helpers/audit-logger");
const database_utils_1 = require("../../helpers/database-utils");
const auditLogger = audit_logger_1.auditLoggerFactory('channels');
const reqAvatarFile = express_utils_1.createReqFiles(['avatarfile'], initializers_1.IMAGE_MIMETYPE_EXT, { avatarfile: initializers_1.CONFIG.STORAGE.AVATARS_DIR });
const videoChannelRouter = express.Router();
exports.videoChannelRouter = videoChannelRouter;
videoChannelRouter.get('/', middlewares_1.paginationValidator, middlewares_1.videoChannelsSortValidator, middlewares_1.setDefaultSort, middlewares_1.setDefaultPagination, middlewares_1.asyncMiddleware(listVideoChannels));
videoChannelRouter.post('/', middlewares_1.authenticate, middlewares_1.asyncMiddleware(middlewares_1.videoChannelsAddValidator), middlewares_1.asyncRetryTransactionMiddleware(addVideoChannel));
videoChannelRouter.post('/:nameWithHost/avatar/pick', middlewares_1.authenticate, reqAvatarFile, middlewares_1.asyncMiddleware(middlewares_1.videoChannelsUpdateValidator), avatar_1.updateAvatarValidator, middlewares_1.asyncMiddleware(updateVideoChannelAvatar));
videoChannelRouter.put('/:nameWithHost', middlewares_1.authenticate, middlewares_1.asyncMiddleware(middlewares_1.videoChannelsUpdateValidator), middlewares_1.asyncRetryTransactionMiddleware(updateVideoChannel));
videoChannelRouter.delete('/:nameWithHost', middlewares_1.authenticate, middlewares_1.asyncMiddleware(middlewares_1.videoChannelsRemoveValidator), middlewares_1.asyncRetryTransactionMiddleware(removeVideoChannel));
videoChannelRouter.get('/:nameWithHost', middlewares_1.asyncMiddleware(validators_1.videoChannelsNameWithHostValidator), middlewares_1.asyncMiddleware(getVideoChannel));
videoChannelRouter.get('/:nameWithHost/videos', middlewares_1.asyncMiddleware(validators_1.videoChannelsNameWithHostValidator), middlewares_1.paginationValidator, validators_1.videosSortValidator, middlewares_1.setDefaultSort, middlewares_1.setDefaultPagination, middlewares_1.optionalAuthenticate, middlewares_1.commonVideosFiltersValidator, middlewares_1.asyncMiddleware(listVideoChannelVideos));
function listVideoChannels(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const serverActor = yield utils_1.getServerActor();
        const resultList = yield video_channel_1.VideoChannelModel.listForApi(serverActor.id, req.query.start, req.query.count, req.query.sort);
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function updateVideoChannelAvatar(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const avatarPhysicalFile = req.files['avatarfile'][0];
        const videoChannel = res.locals.videoChannel;
        const oldVideoChannelAuditKeys = new audit_logger_1.VideoChannelAuditView(videoChannel.toFormattedJSON());
        const avatar = yield avatar_2.updateActorAvatarFile(avatarPhysicalFile, videoChannel);
        auditLogger.update(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.VideoChannelAuditView(videoChannel.toFormattedJSON()), oldVideoChannelAuditKeys);
        return res
            .json({
            avatar: avatar.toFormattedJSON()
        })
            .end();
    });
}
function addVideoChannel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoChannelInfo = req.body;
        const videoChannelCreated = yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const account = yield account_1.AccountModel.load(res.locals.oauth.token.User.Account.id, t);
            return video_channel_2.createVideoChannel(videoChannelInfo, account, t);
        }));
        activitypub_1.setAsyncActorKeys(videoChannelCreated.Actor)
            .catch(err => logger_1.logger.error('Cannot set async actor keys for account %s.', videoChannelCreated.Actor.uuid, { err }));
        auditLogger.create(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.VideoChannelAuditView(videoChannelCreated.toFormattedJSON()));
        logger_1.logger.info('Video channel with uuid %s created.', videoChannelCreated.Actor.uuid);
        return res.json({
            videoChannel: {
                id: videoChannelCreated.id,
                uuid: videoChannelCreated.Actor.uuid
            }
        }).end();
    });
}
function updateVideoChannel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoChannelInstance = res.locals.videoChannel;
        const videoChannelFieldsSave = videoChannelInstance.toJSON();
        const oldVideoChannelAuditKeys = new audit_logger_1.VideoChannelAuditView(videoChannelInstance.toFormattedJSON());
        const videoChannelInfoToUpdate = req.body;
        try {
            yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
                const sequelizeOptions = {
                    transaction: t
                };
                if (videoChannelInfoToUpdate.displayName !== undefined)
                    videoChannelInstance.set('name', videoChannelInfoToUpdate.displayName);
                if (videoChannelInfoToUpdate.description !== undefined)
                    videoChannelInstance.set('description', videoChannelInfoToUpdate.description);
                if (videoChannelInfoToUpdate.support !== undefined)
                    videoChannelInstance.set('support', videoChannelInfoToUpdate.support);
                const videoChannelInstanceUpdated = yield videoChannelInstance.save(sequelizeOptions);
                yield send_1.sendUpdateActor(videoChannelInstanceUpdated, t);
                auditLogger.update(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.VideoChannelAuditView(videoChannelInstanceUpdated.toFormattedJSON()), oldVideoChannelAuditKeys);
                logger_1.logger.info('Video channel with name %s and uuid %s updated.', videoChannelInstance.name, videoChannelInstance.Actor.uuid);
            }));
        }
        catch (err) {
            logger_1.logger.debug('Cannot update the video channel.', { err });
            database_utils_1.resetSequelizeInstance(videoChannelInstance, videoChannelFieldsSave);
            throw err;
        }
        return res.type('json').status(204).end();
    });
}
function removeVideoChannel(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoChannelInstance = res.locals.videoChannel;
        yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            yield videoChannelInstance.destroy({ transaction: t });
            auditLogger.delete(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.VideoChannelAuditView(videoChannelInstance.toFormattedJSON()));
            logger_1.logger.info('Video channel with name %s and uuid %s deleted.', videoChannelInstance.name, videoChannelInstance.Actor.uuid);
        }));
        return res.type('json').status(204).end();
    });
}
function getVideoChannel(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoChannelWithVideos = yield video_channel_1.VideoChannelModel.loadAndPopulateAccountAndVideos(res.locals.videoChannel.id);
        return res.json(videoChannelWithVideos.toFormattedJSON());
    });
}
function listVideoChannelVideos(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoChannelInstance = res.locals.videoChannel;
        const actorId = express_utils_1.isUserAbleToSearchRemoteURI(res) ? null : undefined;
        const resultList = yield video_1.VideoModel.listForApi({
            actorId,
            start: req.query.start,
            count: req.query.count,
            sort: req.query.sort,
            includeLocalVideos: true,
            categoryOneOf: req.query.categoryOneOf,
            licenceOneOf: req.query.licenceOneOf,
            languageOneOf: req.query.languageOneOf,
            tagsOneOf: req.query.tagsOneOf,
            tagsAllOf: req.query.tagsAllOf,
            filter: req.query.filter,
            nsfw: express_utils_1.buildNSFWFilter(res, req.query.nsfw),
            withFiles: false,
            videoChannelId: videoChannelInstance.id,
            user: res.locals.oauth ? res.locals.oauth.token.User : undefined
        });
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
//# sourceMappingURL=video-channel.js.map