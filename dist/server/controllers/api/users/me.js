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
require("multer");
const utils_1 = require("../../../helpers/utils");
const initializers_1 = require("../../../initializers");
const send_1 = require("../../../lib/activitypub/send");
const middlewares_1 = require("../../../middlewares");
const validators_1 = require("../../../middlewares/validators");
const account_video_rate_1 = require("../../../models/account/account-video-rate");
const user_1 = require("../../../models/account/user");
const video_1 = require("../../../models/video/video");
const express_utils_1 = require("../../../helpers/express-utils");
const avatar_1 = require("../../../middlewares/validators/avatar");
const avatar_2 = require("../../../lib/avatar");
const audit_logger_1 = require("../../../helpers/audit-logger");
const video_import_1 = require("../../../models/video/video-import");
const actor_follow_1 = require("../../../models/activitypub/actor-follow");
const job_queue_1 = require("../../../lib/job-queue");
const logger_1 = require("../../../helpers/logger");
const account_1 = require("../../../models/account/account");
const auditLogger = audit_logger_1.auditLoggerFactory('users-me');
const reqAvatarFile = express_utils_1.createReqFiles(['avatarfile'], initializers_1.IMAGE_MIMETYPE_EXT, { avatarfile: initializers_1.CONFIG.STORAGE.AVATARS_DIR });
const meRouter = express.Router();
exports.meRouter = meRouter;
meRouter.get('/me', middlewares_1.authenticate, middlewares_1.asyncMiddleware(getUserInformation));
meRouter.delete('/me', middlewares_1.authenticate, middlewares_1.asyncMiddleware(validators_1.deleteMeValidator), middlewares_1.asyncMiddleware(deleteMe));
meRouter.get('/me/video-quota-used', middlewares_1.authenticate, middlewares_1.asyncMiddleware(getUserVideoQuotaUsed));
meRouter.get('/me/videos/imports', middlewares_1.authenticate, middlewares_1.paginationValidator, validators_1.videoImportsSortValidator, middlewares_1.setDefaultSort, middlewares_1.setDefaultPagination, middlewares_1.asyncMiddleware(getUserVideoImports));
meRouter.get('/me/videos', middlewares_1.authenticate, middlewares_1.paginationValidator, validators_1.videosSortValidator, middlewares_1.setDefaultSort, middlewares_1.setDefaultPagination, middlewares_1.asyncMiddleware(getUserVideos));
meRouter.get('/me/videos/:videoId/rating', middlewares_1.authenticate, middlewares_1.asyncMiddleware(middlewares_1.usersVideoRatingValidator), middlewares_1.asyncMiddleware(getUserVideoRating));
meRouter.put('/me', middlewares_1.authenticate, middlewares_1.asyncMiddleware(middlewares_1.usersUpdateMeValidator), middlewares_1.asyncRetryTransactionMiddleware(updateMe));
meRouter.post('/me/avatar/pick', middlewares_1.authenticate, reqAvatarFile, avatar_1.updateAvatarValidator, middlewares_1.asyncRetryTransactionMiddleware(updateMyAvatar));
meRouter.get('/me/subscriptions/videos', middlewares_1.authenticate, middlewares_1.paginationValidator, validators_1.videosSortValidator, middlewares_1.setDefaultSort, middlewares_1.setDefaultPagination, middlewares_1.commonVideosFiltersValidator, middlewares_1.asyncMiddleware(getUserSubscriptionVideos));
meRouter.get('/me/subscriptions/exist', middlewares_1.authenticate, validators_1.areSubscriptionsExistValidator, middlewares_1.asyncMiddleware(areSubscriptionsExist));
meRouter.get('/me/subscriptions', middlewares_1.authenticate, middlewares_1.paginationValidator, validators_1.userSubscriptionsSortValidator, middlewares_1.setDefaultSort, middlewares_1.setDefaultPagination, middlewares_1.asyncMiddleware(getUserSubscriptions));
meRouter.post('/me/subscriptions', middlewares_1.authenticate, middlewares_1.userSubscriptionAddValidator, middlewares_1.asyncMiddleware(addUserSubscription));
meRouter.get('/me/subscriptions/:uri', middlewares_1.authenticate, middlewares_1.userSubscriptionGetValidator, getUserSubscription);
meRouter.delete('/me/subscriptions/:uri', middlewares_1.authenticate, middlewares_1.userSubscriptionGetValidator, middlewares_1.asyncRetryTransactionMiddleware(deleteUserSubscription));
function areSubscriptionsExist(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const uris = req.query.uris;
        const user = res.locals.oauth.token.User;
        const handles = uris.map(u => {
            let [name, host] = u.split('@');
            if (host === initializers_1.CONFIG.WEBSERVER.HOST)
                host = null;
            return { name, host, uri: u };
        });
        const results = yield actor_follow_1.ActorFollowModel.listSubscribedIn(user.Account.Actor.id, handles);
        const existObject = {};
        for (const handle of handles) {
            const obj = results.find(r => {
                const server = r.ActorFollowing.Server;
                return r.ActorFollowing.preferredUsername === handle.name &&
                    ((!server && !handle.host) ||
                        (server.host === handle.host));
            });
            existObject[handle.uri] = obj !== undefined;
        }
        return res.json(existObject);
    });
}
function addUserSubscription(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.oauth.token.User;
        const [name, host] = req.body.uri.split('@');
        const payload = {
            name,
            host,
            followerActorId: user.Account.Actor.id
        };
        job_queue_1.JobQueue.Instance.createJob({ type: 'activitypub-follow', payload })
            .catch(err => logger_1.logger.error('Cannot create follow job for subscription %s.', req.body.uri, err));
        return res.status(204).end();
    });
}
function getUserSubscription(req, res) {
    const subscription = res.locals.subscription;
    return res.json(subscription.ActorFollowing.VideoChannel.toFormattedJSON());
}
function deleteUserSubscription(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const subscription = res.locals.subscription;
        yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            return subscription.destroy({ transaction: t });
        }));
        return res.type('json').status(204).end();
    });
}
function getUserSubscriptions(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.oauth.token.User;
        const actorId = user.Account.Actor.id;
        const resultList = yield actor_follow_1.ActorFollowModel.listSubscriptionsForApi(actorId, req.query.start, req.query.count, req.query.sort);
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function getUserSubscriptionVideos(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.oauth.token.User;
        const resultList = yield video_1.VideoModel.listForApi({
            start: req.query.start,
            count: req.query.count,
            sort: req.query.sort,
            includeLocalVideos: false,
            categoryOneOf: req.query.categoryOneOf,
            licenceOneOf: req.query.licenceOneOf,
            languageOneOf: req.query.languageOneOf,
            tagsOneOf: req.query.tagsOneOf,
            tagsAllOf: req.query.tagsAllOf,
            nsfw: express_utils_1.buildNSFWFilter(res, req.query.nsfw),
            filter: req.query.filter,
            withFiles: false,
            actorId: user.Account.Actor.id,
            user
        });
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function getUserVideos(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.oauth.token.User;
        const resultList = yield video_1.VideoModel.listUserVideosForApi(user.Account.id, req.query.start, req.query.count, req.query.sort);
        const additionalAttributes = {
            waitTranscoding: true,
            state: true,
            scheduledUpdate: true,
            blacklistInfo: true
        };
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total, { additionalAttributes }));
    });
}
function getUserVideoImports(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.oauth.token.User;
        const resultList = yield video_import_1.VideoImportModel.listUserVideoImportsForApi(user.id, req.query.start, req.query.count, req.query.sort);
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function getUserInformation(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield user_1.UserModel.loadByUsernameAndPopulateChannels(res.locals.oauth.token.user.username);
        return res.json(user.toFormattedJSON());
    });
}
function getUserVideoQuotaUsed(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield user_1.UserModel.loadByUsernameAndPopulateChannels(res.locals.oauth.token.user.username);
        const videoQuotaUsed = yield user_1.UserModel.getOriginalVideoFileTotalFromUser(user);
        const videoQuotaUsedDaily = yield user_1.UserModel.getOriginalVideoFileTotalDailyFromUser(user);
        const data = {
            videoQuotaUsed,
            videoQuotaUsedDaily
        };
        return res.json(data);
    });
}
function getUserVideoRating(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoId = res.locals.video.id;
        const accountId = +res.locals.oauth.token.User.Account.id;
        const ratingObj = yield account_video_rate_1.AccountVideoRateModel.load(accountId, videoId, null);
        const rating = ratingObj ? ratingObj.type : 'none';
        const json = {
            videoId,
            rating
        };
        return res.json(json);
    });
}
function deleteMe(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.oauth.token.User;
        yield user.destroy();
        auditLogger.delete(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.UserAuditView(user.toFormattedJSON()));
        return res.sendStatus(204);
    });
}
function updateMe(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const body = req.body;
        const user = res.locals.oauth.token.user;
        const oldUserAuditView = new audit_logger_1.UserAuditView(user.toFormattedJSON());
        if (body.password !== undefined)
            user.password = body.password;
        if (body.email !== undefined)
            user.email = body.email;
        if (body.nsfwPolicy !== undefined)
            user.nsfwPolicy = body.nsfwPolicy;
        if (body.webTorrentEnabled !== undefined)
            user.webTorrentEnabled = body.webTorrentEnabled;
        if (body.autoPlayVideo !== undefined)
            user.autoPlayVideo = body.autoPlayVideo;
        yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const userAccount = yield account_1.AccountModel.load(user.Account.id);
            yield user.save({ transaction: t });
            if (body.displayName !== undefined)
                userAccount.name = body.displayName;
            if (body.description !== undefined)
                userAccount.description = body.description;
            yield userAccount.save({ transaction: t });
            yield send_1.sendUpdateActor(userAccount, t);
            auditLogger.update(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.UserAuditView(user.toFormattedJSON()), oldUserAuditView);
        }));
        return res.sendStatus(204);
    });
}
function updateMyAvatar(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const avatarPhysicalFile = req.files['avatarfile'][0];
        const user = res.locals.oauth.token.user;
        const oldUserAuditView = new audit_logger_1.UserAuditView(user.toFormattedJSON());
        const userAccount = yield account_1.AccountModel.load(user.Account.id);
        const avatar = yield avatar_2.updateActorAvatarFile(avatarPhysicalFile, userAccount);
        auditLogger.update(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.UserAuditView(user.toFormattedJSON()), oldUserAuditView);
        return res.json({ avatar: avatar.toFormattedJSON() });
    });
}
