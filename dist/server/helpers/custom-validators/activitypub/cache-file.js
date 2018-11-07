"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const misc_1 = require("./misc");
const videos_1 = require("./videos");
const misc_2 = require("../misc");
function isCacheFileCreateActivityValid(activity) {
    return misc_1.isBaseActivityValid(activity, 'Create') &&
        isCacheFileObjectValid(activity.object);
}
exports.isCacheFileCreateActivityValid = isCacheFileCreateActivityValid;
function isCacheFileUpdateActivityValid(activity) {
    return misc_1.isBaseActivityValid(activity, 'Update') &&
        isCacheFileObjectValid(activity.object);
}
exports.isCacheFileUpdateActivityValid = isCacheFileUpdateActivityValid;
function isCacheFileObjectValid(object) {
    return misc_2.exists(object) &&
        object.type === 'CacheFile' &&
        misc_2.isDateValid(object.expires) &&
        misc_1.isActivityPubUrlValid(object.object) &&
        videos_1.isRemoteVideoUrlValid(object.url);
}
exports.isCacheFileObjectValid = isCacheFileObjectValid;
//# sourceMappingURL=cache-file.js.map