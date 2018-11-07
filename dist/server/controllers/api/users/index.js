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
const RateLimit = require("express-rate-limit");
const shared_1 = require("../../../../shared");
const logger_1 = require("../../../helpers/logger");
const utils_1 = require("../../../helpers/utils");
const initializers_1 = require("../../../initializers");
const emailer_1 = require("../../../lib/emailer");
const redis_1 = require("../../../lib/redis");
const user_1 = require("../../../lib/user");
const middlewares_1 = require("../../../middlewares");
const validators_1 = require("../../../middlewares/validators");
const user_2 = require("../../../models/account/user");
const audit_logger_1 = require("../../../helpers/audit-logger");
const me_1 = require("./me");
const oauth_model_1 = require("../../../lib/oauth-model");
const my_blocklist_1 = require("./my-blocklist");
const auditLogger = audit_logger_1.auditLoggerFactory('users');
const loginRateLimiter = new RateLimit({
    windowMs: initializers_1.RATES_LIMIT.LOGIN.WINDOW_MS,
    max: initializers_1.RATES_LIMIT.LOGIN.MAX,
    delayMs: 0
});
const askSendEmailLimiter = new RateLimit({
    windowMs: initializers_1.RATES_LIMIT.ASK_SEND_EMAIL.WINDOW_MS,
    max: initializers_1.RATES_LIMIT.ASK_SEND_EMAIL.MAX,
    delayMs: 0
});
const usersRouter = express.Router();
exports.usersRouter = usersRouter;
usersRouter.use('/', my_blocklist_1.myBlocklistRouter);
usersRouter.use('/', me_1.meRouter);
usersRouter.get('/autocomplete', middlewares_1.userAutocompleteValidator, middlewares_1.asyncMiddleware(autocompleteUsers));
usersRouter.get('/', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_USERS), middlewares_1.paginationValidator, middlewares_1.usersSortValidator, middlewares_1.setDefaultSort, middlewares_1.setDefaultPagination, middlewares_1.asyncMiddleware(listUsers));
usersRouter.post('/:id/block', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_USERS), middlewares_1.asyncMiddleware(validators_1.usersBlockingValidator), middlewares_1.asyncMiddleware(blockUser));
usersRouter.post('/:id/unblock', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_USERS), middlewares_1.asyncMiddleware(validators_1.usersBlockingValidator), middlewares_1.asyncMiddleware(unblockUser));
usersRouter.get('/:id', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_USERS), middlewares_1.asyncMiddleware(middlewares_1.usersGetValidator), getUser);
usersRouter.post('/', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_USERS), middlewares_1.asyncMiddleware(middlewares_1.usersAddValidator), middlewares_1.asyncRetryTransactionMiddleware(createUser));
usersRouter.post('/register', middlewares_1.asyncMiddleware(middlewares_1.ensureUserRegistrationAllowed), middlewares_1.ensureUserRegistrationAllowedForIP, middlewares_1.asyncMiddleware(middlewares_1.usersRegisterValidator), middlewares_1.asyncRetryTransactionMiddleware(registerUser));
usersRouter.put('/:id', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_USERS), middlewares_1.asyncMiddleware(middlewares_1.usersUpdateValidator), middlewares_1.asyncMiddleware(updateUser));
usersRouter.delete('/:id', middlewares_1.authenticate, middlewares_1.ensureUserHasRight(shared_1.UserRight.MANAGE_USERS), middlewares_1.asyncMiddleware(middlewares_1.usersRemoveValidator), middlewares_1.asyncMiddleware(removeUser));
usersRouter.post('/ask-reset-password', middlewares_1.asyncMiddleware(validators_1.usersAskResetPasswordValidator), middlewares_1.asyncMiddleware(askResetUserPassword));
usersRouter.post('/:id/reset-password', middlewares_1.asyncMiddleware(validators_1.usersResetPasswordValidator), middlewares_1.asyncMiddleware(resetUserPassword));
usersRouter.post('/ask-send-verify-email', askSendEmailLimiter, middlewares_1.asyncMiddleware(validators_1.usersAskSendVerifyEmailValidator), middlewares_1.asyncMiddleware(askSendVerifyUserEmail));
usersRouter.post('/:id/verify-email', middlewares_1.asyncMiddleware(validators_1.usersVerifyEmailValidator), middlewares_1.asyncMiddleware(verifyUserEmail));
usersRouter.post('/token', loginRateLimiter, middlewares_1.token, success);
function createUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const body = req.body;
        const userToCreate = new user_2.UserModel({
            username: body.username,
            password: body.password,
            email: body.email,
            nsfwPolicy: initializers_1.CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
            autoPlayVideo: true,
            role: body.role,
            videoQuota: body.videoQuota,
            videoQuotaDaily: body.videoQuotaDaily
        });
        const { user, account } = yield user_1.createUserAccountAndChannel(userToCreate);
        auditLogger.create(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.UserAuditView(user.toFormattedJSON()));
        logger_1.logger.info('User %s with its channel and account created.', body.username);
        return res.json({
            user: {
                id: user.id,
                account: {
                    id: account.id,
                    uuid: account.Actor.uuid
                }
            }
        }).end();
    });
}
function registerUser(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const body = req.body;
        const userToCreate = new user_2.UserModel({
            username: body.username,
            password: body.password,
            email: body.email,
            nsfwPolicy: initializers_1.CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
            autoPlayVideo: true,
            role: shared_1.UserRole.USER,
            videoQuota: initializers_1.CONFIG.USER.VIDEO_QUOTA,
            videoQuotaDaily: initializers_1.CONFIG.USER.VIDEO_QUOTA_DAILY,
            emailVerified: initializers_1.CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION ? false : null
        });
        const { user } = yield user_1.createUserAccountAndChannel(userToCreate);
        auditLogger.create(body.username, new audit_logger_1.UserAuditView(user.toFormattedJSON()));
        logger_1.logger.info('User %s with its channel and account registered.', body.username);
        if (initializers_1.CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION) {
            yield sendVerifyUserEmail(user);
        }
        return res.type('json').status(204).end();
    });
}
function unblockUser(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.user;
        yield changeUserBlock(res, user, false);
        return res.status(204).end();
    });
}
function blockUser(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.user;
        const reason = req.body.reason;
        yield changeUserBlock(res, user, true, reason);
        return res.status(204).end();
    });
}
function getUser(req, res, next) {
    return res.json(res.locals.user.toFormattedJSON());
}
function autocompleteUsers(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const resultList = yield user_2.UserModel.autoComplete(req.query.search);
        return res.json(resultList);
    });
}
function listUsers(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const resultList = yield user_2.UserModel.listForApi(req.query.start, req.query.count, req.query.sort, req.query.search);
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function removeUser(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.user;
        yield user.destroy();
        auditLogger.delete(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.UserAuditView(user.toFormattedJSON()));
        return res.sendStatus(204);
    });
}
function updateUser(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const body = req.body;
        const userToUpdate = res.locals.user;
        const oldUserAuditView = new audit_logger_1.UserAuditView(userToUpdate.toFormattedJSON());
        const roleChanged = body.role !== undefined && body.role !== userToUpdate.role;
        if (body.email !== undefined)
            userToUpdate.email = body.email;
        if (body.videoQuota !== undefined)
            userToUpdate.videoQuota = body.videoQuota;
        if (body.videoQuotaDaily !== undefined)
            userToUpdate.videoQuotaDaily = body.videoQuotaDaily;
        if (body.role !== undefined)
            userToUpdate.role = body.role;
        const user = yield userToUpdate.save();
        if (roleChanged)
            yield oauth_model_1.deleteUserToken(userToUpdate.id);
        auditLogger.update(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.UserAuditView(user.toFormattedJSON()), oldUserAuditView);
        return res.sendStatus(204);
    });
}
function askResetUserPassword(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.user;
        const verificationString = yield redis_1.Redis.Instance.setResetPasswordVerificationString(user.id);
        const url = initializers_1.CONFIG.WEBSERVER.URL + '/reset-password?userId=' + user.id + '&verificationString=' + verificationString;
        yield emailer_1.Emailer.Instance.addForgetPasswordEmailJob(user.email, url);
        return res.status(204).end();
    });
}
function resetUserPassword(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.user;
        user.password = req.body.password;
        yield user.save();
        return res.status(204).end();
    });
}
function sendVerifyUserEmail(user) {
    return __awaiter(this, void 0, void 0, function* () {
        const verificationString = yield redis_1.Redis.Instance.setVerifyEmailVerificationString(user.id);
        const url = initializers_1.CONFIG.WEBSERVER.URL + '/verify-account/email?userId=' + user.id + '&verificationString=' + verificationString;
        yield emailer_1.Emailer.Instance.addVerifyEmailJob(user.email, url);
        return;
    });
}
function askSendVerifyUserEmail(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.user;
        yield sendVerifyUserEmail(user);
        return res.status(204).end();
    });
}
function verifyUserEmail(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.user;
        user.emailVerified = true;
        yield user.save();
        return res.status(204).end();
    });
}
function success(req, res, next) {
    res.end();
}
function changeUserBlock(res, user, block, reason) {
    return __awaiter(this, void 0, void 0, function* () {
        const oldUserAuditView = new audit_logger_1.UserAuditView(user.toFormattedJSON());
        user.blocked = block;
        user.blockedReason = reason || null;
        yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            yield oauth_model_1.deleteUserToken(user.id, t);
            yield user.save({ transaction: t });
        }));
        yield emailer_1.Emailer.Instance.addUserBlockJob(user, block, reason);
        auditLogger.update(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.UserAuditView(user.toFormattedJSON()), oldUserAuditView);
    });
}
//# sourceMappingURL=index.js.map