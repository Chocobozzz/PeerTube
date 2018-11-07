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
const database_utils_1 = require("../../../helpers/database-utils");
const logger_1 = require("../../../helpers/logger");
const initializers_1 = require("../../../initializers");
const actor_1 = require("../../../models/activitypub/actor");
const actor_follow_1 = require("../../../models/activitypub/actor-follow");
const send_1 = require("../send");
function processFollowActivity(activity, byActor) {
    return __awaiter(this, void 0, void 0, function* () {
        const activityObject = activity.object;
        return database_utils_1.retryTransactionWrapper(processFollow, byActor, activityObject);
    });
}
exports.processFollowActivity = processFollowActivity;
function processFollow(actor, targetActorURL) {
    return __awaiter(this, void 0, void 0, function* () {
        yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const targetActor = yield actor_1.ActorModel.loadByUrlAndPopulateAccountAndChannel(targetActorURL, t);
            if (!targetActor)
                throw new Error('Unknown actor');
            if (targetActor.isOwned() === false)
                throw new Error('This is not a local actor.');
            const [actorFollow] = yield actor_follow_1.ActorFollowModel.findOrCreate({
                where: {
                    actorId: actor.id,
                    targetActorId: targetActor.id
                },
                defaults: {
                    actorId: actor.id,
                    targetActorId: targetActor.id,
                    state: 'accepted'
                },
                transaction: t
            });
            actorFollow.ActorFollower = actor;
            actorFollow.ActorFollowing = targetActor;
            if (actorFollow.state !== 'accepted') {
                actorFollow.state = 'accepted';
                yield actorFollow.save({ transaction: t });
            }
            actorFollow.ActorFollower = actor;
            actorFollow.ActorFollowing = targetActor;
            return send_1.sendAccept(actorFollow);
        }));
        logger_1.logger.info('Actor %s is followed by actor %s.', targetActorURL, actor.url);
    });
}
