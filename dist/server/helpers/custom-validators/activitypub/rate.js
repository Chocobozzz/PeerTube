"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const misc_1 = require("./misc");
function isLikeActivityValid(activity) {
    return misc_1.isBaseActivityValid(activity, 'Like') &&
        misc_1.isActivityPubUrlValid(activity.object);
}
exports.isLikeActivityValid = isLikeActivityValid;
function isDislikeActivityValid(activity) {
    return misc_1.isBaseActivityValid(activity, 'Create') &&
        activity.object.type === 'Dislike' &&
        misc_1.isActivityPubUrlValid(activity.object.actor) &&
        misc_1.isActivityPubUrlValid(activity.object.object);
}
exports.isDislikeActivityValid = isDislikeActivityValid;
//# sourceMappingURL=rate.js.map