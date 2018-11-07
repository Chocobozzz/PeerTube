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
const initializers_1 = require("../../../initializers");
const send_1 = require("../../../lib/activitypub/send");
const middlewares_1 = require("../../../middlewares");
const account_1 = require("../../../models/account/account");
const video_abuse_1 = require("../../../models/video/video-abuse");
const audit_logger_1 = require("../../../helpers/audit-logger");
const auditLogger = audit_logger_1.auditLoggerFactory('abuse');
const abuseVideoRouter = express.Router();
exports.abuseVideoRouter = abuseVideoRouter;
abuseVideoRouter.get('/abuse', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_VIDEO_ABUSES), middlewares_1.paginationValidator, middlewares_1.videoAbusesSortValidator, middlewares_1.setDefaultSort, middlewares_1.setDefaultPagination, middlewares_1.asyncMiddleware(listVideoAbuses));
abuseVideoRouter.put('/:videoId/abuse/:id', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_VIDEO_ABUSES), middlewares_1.asyncMiddleware(middlewares_1.videoAbuseUpdateValidator), middlewares_1.asyncRetryTransactionMiddleware(updateVideoAbuse));
abuseVideoRouter.post('/:videoId/abuse', middlewares_1.authenticate, middlewares_1.asyncMiddleware(middlewares_1.videoAbuseReportValidator), middlewares_1.asyncRetryTransactionMiddleware(reportVideoAbuse));
abuseVideoRouter.delete('/:videoId/abuse/:id', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_VIDEO_ABUSES), middlewares_1.asyncMiddleware(middlewares_1.videoAbuseGetValidator), middlewares_1.asyncRetryTransactionMiddleware(deleteVideoAbuse));
function listVideoAbuses(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const resultList = yield video_abuse_1.VideoAbuseModel.listForApi(req.query.start, req.query.count, req.query.sort);
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function updateVideoAbuse(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoAbuse = res.locals.videoAbuse;
        if (req.body.moderationComment !== undefined)
            videoAbuse.moderationComment = req.body.moderationComment;
        if (req.body.state !== undefined)
            videoAbuse.state = req.body.state;
        yield initializers_1.sequelizeTypescript.transaction(t => {
            return videoAbuse.save({ transaction: t });
        });
        return res.type('json').status(204).end();
    });
}
function deleteVideoAbuse(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoAbuse = res.locals.videoAbuse;
        yield initializers_1.sequelizeTypescript.transaction(t => {
            return videoAbuse.destroy({ transaction: t });
        });
        return res.type('json').status(204).end();
    });
}
function reportVideoAbuse(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoInstance = res.locals.video;
        const body = req.body;
        const videoAbuse = yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const reporterAccount = yield account_1.AccountModel.load(res.locals.oauth.token.User.Account.id, t);
            const abuseToCreate = {
                reporterAccountId: reporterAccount.id,
                reason: body.reason,
                videoId: videoInstance.id,
                state: shared_1.VideoAbuseState.PENDING
            };
            const videoAbuseInstance = yield video_abuse_1.VideoAbuseModel.create(abuseToCreate, { transaction: t });
            videoAbuseInstance.Video = videoInstance;
            videoAbuseInstance.Account = reporterAccount;
            if (videoInstance.isOwned() === false) {
                yield send_1.sendVideoAbuse(reporterAccount.Actor, videoAbuseInstance, videoInstance);
            }
            auditLogger.create(reporterAccount.Actor.getIdentifier(), new audit_logger_1.VideoAbuseAuditView(videoAbuseInstance.toFormattedJSON()));
            return videoAbuseInstance;
        }));
        logger_1.logger.info('Abuse report for video %s created.', videoInstance.name);
        return res.json({ videoAbuse: videoAbuse.toFormattedJSON() }).end();
    });
}
