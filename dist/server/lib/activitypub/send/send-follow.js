"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url_1 = require("../url");
const utils_1 = require("./utils");
const logger_1 = require("../../../helpers/logger");
function sendFollow(actorFollow) {
    const me = actorFollow.ActorFollower;
    const following = actorFollow.ActorFollowing;
    if (!following.serverId)
        return;
    logger_1.logger.info('Creating job to send follow request to %s.', following.url);
    const url = url_1.getActorFollowActivityPubUrl(actorFollow);
    const data = buildFollowActivity(url, me, following);
    return utils_1.unicastTo(data, me, following.inboxUrl);
}
exports.sendFollow = sendFollow;
function buildFollowActivity(url, byActor, targetActor) {
    return {
        type: 'Follow',
        id: url,
        actor: byActor.url,
        object: targetActor.url
    };
}
exports.buildFollowActivity = buildFollowActivity;
