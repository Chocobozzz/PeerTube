"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const actor_1 = require("./actor");
const misc_1 = require("./misc");
const rate_1 = require("./rate");
const announce_1 = require("./announce");
const cache_file_1 = require("./cache-file");
function isUndoActivityValid(activity) {
    return misc_1.isBaseActivityValid(activity, 'Undo') &&
        (actor_1.isActorFollowActivityValid(activity.object) ||
            rate_1.isLikeActivityValid(activity.object) ||
            rate_1.isDislikeActivityValid(activity.object) ||
            announce_1.isAnnounceActivityValid(activity.object) ||
            cache_file_1.isCacheFileCreateActivityValid(activity.object));
}
exports.isUndoActivityValid = isUndoActivityValid;
//# sourceMappingURL=undo.js.map