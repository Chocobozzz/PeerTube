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
const activitypub_1 = require("../../../helpers/activitypub");
const logger_1 = require("../../../helpers/logger");
const process_accept_1 = require("./process-accept");
const process_announce_1 = require("./process-announce");
const process_create_1 = require("./process-create");
const process_delete_1 = require("./process-delete");
const process_follow_1 = require("./process-follow");
const process_like_1 = require("./process-like");
const process_reject_1 = require("./process-reject");
const process_undo_1 = require("./process-undo");
const process_update_1 = require("./process-update");
const actor_1 = require("../actor");
const processActivity = {
    Create: process_create_1.processCreateActivity,
    Update: process_update_1.processUpdateActivity,
    Delete: process_delete_1.processDeleteActivity,
    Follow: process_follow_1.processFollowActivity,
    Accept: process_accept_1.processAcceptActivity,
    Reject: process_reject_1.processRejectActivity,
    Announce: process_announce_1.processAnnounceActivity,
    Undo: process_undo_1.processUndoActivity,
    Like: process_like_1.processLikeActivity
};
function processActivities(activities, signatureActor, inboxActor) {
    return __awaiter(this, void 0, void 0, function* () {
        const actorsCache = {};
        for (const activity of activities) {
            if (!signatureActor && ['Create', 'Announce', 'Like'].indexOf(activity.type) === -1) {
                logger_1.logger.error('Cannot process activity %s (type: %s) without the actor signature.', activity.id, activity.type);
                continue;
            }
            const actorUrl = activitypub_1.getActorUrl(activity.actor);
            if (signatureActor && actorUrl !== signatureActor.url) {
                logger_1.logger.warn('Signature mismatch between %s and %s.', actorUrl, signatureActor.url);
                continue;
            }
            const byActor = signatureActor || actorsCache[actorUrl] || (yield actor_1.getOrCreateActorAndServerAndModel(actorUrl));
            actorsCache[actorUrl] = byActor;
            const activityProcessor = processActivity[activity.type];
            if (activityProcessor === undefined) {
                logger_1.logger.warn('Unknown activity type %s.', activity.type, { activityId: activity.id });
                continue;
            }
            try {
                yield activityProcessor(activity, byActor, inboxActor);
            }
            catch (err) {
                logger_1.logger.warn('Cannot process activity %s.', activity.type, { err });
            }
        }
    });
}
exports.processActivities = processActivities;
//# sourceMappingURL=process.js.map