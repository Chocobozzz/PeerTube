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
const initializers_1 = require("../../../initializers");
const actor_follow_1 = require("../../../models/activitypub/actor-follow");
function processRejectActivity(activity, targetActor, inboxActor) {
    return __awaiter(this, void 0, void 0, function* () {
        if (inboxActor === undefined)
            throw new Error('Need to reject on explicit inbox.');
        return processReject(inboxActor, targetActor);
    });
}
exports.processRejectActivity = processRejectActivity;
function processReject(follower, targetActor) {
    return __awaiter(this, void 0, void 0, function* () {
        return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const actorFollow = yield actor_follow_1.ActorFollowModel.loadByActorAndTarget(follower.id, targetActor.id, t);
            if (!actorFollow)
                throw new Error(`'Unknown actor follow ${follower.id} -> ${targetActor.id}.`);
            yield actorFollow.destroy({ transaction: t });
            return undefined;
        }));
    });
}
//# sourceMappingURL=process-reject.js.map