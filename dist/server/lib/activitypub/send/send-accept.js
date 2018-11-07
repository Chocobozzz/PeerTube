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
const url_1 = require("../url");
const utils_1 = require("./utils");
const send_follow_1 = require("./send-follow");
const logger_1 = require("../../../helpers/logger");
function sendAccept(actorFollow) {
    return __awaiter(this, void 0, void 0, function* () {
        const follower = actorFollow.ActorFollower;
        const me = actorFollow.ActorFollowing;
        if (!follower.serverId) {
            logger_1.logger.warn('Do not sending accept to local follower.');
            return;
        }
        logger_1.logger.info('Creating job to accept follower %s.', follower.url);
        const followUrl = url_1.getActorFollowActivityPubUrl(actorFollow);
        const followData = send_follow_1.buildFollowActivity(followUrl, follower, me);
        const url = url_1.getActorFollowAcceptActivityPubUrl(actorFollow);
        const data = buildAcceptActivity(url, me, followData);
        return utils_1.unicastTo(data, me, follower.inboxUrl);
    });
}
exports.sendAccept = sendAccept;
function buildAcceptActivity(url, byActor, followActivityData) {
    return {
        type: 'Accept',
        id: url,
        actor: byActor.url,
        object: followActivityData
    };
}
