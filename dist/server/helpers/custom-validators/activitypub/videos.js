"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validator = require("validator");
const initializers_1 = require("../../../initializers");
const core_utils_1 = require("../../core-utils");
const misc_1 = require("../misc");
const videos_1 = require("../videos");
const misc_2 = require("./misc");
const videos_2 = require("../../../../shared/models/videos");
const video_abuses_1 = require("../video-abuses");
function sanitizeAndCheckVideoTorrentCreateActivity(activity) {
    return misc_2.isBaseActivityValid(activity, 'Create') &&
        sanitizeAndCheckVideoTorrentObject(activity.object);
}
exports.sanitizeAndCheckVideoTorrentCreateActivity = sanitizeAndCheckVideoTorrentCreateActivity;
function sanitizeAndCheckVideoTorrentUpdateActivity(activity) {
    return misc_2.isBaseActivityValid(activity, 'Update') &&
        sanitizeAndCheckVideoTorrentObject(activity.object);
}
exports.sanitizeAndCheckVideoTorrentUpdateActivity = sanitizeAndCheckVideoTorrentUpdateActivity;
function isVideoTorrentDeleteActivityValid(activity) {
    return misc_2.isBaseActivityValid(activity, 'Delete');
}
exports.isVideoTorrentDeleteActivityValid = isVideoTorrentDeleteActivityValid;
function isVideoFlagValid(activity) {
    return misc_2.isBaseActivityValid(activity, 'Create') &&
        activity.object.type === 'Flag' &&
        video_abuses_1.isVideoAbuseReasonValid(activity.object.content) &&
        misc_2.isActivityPubUrlValid(activity.object.object);
}
exports.isVideoFlagValid = isVideoFlagValid;
function isActivityPubVideoDurationValid(value) {
    return misc_1.exists(value) &&
        typeof value === 'string' &&
        value.startsWith('PT') &&
        value.endsWith('S') &&
        videos_1.isVideoDurationValid(value.replace(/[^0-9]+/g, ''));
}
function sanitizeAndCheckVideoTorrentObject(video) {
    if (!video || video.type !== 'Video')
        return false;
    if (!setValidRemoteTags(video))
        return false;
    if (!setValidRemoteVideoUrls(video))
        return false;
    if (!setRemoteVideoTruncatedContent(video))
        return false;
    if (!misc_2.setValidAttributedTo(video))
        return false;
    if (!setValidRemoteCaptions(video))
        return false;
    if (!videos_1.isVideoStateValid(video.state))
        video.state = videos_2.VideoState.PUBLISHED;
    if (!misc_1.isBooleanValid(video.waitTranscoding))
        video.waitTranscoding = false;
    return misc_2.isActivityPubUrlValid(video.id) &&
        videos_1.isVideoNameValid(video.name) &&
        isActivityPubVideoDurationValid(video.duration) &&
        misc_1.isUUIDValid(video.uuid) &&
        (!video.category || isRemoteNumberIdentifierValid(video.category)) &&
        (!video.licence || isRemoteNumberIdentifierValid(video.licence)) &&
        (!video.language || isRemoteStringIdentifierValid(video.language)) &&
        videos_1.isVideoViewsValid(video.views) &&
        misc_1.isBooleanValid(video.sensitive) &&
        misc_1.isBooleanValid(video.commentsEnabled) &&
        misc_1.isDateValid(video.published) &&
        misc_1.isDateValid(video.updated) &&
        (!video.content || isRemoteVideoContentValid(video.mediaType, video.content)) &&
        isRemoteVideoIconValid(video.icon) &&
        video.url.length !== 0 &&
        video.attributedTo.length !== 0;
}
exports.sanitizeAndCheckVideoTorrentObject = sanitizeAndCheckVideoTorrentObject;
function isRemoteVideoUrlValid(url) {
    if (url.width && !url.height)
        url.height = url.width;
    return url.type === 'Link' &&
        (initializers_1.ACTIVITY_PUB.URL_MIME_TYPES.VIDEO.indexOf(url.mediaType || url.mimeType) !== -1 &&
            misc_2.isActivityPubUrlValid(url.href) &&
            validator.isInt(url.height + '', { min: 0 }) &&
            validator.isInt(url.size + '', { min: 0 }) &&
            (!url.fps || validator.isInt(url.fps + '', { min: -1 }))) ||
        (initializers_1.ACTIVITY_PUB.URL_MIME_TYPES.TORRENT.indexOf(url.mediaType || url.mimeType) !== -1 &&
            misc_2.isActivityPubUrlValid(url.href) &&
            validator.isInt(url.height + '', { min: 0 })) ||
        (initializers_1.ACTIVITY_PUB.URL_MIME_TYPES.MAGNET.indexOf(url.mediaType || url.mimeType) !== -1 &&
            validator.isLength(url.href, { min: 5 }) &&
            validator.isInt(url.height + '', { min: 0 }));
}
exports.isRemoteVideoUrlValid = isRemoteVideoUrlValid;
function setValidRemoteTags(video) {
    if (Array.isArray(video.tag) === false)
        return false;
    video.tag = video.tag.filter(t => {
        return t.type === 'Hashtag' &&
            videos_1.isVideoTagValid(t.name);
    });
    return true;
}
function setValidRemoteCaptions(video) {
    if (!video.subtitleLanguage)
        video.subtitleLanguage = [];
    if (Array.isArray(video.subtitleLanguage) === false)
        return false;
    video.subtitleLanguage = video.subtitleLanguage.filter(caption => {
        return isRemoteStringIdentifierValid(caption);
    });
    return true;
}
function isRemoteNumberIdentifierValid(data) {
    return validator.isInt(data.identifier, { min: 0 });
}
function isRemoteStringIdentifierValid(data) {
    return typeof data.identifier === 'string';
}
exports.isRemoteStringIdentifierValid = isRemoteStringIdentifierValid;
function isRemoteVideoContentValid(mediaType, content) {
    return mediaType === 'text/markdown' && videos_1.isVideoTruncatedDescriptionValid(content);
}
function isRemoteVideoIconValid(icon) {
    return icon.type === 'Image' &&
        misc_2.isActivityPubUrlValid(icon.url) &&
        icon.mediaType === 'image/jpeg' &&
        validator.isInt(icon.width + '', { min: 0 }) &&
        validator.isInt(icon.height + '', { min: 0 });
}
function setValidRemoteVideoUrls(video) {
    if (Array.isArray(video.url) === false)
        return false;
    video.url = video.url.filter(u => isRemoteVideoUrlValid(u));
    return true;
}
function setRemoteVideoTruncatedContent(video) {
    if (video.content) {
        video.content = core_utils_1.peertubeTruncate(video.content, initializers_1.CONSTRAINTS_FIELDS.VIDEOS.TRUNCATED_DESCRIPTION.max);
    }
    return true;
}
