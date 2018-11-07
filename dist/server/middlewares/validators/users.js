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
const lodash_1 = require("lodash");
const misc_1 = require("../../helpers/custom-validators/misc");
const users_1 = require("../../helpers/custom-validators/users");
const videos_1 = require("../../helpers/custom-validators/videos");
const logger_1 = require("../../helpers/logger");
const signup_1 = require("../../helpers/signup");
const redis_1 = require("../../lib/redis");
const user_1 = require("../../models/account/user");
const utils_1 = require("./utils");
const actor_1 = require("../../models/activitypub/actor");
const usersAddValidator = [
    check_1.body('username').custom(users_1.isUserUsernameValid).withMessage('Should have a valid username (lowercase alphanumeric characters)'),
    check_1.body('password').custom(users_1.isUserPasswordValid).withMessage('Should have a valid password'),
    check_1.body('email').isEmail().withMessage('Should have a valid email'),
    check_1.body('videoQuota').custom(users_1.isUserVideoQuotaValid).withMessage('Should have a valid user quota'),
    check_1.body('videoQuotaDaily').custom(users_1.isUserVideoQuotaDailyValid).withMessage('Should have a valid daily user quota'),
    check_1.body('role').custom(users_1.isUserRoleValid).withMessage('Should have a valid role'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking usersAdd parameters', { parameters: lodash_1.omit(req.body, 'password') });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield checkUserNameOrEmailDoesNotAlreadyExist(req.body.username, req.body.email, res)))
            return;
        return next();
    })
];
exports.usersAddValidator = usersAddValidator;
const usersRegisterValidator = [
    check_1.body('username').custom(users_1.isUserUsernameValid).withMessage('Should have a valid username'),
    check_1.body('password').custom(users_1.isUserPasswordValid).withMessage('Should have a valid password'),
    check_1.body('email').isEmail().withMessage('Should have a valid email'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking usersRegister parameters', { parameters: lodash_1.omit(req.body, 'password') });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield checkUserNameOrEmailDoesNotAlreadyExist(req.body.username, req.body.email, res)))
            return;
        return next();
    })
];
exports.usersRegisterValidator = usersRegisterValidator;
const usersRemoveValidator = [
    check_1.param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking usersRemove parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield checkUserIdExist(req.params.id, res)))
            return;
        const user = res.locals.user;
        if (user.username === 'root') {
            return res.status(400)
                .send({ error: 'Cannot remove the root user' })
                .end();
        }
        return next();
    })
];
exports.usersRemoveValidator = usersRemoveValidator;
const usersBlockingValidator = [
    check_1.param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),
    check_1.body('reason').optional().custom(users_1.isUserBlockedReasonValid).withMessage('Should have a valid blocking reason'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking usersBlocking parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield checkUserIdExist(req.params.id, res)))
            return;
        const user = res.locals.user;
        if (user.username === 'root') {
            return res.status(400)
                .send({ error: 'Cannot block the root user' })
                .end();
        }
        return next();
    })
];
exports.usersBlockingValidator = usersBlockingValidator;
const deleteMeValidator = [
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.oauth.token.User;
        if (user.username === 'root') {
            return res.status(400)
                .send({ error: 'You cannot delete your root account.' })
                .end();
        }
        return next();
    })
];
exports.deleteMeValidator = deleteMeValidator;
const usersUpdateValidator = [
    check_1.param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),
    check_1.body('email').optional().isEmail().withMessage('Should have a valid email attribute'),
    check_1.body('videoQuota').optional().custom(users_1.isUserVideoQuotaValid).withMessage('Should have a valid user quota'),
    check_1.body('videoQuotaDaily').optional().custom(users_1.isUserVideoQuotaDailyValid).withMessage('Should have a valid daily user quota'),
    check_1.body('role').optional().custom(users_1.isUserRoleValid).withMessage('Should have a valid role'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking usersUpdate parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield checkUserIdExist(req.params.id, res)))
            return;
        const user = res.locals.user;
        if (user.username === 'root' && req.body.role !== undefined && user.role !== req.body.role) {
            return res.status(400)
                .send({ error: 'Cannot change root role.' })
                .end();
        }
        return next();
    })
];
exports.usersUpdateValidator = usersUpdateValidator;
const usersUpdateMeValidator = [
    check_1.body('displayName').optional().custom(users_1.isUserDisplayNameValid).withMessage('Should have a valid display name'),
    check_1.body('description').optional().custom(users_1.isUserDescriptionValid).withMessage('Should have a valid description'),
    check_1.body('currentPassword').optional().custom(users_1.isUserPasswordValid).withMessage('Should have a valid current password'),
    check_1.body('password').optional().custom(users_1.isUserPasswordValid).withMessage('Should have a valid password'),
    check_1.body('email').optional().isEmail().withMessage('Should have a valid email attribute'),
    check_1.body('nsfwPolicy').optional().custom(users_1.isUserNSFWPolicyValid).withMessage('Should have a valid display Not Safe For Work policy'),
    check_1.body('autoPlayVideo').optional().custom(users_1.isUserAutoPlayVideoValid).withMessage('Should have a valid automatically plays video attribute'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking usersUpdateMe parameters', { parameters: lodash_1.omit(req.body, 'password') });
        if (req.body.password) {
            if (!req.body.currentPassword) {
                return res.status(400)
                    .send({ error: 'currentPassword parameter is missing.' })
                    .end();
            }
            const user = res.locals.oauth.token.User;
            if ((yield user.isPasswordMatch(req.body.currentPassword)) !== true) {
                return res.status(401)
                    .send({ error: 'currentPassword is invalid.' })
                    .end();
            }
        }
        if (utils_1.areValidationErrors(req, res))
            return;
        return next();
    })
];
exports.usersUpdateMeValidator = usersUpdateMeValidator;
const usersGetValidator = [
    check_1.param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking usersGet parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield checkUserIdExist(req.params.id, res)))
            return;
        return next();
    })
];
exports.usersGetValidator = usersGetValidator;
const usersVideoRatingValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking usersVideoRating parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res, 'id')))
            return;
        return next();
    })
];
exports.usersVideoRatingValidator = usersVideoRatingValidator;
const ensureUserRegistrationAllowed = [
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        const allowed = yield signup_1.isSignupAllowed();
        if (allowed === false) {
            return res.status(403)
                .send({ error: 'User registration is not enabled or user limit is reached.' })
                .end();
        }
        return next();
    })
];
exports.ensureUserRegistrationAllowed = ensureUserRegistrationAllowed;
const ensureUserRegistrationAllowedForIP = [
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        const allowed = signup_1.isSignupAllowedForCurrentIP(req.ip);
        if (allowed === false) {
            return res.status(403)
                .send({ error: 'You are not on a network authorized for registration.' })
                .end();
        }
        return next();
    })
];
exports.ensureUserRegistrationAllowedForIP = ensureUserRegistrationAllowedForIP;
const usersAskResetPasswordValidator = [
    check_1.body('email').isEmail().not().isEmpty().withMessage('Should have a valid email'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking usersAskResetPassword parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        const exists = yield checkUserEmailExist(req.body.email, res, false);
        if (!exists) {
            logger_1.logger.debug('User with email %s does not exist (asking reset password).', req.body.email);
            return res.status(204).end();
        }
        return next();
    })
];
exports.usersAskResetPasswordValidator = usersAskResetPasswordValidator;
const usersResetPasswordValidator = [
    check_1.param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),
    check_1.body('verificationString').not().isEmpty().withMessage('Should have a valid verification string'),
    check_1.body('password').custom(users_1.isUserPasswordValid).withMessage('Should have a valid password'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking usersResetPassword parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield checkUserIdExist(req.params.id, res)))
            return;
        const user = res.locals.user;
        const redisVerificationString = yield redis_1.Redis.Instance.getResetPasswordLink(user.id);
        if (redisVerificationString !== req.body.verificationString) {
            return res
                .status(403)
                .send({ error: 'Invalid verification string.' })
                .end();
        }
        return next();
    })
];
exports.usersResetPasswordValidator = usersResetPasswordValidator;
const usersAskSendVerifyEmailValidator = [
    check_1.body('email').isEmail().not().isEmpty().withMessage('Should have a valid email'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking askUsersSendVerifyEmail parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        const exists = yield checkUserEmailExist(req.body.email, res, false);
        if (!exists) {
            logger_1.logger.debug('User with email %s does not exist (asking verify email).', req.body.email);
            return res.status(204).end();
        }
        return next();
    })
];
exports.usersAskSendVerifyEmailValidator = usersAskSendVerifyEmailValidator;
const usersVerifyEmailValidator = [
    check_1.param('id').isInt().not().isEmpty().withMessage('Should have a valid id'),
    check_1.body('verificationString').not().isEmpty().withMessage('Should have a valid verification string'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking usersVerifyEmail parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield checkUserIdExist(req.params.id, res)))
            return;
        const user = res.locals.user;
        const redisVerificationString = yield redis_1.Redis.Instance.getVerifyEmailLink(user.id);
        if (redisVerificationString !== req.body.verificationString) {
            return res
                .status(403)
                .send({ error: 'Invalid verification string.' })
                .end();
        }
        return next();
    })
];
exports.usersVerifyEmailValidator = usersVerifyEmailValidator;
const userAutocompleteValidator = [
    check_1.param('search').isString().not().isEmpty().withMessage('Should have a search parameter')
];
exports.userAutocompleteValidator = userAutocompleteValidator;
function checkUserIdExist(id, res) {
    return checkUserExist(() => user_1.UserModel.loadById(id), res);
}
function checkUserEmailExist(email, res, abortResponse = true) {
    return checkUserExist(() => user_1.UserModel.loadByEmail(email), res, abortResponse);
}
function checkUserNameOrEmailDoesNotAlreadyExist(username, email, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield user_1.UserModel.loadByUsernameOrEmail(username, email);
        if (user) {
            res.status(409)
                .send({ error: 'User with this username or email already exists.' })
                .end();
            return false;
        }
        const actor = yield actor_1.ActorModel.loadLocalByName(username);
        if (actor) {
            res.status(409)
                .send({ error: 'Another actor (account/channel) with this name on this instance already exists or has already existed.' })
                .end();
            return false;
        }
        return true;
    });
}
function checkUserExist(finder, res, abortResponse = true) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield finder();
        if (!user) {
            if (abortResponse === true) {
                res.status(404)
                    .send({ error: 'User not found' })
                    .end();
            }
            return false;
        }
        res.locals.user = user;
        return true;
    });
}
//# sourceMappingURL=users.js.map