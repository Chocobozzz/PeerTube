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
const actor_follow_1 = require("../../../models/activitypub/actor-follow");
const actor_1 = require("../actor");
function processAcceptActivity(activity, targetActor, inboxActor) {
    return __awaiter(this, void 0, void 0, function* () {
        if (inboxActor === undefined)
            throw new Error('Need to accept on explicit inbox.');
        return processAccept(inboxActor, targetActor);
    });
}
exports.processAcceptActivity = processAcceptActivity;
function processAccept(actor, targetActor) {
    return __awaiter(this, void 0, void 0, function* () {
        const follow = yield actor_follow_1.ActorFollowModel.loadByActorAndTarget(actor.id, targetActor.id);
        if (!follow)
            throw new Error('Cannot find associated follow.');
        if (follow.state !== 'accepted') {
            follow.set('state', 'accepted');
            yield follow.save();
            yield actor_1.addFetchOutboxJob(targetActor);
        }
    });
}
//# sourceMappingURL=process-accept.js.map