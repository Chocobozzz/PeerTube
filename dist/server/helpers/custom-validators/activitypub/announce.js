"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const misc_1 = require("./misc");
function isAnnounceActivityValid(activity) {
    return misc_1.isBaseActivityValid(activity, 'Announce') &&
        (misc_1.isActivityPubUrlValid(activity.object) ||
            (activity.object && misc_1.isActivityPubUrlValid(activity.object.id)));
}
exports.isAnnounceActivityValid = isAnnounceActivityValid;
