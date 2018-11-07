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
const core_utils_1 = require("../../helpers/core-utils");
const servers_1 = require("../../helpers/custom-validators/servers");
const logger_1 = require("../../helpers/logger");
const utils_1 = require("../../helpers/utils");
const initializers_1 = require("../../initializers");
const actor_follow_1 = require("../../models/activitypub/actor-follow");
const utils_2 = require("./utils");
const followValidator = [
    check_1.body('hosts').custom(servers_1.isEachUniqueHostValid).withMessage('Should have an array of unique hosts'),
    (req, res, next) => {
        if (core_utils_1.isTestInstance() === false && initializers_1.CONFIG.WEBSERVER.SCHEME === 'http') {
            return res.status(500)
                .json({
                error: 'Cannot follow on a non HTTPS web server.'
            })
                .end();
        }
        logger_1.logger.debug('Checking follow parameters', { parameters: req.body });
        if (utils_2.areValidationErrors(req, res))
            return;
        return next();
    }
];
exports.followValidator = followValidator;
const removeFollowingValidator = [
    check_1.param('host').custom(servers_1.isHostValid).withMessage('Should have a valid host'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking unfollow parameters', { parameters: req.params });
        if (utils_2.areValidationErrors(req, res))
            return;
        const serverActor = yield utils_1.getServerActor();
        const follow = yield actor_follow_1.ActorFollowModel.loadByActorAndTargetNameAndHostForAPI(serverActor.id, initializers_1.SERVER_ACTOR_NAME, req.params.host);
        if (!follow) {
            return res
                .status(404)
                .json({
                error: `Follower ${req.params.host} not found.`
            })
                .end();
        }
        res.locals.follow = follow;
        return next();
    })
];
exports.removeFollowingValidator = removeFollowingValidator;
