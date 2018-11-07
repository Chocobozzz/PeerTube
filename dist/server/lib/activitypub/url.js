"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const initializers_1 = require("../../initializers");
function getVideoActivityPubUrl(video) {
    return initializers_1.CONFIG.WEBSERVER.URL + '/videos/watch/' + video.uuid;
}
exports.getVideoActivityPubUrl = getVideoActivityPubUrl;
function getVideoCacheFileActivityPubUrl(videoFile) {
    const suffixFPS = videoFile.fps && videoFile.fps !== -1 ? '-' + videoFile.fps : '';
    return `${initializers_1.CONFIG.WEBSERVER.URL}/redundancy/videos/${videoFile.Video.uuid}/${videoFile.resolution}${suffixFPS}`;
}
exports.getVideoCacheFileActivityPubUrl = getVideoCacheFileActivityPubUrl;
function getVideoCommentActivityPubUrl(video, videoComment) {
    return initializers_1.CONFIG.WEBSERVER.URL + '/videos/watch/' + video.uuid + '/comments/' + videoComment.id;
}
exports.getVideoCommentActivityPubUrl = getVideoCommentActivityPubUrl;
function getVideoChannelActivityPubUrl(videoChannelName) {
    return initializers_1.CONFIG.WEBSERVER.URL + '/video-channels/' + videoChannelName;
}
exports.getVideoChannelActivityPubUrl = getVideoChannelActivityPubUrl;
function getAccountActivityPubUrl(accountName) {
    return initializers_1.CONFIG.WEBSERVER.URL + '/accounts/' + accountName;
}
exports.getAccountActivityPubUrl = getAccountActivityPubUrl;
function getVideoAbuseActivityPubUrl(videoAbuse) {
    return initializers_1.CONFIG.WEBSERVER.URL + '/admin/video-abuses/' + videoAbuse.id;
}
exports.getVideoAbuseActivityPubUrl = getVideoAbuseActivityPubUrl;
function getVideoViewActivityPubUrl(byActor, video) {
    return video.url + '/views/' + byActor.uuid + '/' + new Date().toISOString();
}
exports.getVideoViewActivityPubUrl = getVideoViewActivityPubUrl;
function getVideoLikeActivityPubUrl(byActor, video) {
    return byActor.url + '/likes/' + video.id;
}
exports.getVideoLikeActivityPubUrl = getVideoLikeActivityPubUrl;
function getVideoDislikeActivityPubUrl(byActor, video) {
    return byActor.url + '/dislikes/' + video.id;
}
exports.getVideoDislikeActivityPubUrl = getVideoDislikeActivityPubUrl;
function getVideoSharesActivityPubUrl(video) {
    return video.url + '/announces';
}
exports.getVideoSharesActivityPubUrl = getVideoSharesActivityPubUrl;
function getVideoCommentsActivityPubUrl(video) {
    return video.url + '/comments';
}
exports.getVideoCommentsActivityPubUrl = getVideoCommentsActivityPubUrl;
function getVideoLikesActivityPubUrl(video) {
    return video.url + '/likes';
}
exports.getVideoLikesActivityPubUrl = getVideoLikesActivityPubUrl;
function getVideoDislikesActivityPubUrl(video) {
    return video.url + '/dislikes';
}
exports.getVideoDislikesActivityPubUrl = getVideoDislikesActivityPubUrl;
function getActorFollowActivityPubUrl(actorFollow) {
    const me = actorFollow.ActorFollower;
    const following = actorFollow.ActorFollowing;
    return me.url + '/follows/' + following.id;
}
exports.getActorFollowActivityPubUrl = getActorFollowActivityPubUrl;
function getActorFollowAcceptActivityPubUrl(actorFollow) {
    const follower = actorFollow.ActorFollower;
    const me = actorFollow.ActorFollowing;
    return follower.url + '/accepts/follows/' + me.id;
}
exports.getActorFollowAcceptActivityPubUrl = getActorFollowAcceptActivityPubUrl;
function getAnnounceActivityPubUrl(originalUrl, byActor) {
    return originalUrl + '/announces/' + byActor.id;
}
exports.getAnnounceActivityPubUrl = getAnnounceActivityPubUrl;
function getDeleteActivityPubUrl(originalUrl) {
    return originalUrl + '/delete';
}
exports.getDeleteActivityPubUrl = getDeleteActivityPubUrl;
function getUpdateActivityPubUrl(originalUrl, updatedAt) {
    return originalUrl + '/updates/' + updatedAt;
}
exports.getUpdateActivityPubUrl = getUpdateActivityPubUrl;
function getUndoActivityPubUrl(originalUrl) {
    return originalUrl + '/undo';
}
exports.getUndoActivityPubUrl = getUndoActivityPubUrl;
