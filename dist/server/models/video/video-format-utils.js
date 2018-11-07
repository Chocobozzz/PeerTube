"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const video_1 = require("./video");
const initializers_1 = require("../../initializers");
const video_caption_1 = require("./video-caption");
const activitypub_1 = require("../../lib/activitypub");
const misc_1 = require("../../helpers/custom-validators/misc");
function videoModelToFormattedJSON(video, options) {
    const formattedAccount = video.VideoChannel.Account.toFormattedJSON();
    const formattedVideoChannel = video.VideoChannel.toFormattedJSON();
    const userHistory = misc_1.isArray(video.UserVideoHistories) ? video.UserVideoHistories[0] : undefined;
    const videoObject = {
        id: video.id,
        uuid: video.uuid,
        name: video.name,
        category: {
            id: video.category,
            label: video_1.VideoModel.getCategoryLabel(video.category)
        },
        licence: {
            id: video.licence,
            label: video_1.VideoModel.getLicenceLabel(video.licence)
        },
        language: {
            id: video.language,
            label: video_1.VideoModel.getLanguageLabel(video.language)
        },
        privacy: {
            id: video.privacy,
            label: video_1.VideoModel.getPrivacyLabel(video.privacy)
        },
        nsfw: video.nsfw,
        description: options && options.completeDescription === true ? video.description : video.getTruncatedDescription(),
        isLocal: video.isOwned(),
        duration: video.duration,
        views: video.views,
        likes: video.likes,
        dislikes: video.dislikes,
        thumbnailPath: video.getThumbnailStaticPath(),
        previewPath: video.getPreviewStaticPath(),
        embedPath: video.getEmbedStaticPath(),
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
        publishedAt: video.publishedAt,
        account: {
            id: formattedAccount.id,
            uuid: formattedAccount.uuid,
            name: formattedAccount.name,
            displayName: formattedAccount.displayName,
            url: formattedAccount.url,
            host: formattedAccount.host,
            avatar: formattedAccount.avatar
        },
        channel: {
            id: formattedVideoChannel.id,
            uuid: formattedVideoChannel.uuid,
            name: formattedVideoChannel.name,
            displayName: formattedVideoChannel.displayName,
            url: formattedVideoChannel.url,
            host: formattedVideoChannel.host,
            avatar: formattedVideoChannel.avatar
        },
        userHistory: userHistory ? {
            currentTime: userHistory.currentTime
        } : undefined
    };
    if (options) {
        if (options.additionalAttributes.state === true) {
            videoObject.state = {
                id: video.state,
                label: video_1.VideoModel.getStateLabel(video.state)
            };
        }
        if (options.additionalAttributes.waitTranscoding === true) {
            videoObject.waitTranscoding = video.waitTranscoding;
        }
        if (options.additionalAttributes.scheduledUpdate === true && video.ScheduleVideoUpdate) {
            videoObject.scheduledUpdate = {
                updateAt: video.ScheduleVideoUpdate.updateAt,
                privacy: video.ScheduleVideoUpdate.privacy || undefined
            };
        }
        if (options.additionalAttributes.blacklistInfo === true) {
            videoObject.blacklisted = !!video.VideoBlacklist;
            videoObject.blacklistedReason = video.VideoBlacklist ? video.VideoBlacklist.reason : null;
        }
    }
    return videoObject;
}
exports.videoModelToFormattedJSON = videoModelToFormattedJSON;
function videoModelToFormattedDetailsJSON(video) {
    const formattedJson = video.toFormattedJSON({
        additionalAttributes: {
            scheduledUpdate: true,
            blacklistInfo: true
        }
    });
    const tags = video.Tags ? video.Tags.map(t => t.name) : [];
    const detailsJson = {
        support: video.support,
        descriptionPath: video.getDescriptionAPIPath(),
        channel: video.VideoChannel.toFormattedJSON(),
        account: video.VideoChannel.Account.toFormattedJSON(),
        tags,
        commentsEnabled: video.commentsEnabled,
        waitTranscoding: video.waitTranscoding,
        state: {
            id: video.state,
            label: video_1.VideoModel.getStateLabel(video.state)
        },
        files: []
    };
    detailsJson.files = videoFilesModelToFormattedJSON(video, video.VideoFiles);
    return Object.assign(formattedJson, detailsJson);
}
exports.videoModelToFormattedDetailsJSON = videoModelToFormattedDetailsJSON;
function videoFilesModelToFormattedJSON(video, videoFiles) {
    const { baseUrlHttp, baseUrlWs } = video.getBaseUrls();
    return videoFiles
        .map(videoFile => {
        let resolutionLabel = videoFile.resolution + 'p';
        return {
            resolution: {
                id: videoFile.resolution,
                label: resolutionLabel
            },
            magnetUri: video.generateMagnetUri(videoFile, baseUrlHttp, baseUrlWs),
            size: videoFile.size,
            fps: videoFile.fps,
            torrentUrl: video.getTorrentUrl(videoFile, baseUrlHttp),
            torrentDownloadUrl: video.getTorrentDownloadUrl(videoFile, baseUrlHttp),
            fileUrl: video.getVideoFileUrl(videoFile, baseUrlHttp),
            fileDownloadUrl: video.getVideoFileDownloadUrl(videoFile, baseUrlHttp)
        };
    })
        .sort((a, b) => {
        if (a.resolution.id < b.resolution.id)
            return 1;
        if (a.resolution.id === b.resolution.id)
            return 0;
        return -1;
    });
}
exports.videoFilesModelToFormattedJSON = videoFilesModelToFormattedJSON;
function videoModelToActivityPubObject(video) {
    const { baseUrlHttp, baseUrlWs } = video.getBaseUrls();
    if (!video.Tags)
        video.Tags = [];
    const tag = video.Tags.map(t => ({
        type: 'Hashtag',
        name: t.name
    }));
    let language;
    if (video.language) {
        language = {
            identifier: video.language,
            name: video_1.VideoModel.getLanguageLabel(video.language)
        };
    }
    let category;
    if (video.category) {
        category = {
            identifier: video.category + '',
            name: video_1.VideoModel.getCategoryLabel(video.category)
        };
    }
    let licence;
    if (video.licence) {
        licence = {
            identifier: video.licence + '',
            name: video_1.VideoModel.getLicenceLabel(video.licence)
        };
    }
    const url = [];
    for (const file of video.VideoFiles) {
        url.push({
            type: 'Link',
            mimeType: initializers_1.VIDEO_EXT_MIMETYPE[file.extname],
            mediaType: initializers_1.VIDEO_EXT_MIMETYPE[file.extname],
            href: video.getVideoFileUrl(file, baseUrlHttp),
            height: file.resolution,
            size: file.size,
            fps: file.fps
        });
        url.push({
            type: 'Link',
            mimeType: 'application/x-bittorrent',
            mediaType: 'application/x-bittorrent',
            href: video.getTorrentUrl(file, baseUrlHttp),
            height: file.resolution
        });
        url.push({
            type: 'Link',
            mimeType: 'application/x-bittorrent;x-scheme-handler/magnet',
            mediaType: 'application/x-bittorrent;x-scheme-handler/magnet',
            href: video.generateMagnetUri(file, baseUrlHttp, baseUrlWs),
            height: file.resolution
        });
    }
    url.push({
        type: 'Link',
        mimeType: 'text/html',
        mediaType: 'text/html',
        href: initializers_1.CONFIG.WEBSERVER.URL + '/videos/watch/' + video.uuid
    });
    const subtitleLanguage = [];
    for (const caption of video.VideoCaptions) {
        subtitleLanguage.push({
            identifier: caption.language,
            name: video_caption_1.VideoCaptionModel.getLanguageLabel(caption.language)
        });
    }
    return {
        type: 'Video',
        id: video.url,
        name: video.name,
        duration: getActivityStreamDuration(video.duration),
        uuid: video.uuid,
        tag,
        category,
        licence,
        language,
        views: video.views,
        sensitive: video.nsfw,
        waitTranscoding: video.waitTranscoding,
        state: video.state,
        commentsEnabled: video.commentsEnabled,
        published: video.publishedAt.toISOString(),
        updated: video.updatedAt.toISOString(),
        mediaType: 'text/markdown',
        content: video.getTruncatedDescription(),
        support: video.support,
        subtitleLanguage,
        icon: {
            type: 'Image',
            url: video.getThumbnailUrl(baseUrlHttp),
            mediaType: 'image/jpeg',
            width: initializers_1.THUMBNAILS_SIZE.width,
            height: initializers_1.THUMBNAILS_SIZE.height
        },
        url,
        likes: activitypub_1.getVideoLikesActivityPubUrl(video),
        dislikes: activitypub_1.getVideoDislikesActivityPubUrl(video),
        shares: activitypub_1.getVideoSharesActivityPubUrl(video),
        comments: activitypub_1.getVideoCommentsActivityPubUrl(video),
        attributedTo: [
            {
                type: 'Person',
                id: video.VideoChannel.Account.Actor.url
            },
            {
                type: 'Group',
                id: video.VideoChannel.Actor.url
            }
        ]
    };
}
exports.videoModelToActivityPubObject = videoModelToActivityPubObject;
function getActivityStreamDuration(duration) {
    return 'PT' + duration + 'S';
}
exports.getActivityStreamDuration = getActivityStreamDuration;
