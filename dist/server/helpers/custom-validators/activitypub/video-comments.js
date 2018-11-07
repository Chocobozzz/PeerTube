"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validator = require("validator");
const initializers_1 = require("../../../initializers");
const misc_1 = require("../misc");
const misc_2 = require("./misc");
function isVideoCommentCreateActivityValid(activity) {
    return misc_2.isBaseActivityValid(activity, 'Create') &&
        sanitizeAndCheckVideoCommentObject(activity.object);
}
exports.isVideoCommentCreateActivityValid = isVideoCommentCreateActivityValid;
function sanitizeAndCheckVideoCommentObject(comment) {
    if (!comment || comment.type !== 'Note')
        return false;
    normalizeComment(comment);
    return misc_2.isActivityPubUrlValid(comment.id) &&
        isCommentContentValid(comment.content) &&
        misc_2.isActivityPubUrlValid(comment.inReplyTo) &&
        misc_1.isDateValid(comment.published) &&
        misc_2.isActivityPubUrlValid(comment.url) &&
        misc_1.isArray(comment.to) &&
        (comment.to.indexOf(initializers_1.ACTIVITY_PUB.PUBLIC) !== -1 ||
            comment.cc.indexOf(initializers_1.ACTIVITY_PUB.PUBLIC) !== -1);
}
exports.sanitizeAndCheckVideoCommentObject = sanitizeAndCheckVideoCommentObject;
function isVideoCommentDeleteActivityValid(activity) {
    return misc_2.isBaseActivityValid(activity, 'Delete');
}
exports.isVideoCommentDeleteActivityValid = isVideoCommentDeleteActivityValid;
function isCommentContentValid(content) {
    return misc_1.exists(content) && validator.isLength('' + content, { min: 1 });
}
function normalizeComment(comment) {
    if (!comment)
        return;
    if (typeof comment.url !== 'string') {
        comment.url = comment.url.href || comment.url.url;
    }
    return;
}
