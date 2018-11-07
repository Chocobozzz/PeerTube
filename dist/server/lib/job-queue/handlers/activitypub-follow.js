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
const logger_1 = require("../../../helpers/logger");
const initializers_1 = require("../../../initializers");
const send_1 = require("../../activitypub/send");
const core_utils_1 = require("../../../helpers/core-utils");
const webfinger_1 = require("../../../helpers/webfinger");
const actor_1 = require("../../activitypub/actor");
const database_utils_1 = require("../../../helpers/database-utils");
const actor_follow_1 = require("../../../models/activitypub/actor-follow");
const actor_2 = require("../../../models/activitypub/actor");
function processActivityPubFollow(job) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = job.data;
        const host = payload.host;
        logger_1.logger.info('Processing ActivityPub follow in job %d.', job.id);
        let targetActor;
        if (!host || host === initializers_1.CONFIG.WEBSERVER.HOST) {
            targetActor = yield actor_2.ActorModel.loadLocalByName(payload.name);
        }
        else {
            const sanitizedHost = core_utils_1.sanitizeHost(host, initializers_1.REMOTE_SCHEME.HTTP);
            const actorUrl = yield webfinger_1.loadActorUrlOrGetFromWebfinger(payload.name + '@' + sanitizedHost);
            targetActor = yield actor_1.getOrCreateActorAndServerAndModel(actorUrl);
        }
        const fromActor = yield actor_2.ActorModel.load(payload.followerActorId);
        return database_utils_1.retryTransactionWrapper(follow, fromActor, targetActor);
    });
}
exports.processActivityPubFollow = processActivityPubFollow;
function follow(fromActor, targetActor) {
    if (fromActor.id === targetActor.id) {
        throw new Error('Follower is the same than target actor.');
    }
    const state = !fromActor.serverId && !targetActor.serverId ? 'accepted' : 'pending';
    return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
        const [actorFollow] = yield actor_follow_1.ActorFollowModel.findOrCreate({
            where: {
                actorId: fromActor.id,
                targetActorId: targetActor.id
            },
            defaults: {
                state,
                actorId: fromActor.id,
                targetActorId: targetActor.id
            },
            transaction: t
        });
        actorFollow.ActorFollowing = targetActor;
        actorFollow.ActorFollower = fromActor;
        if (actorFollow.state !== 'accepted')
            yield send_1.sendFollow(actorFollow);
    }));
}
