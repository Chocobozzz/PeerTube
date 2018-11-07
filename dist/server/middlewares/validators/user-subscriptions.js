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
const logger_1 = require("../../helpers/logger");
const utils_1 = require("./utils");
const actor_follow_1 = require("../../models/activitypub/actor-follow");
const actor_1 = require("../../helpers/custom-validators/activitypub/actor");
const initializers_1 = require("../../initializers");
const misc_1 = require("../../helpers/custom-validators/misc");
const userSubscriptionAddValidator = [
    check_1.body('uri').custom(actor_1.isValidActorHandle).withMessage('Should have a valid URI to follow (username@domain)'),
    (req, res, next) => {
        logger_1.logger.debug('Checking userSubscriptionAddValidator parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        return next();
    }
];
exports.userSubscriptionAddValidator = userSubscriptionAddValidator;
const areSubscriptionsExistValidator = [
    check_1.query('uris')
        .customSanitizer(misc_1.toArray)
        .custom(actor_1.areValidActorHandles).withMessage('Should have a valid uri array'),
    (req, res, next) => {
        logger_1.logger.debug('Checking areSubscriptionsExistValidator parameters', { parameters: req.query });
        if (utils_1.areValidationErrors(req, res))
            return;
        return next();
    }
];
exports.areSubscriptionsExistValidator = areSubscriptionsExistValidator;
const userSubscriptionGetValidator = [
    check_1.param('uri').custom(actor_1.isValidActorHandle).withMessage('Should have a valid URI to unfollow'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking userSubscriptionGetValidator parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        let [name, host] = req.params.uri.split('@');
        if (host === initializers_1.CONFIG.WEBSERVER.HOST)
            host = null;
        const user = res.locals.oauth.token.User;
        const subscription = yield actor_follow_1.ActorFollowModel.loadByActorAndTargetNameAndHostForAPI(user.Account.Actor.id, name, host);
        if (!subscription || !subscription.ActorFollowing.VideoChannel) {
            return res
                .status(404)
                .json({
                error: `Subscription ${req.params.uri} not found.`
            })
                .end();
        }
        res.locals.subscription = subscription;
        return next();
    })
];
exports.userSubscriptionGetValidator = userSubscriptionGetValidator;
