"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const misc_1 = require("./misc");
function isViewActivityValid(activity) {
    return misc_1.isBaseActivityValid(activity, 'Create') &&
        activity.object.type === 'View' &&
        misc_1.isActivityPubUrlValid(activity.object.actor) &&
        misc_1.isActivityPubUrlValid(activity.object.object);
}
exports.isViewActivityValid = isViewActivityValid;
