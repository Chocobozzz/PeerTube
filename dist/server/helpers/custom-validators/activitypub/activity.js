"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validator = require("validator");
const actor_1 = require("./actor");
const announce_1 = require("./announce");
const misc_1 = require("./misc");
const rate_1 = require("./rate");
const undo_1 = require("./undo");
const video_comments_1 = require("./video-comments");
const videos_1 = require("./videos");
const view_1 = require("./view");
const misc_2 = require("../misc");
const cache_file_1 = require("./cache-file");
function isRootActivityValid(activity) {
    return Array.isArray(activity['@context']) && (((activity.type === 'Collection' || activity.type === 'OrderedCollection') &&
        validator.isInt(activity.totalItems, { min: 0 }) &&
        Array.isArray(activity.items)) ||
        (misc_1.isActivityPubUrlValid(activity.id) &&
            misc_2.exists(activity.actor) &&
            (misc_1.isActivityPubUrlValid(activity.actor) || misc_1.isActivityPubUrlValid(activity.actor.id))));
}
exports.isRootActivityValid = isRootActivityValid;
const activityCheckers = {
    Create: checkCreateActivity,
    Update: checkUpdateActivity,
    Delete: checkDeleteActivity,
    Follow: checkFollowActivity,
    Accept: checkAcceptActivity,
    Reject: checkRejectActivity,
    Announce: checkAnnounceActivity,
    Undo: checkUndoActivity,
    Like: checkLikeActivity
};
function isActivityValid(activity) {
    const checker = activityCheckers[activity.type];
    if (!checker)
        return false;
    return checker(activity);
}
exports.isActivityValid = isActivityValid;
function checkCreateActivity(activity) {
    return view_1.isViewActivityValid(activity) ||
        rate_1.isDislikeActivityValid(activity) ||
        videos_1.sanitizeAndCheckVideoTorrentCreateActivity(activity) ||
        videos_1.isVideoFlagValid(activity) ||
        video_comments_1.isVideoCommentCreateActivityValid(activity) ||
        cache_file_1.isCacheFileCreateActivityValid(activity);
}
function checkUpdateActivity(activity) {
    return cache_file_1.isCacheFileUpdateActivityValid(activity) ||
        videos_1.sanitizeAndCheckVideoTorrentUpdateActivity(activity) ||
        actor_1.isActorUpdateActivityValid(activity);
}
function checkDeleteActivity(activity) {
    return videos_1.isVideoTorrentDeleteActivityValid(activity) ||
        actor_1.isActorDeleteActivityValid(activity) ||
        video_comments_1.isVideoCommentDeleteActivityValid(activity);
}
function checkFollowActivity(activity) {
    return actor_1.isActorFollowActivityValid(activity);
}
function checkAcceptActivity(activity) {
    return actor_1.isActorAcceptActivityValid(activity);
}
function checkRejectActivity(activity) {
    return actor_1.isActorRejectActivityValid(activity);
}
function checkAnnounceActivity(activity) {
    return announce_1.isAnnounceActivityValid(activity);
}
function checkUndoActivity(activity) {
    return undo_1.isUndoActivityValid(activity);
}
function checkLikeActivity(activity) {
    return rate_1.isLikeActivityValid(activity);
}
