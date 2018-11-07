"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Bluebird = require("bluebird");
const magnetUtil = require("magnet-uri");
const path_1 = require("path");
const request = require("request");
const index_1 = require("../../../shared/index");
const videos_1 = require("../../../shared/models/videos");
const videos_2 = require("../../helpers/custom-validators/activitypub/videos");
const videos_3 = require("../../helpers/custom-validators/videos");
const database_utils_1 = require("../../helpers/database-utils");
const logger_1 = require("../../helpers/logger");
const requests_1 = require("../../helpers/requests");
const initializers_1 = require("../../initializers");
const tag_1 = require("../../models/video/tag");
const video_1 = require("../../models/video/video");
const video_file_1 = require("../../models/video/video-file");
const actor_1 = require("./actor");
const video_comments_1 = require("./video-comments");
const crawl_1 = require("./crawl");
const send_1 = require("./send");
const misc_1 = require("../../helpers/custom-validators/misc");
const video_caption_1 = require("../../models/video/video-caption");
const job_queue_1 = require("../job-queue");
const video_rates_1 = require("./video-rates");
const share_1 = require("./share");
const account_1 = require("../../models/account/account");
const video_2 = require("../../helpers/video");
function federateVideoIfNeeded(video, isNewVideo, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        if (video.privacy !== videos_1.VideoPrivacy.PRIVATE && video.state === index_1.VideoState.PUBLISHED) {
            if (misc_1.isArray(video.VideoCaptions) === false) {
                video.VideoCaptions = (yield video.$get('VideoCaptions', {
                    attributes: ['language'],
                    transaction
                }));
            }
            if (isNewVideo) {
                yield send_1.sendCreateVideo(video, transaction);
                yield share_1.shareVideoByServerAndChannel(video, transaction);
            }
            else {
                yield send_1.sendUpdateVideo(video, transaction);
            }
        }
    });
}
exports.federateVideoIfNeeded = federateVideoIfNeeded;
function fetchRemoteVideo(videoUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = {
            uri: videoUrl,
            method: 'GET',
            json: true,
            activityPub: true
        };
        logger_1.logger.info('Fetching remote video %s.', videoUrl);
        const { response, body } = yield requests_1.doRequest(options);
        if (videos_2.sanitizeAndCheckVideoTorrentObject(body) === false) {
            logger_1.logger.debug('Remote video JSON is not valid.', { body });
            return { response, videoObject: undefined };
        }
        return { response, videoObject: body };
    });
}
exports.fetchRemoteVideo = fetchRemoteVideo;
function fetchRemoteVideoDescription(video) {
    return __awaiter(this, void 0, void 0, function* () {
        const host = video.VideoChannel.Account.Actor.Server.host;
        const path = video.getDescriptionAPIPath();
        const options = {
            uri: initializers_1.REMOTE_SCHEME.HTTP + '://' + host + path,
            json: true
        };
        const { body } = yield requests_1.doRequest(options);
        return body.description ? body.description : '';
    });
}
exports.fetchRemoteVideoDescription = fetchRemoteVideoDescription;
function fetchRemoteVideoStaticFile(video, path, reject) {
    const host = video.VideoChannel.Account.Actor.Server.host;
    return request.get(initializers_1.REMOTE_SCHEME.HTTP + '://' + host + path, err => {
        if (err)
            reject(err);
    });
}
exports.fetchRemoteVideoStaticFile = fetchRemoteVideoStaticFile;
function generateThumbnailFromUrl(video, icon) {
    const thumbnailName = video.getThumbnailName();
    const thumbnailPath = path_1.join(initializers_1.CONFIG.STORAGE.THUMBNAILS_DIR, thumbnailName);
    const options = {
        method: 'GET',
        uri: icon.url
    };
    return requests_1.doRequestAndSaveToFile(options, thumbnailPath);
}
exports.generateThumbnailFromUrl = generateThumbnailFromUrl;
function getOrCreateVideoChannelFromVideoObject(videoObject) {
    const channel = videoObject.attributedTo.find(a => a.type === 'Group');
    if (!channel)
        throw new Error('Cannot find associated video channel to video ' + videoObject.url);
    return actor_1.getOrCreateActorAndServerAndModel(channel.id, 'all');
}
exports.getOrCreateVideoChannelFromVideoObject = getOrCreateVideoChannelFromVideoObject;
function syncVideoExternalAttributes(video, fetchedVideo, syncParam) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Adding likes/dislikes/shares/comments of video %s.', video.uuid);
        const jobPayloads = [];
        if (syncParam.likes === true) {
            yield crawl_1.crawlCollectionPage(fetchedVideo.likes, items => video_rates_1.createRates(items, video, 'like'))
                .catch(err => logger_1.logger.error('Cannot add likes of video %s.', video.uuid, { err }));
        }
        else {
            jobPayloads.push({ uri: fetchedVideo.likes, videoId: video.id, type: 'video-likes' });
        }
        if (syncParam.dislikes === true) {
            yield crawl_1.crawlCollectionPage(fetchedVideo.dislikes, items => video_rates_1.createRates(items, video, 'dislike'))
                .catch(err => logger_1.logger.error('Cannot add dislikes of video %s.', video.uuid, { err }));
        }
        else {
            jobPayloads.push({ uri: fetchedVideo.dislikes, videoId: video.id, type: 'video-dislikes' });
        }
        if (syncParam.shares === true) {
            yield crawl_1.crawlCollectionPage(fetchedVideo.shares, items => share_1.addVideoShares(items, video))
                .catch(err => logger_1.logger.error('Cannot add shares of video %s.', video.uuid, { err }));
        }
        else {
            jobPayloads.push({ uri: fetchedVideo.shares, videoId: video.id, type: 'video-shares' });
        }
        if (syncParam.comments === true) {
            yield crawl_1.crawlCollectionPage(fetchedVideo.comments, items => video_comments_1.addVideoComments(items, video))
                .catch(err => logger_1.logger.error('Cannot add comments of video %s.', video.uuid, { err }));
        }
        else {
            jobPayloads.push({ uri: fetchedVideo.shares, videoId: video.id, type: 'video-shares' });
        }
        yield Bluebird.map(jobPayloads, payload => job_queue_1.JobQueue.Instance.createJob({ type: 'activitypub-http-fetcher', payload }));
    });
}
function getOrCreateVideoAndAccountAndChannel(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const syncParam = options.syncParam || { likes: true, dislikes: true, shares: true, comments: true, thumbnail: true, refreshVideo: false };
        const fetchType = options.fetchType || 'all';
        const refreshViews = options.refreshViews || false;
        const videoUrl = typeof options.videoObject === 'string' ? options.videoObject : options.videoObject.id;
        let videoFromDatabase = yield video_2.fetchVideoByUrl(videoUrl, fetchType);
        if (videoFromDatabase) {
            const refreshOptions = {
                video: videoFromDatabase,
                fetchedType: fetchType,
                syncParam,
                refreshViews
            };
            const p = refreshVideoIfNeeded(refreshOptions);
            if (syncParam.refreshVideo === true)
                videoFromDatabase = yield p;
            return { video: videoFromDatabase };
        }
        const { videoObject: fetchedVideo } = yield fetchRemoteVideo(videoUrl);
        if (!fetchedVideo)
            throw new Error('Cannot fetch remote video with url: ' + videoUrl);
        const channelActor = yield getOrCreateVideoChannelFromVideoObject(fetchedVideo);
        const video = yield database_utils_1.retryTransactionWrapper(createVideo, fetchedVideo, channelActor, syncParam.thumbnail);
        yield syncVideoExternalAttributes(video, fetchedVideo, syncParam);
        return { video };
    });
}
exports.getOrCreateVideoAndAccountAndChannel = getOrCreateVideoAndAccountAndChannel;
function updateVideoFromAP(options) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Updating remote video "%s".', options.videoObject.uuid);
        let videoFieldsSave;
        try {
            yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
                const sequelizeOptions = {
                    transaction: t
                };
                videoFieldsSave = options.video.toJSON();
                const videoChannel = options.video.VideoChannel;
                if (videoChannel.Account.id !== options.account.id) {
                    throw new Error('Account ' + options.account.Actor.url + ' does not own video channel ' + videoChannel.Actor.url);
                }
                const to = options.overrideTo ? options.overrideTo : options.videoObject.to;
                const videoData = yield videoActivityObjectToDBAttributes(options.channel, options.videoObject, to);
                options.video.set('name', videoData.name);
                options.video.set('uuid', videoData.uuid);
                options.video.set('url', videoData.url);
                options.video.set('category', videoData.category);
                options.video.set('licence', videoData.licence);
                options.video.set('language', videoData.language);
                options.video.set('description', videoData.description);
                options.video.set('support', videoData.support);
                options.video.set('nsfw', videoData.nsfw);
                options.video.set('commentsEnabled', videoData.commentsEnabled);
                options.video.set('waitTranscoding', videoData.waitTranscoding);
                options.video.set('state', videoData.state);
                options.video.set('duration', videoData.duration);
                options.video.set('createdAt', videoData.createdAt);
                options.video.set('publishedAt', videoData.publishedAt);
                options.video.set('privacy', videoData.privacy);
                options.video.set('channelId', videoData.channelId);
                if (options.updateViews === true)
                    options.video.set('views', videoData.views);
                yield options.video.save(sequelizeOptions);
                generateThumbnailFromUrl(options.video, options.videoObject.icon)
                    .catch(err => logger_1.logger.warn('Cannot generate thumbnail of %s.', options.videoObject.id, { err }));
                {
                    const videoFileAttributes = videoFileActivityUrlToDBAttributes(options.video, options.videoObject);
                    const newVideoFiles = videoFileAttributes.map(a => new video_file_1.VideoFileModel(a));
                    const destroyTasks = options.video.VideoFiles
                        .filter(f => !newVideoFiles.find(newFile => newFile.hasSameUniqueKeysThan(f)))
                        .map(f => f.destroy(sequelizeOptions));
                    yield Promise.all(destroyTasks);
                    const upsertTasks = videoFileAttributes.map(a => {
                        return video_file_1.VideoFileModel.upsert(a, { returning: true, transaction: t })
                            .then(([file]) => file);
                    });
                    options.video.VideoFiles = yield Promise.all(upsertTasks);
                }
                {
                    const tags = options.videoObject.tag.map(tag => tag.name);
                    const tagInstances = yield tag_1.TagModel.findOrCreateTags(tags, t);
                    yield options.video.$set('Tags', tagInstances, sequelizeOptions);
                }
                {
                    yield video_caption_1.VideoCaptionModel.deleteAllCaptionsOfRemoteVideo(options.video.id, t);
                    const videoCaptionsPromises = options.videoObject.subtitleLanguage.map(c => {
                        return video_caption_1.VideoCaptionModel.insertOrReplaceLanguage(options.video.id, c.identifier, t);
                    });
                    options.video.VideoCaptions = yield Promise.all(videoCaptionsPromises);
                }
            }));
            logger_1.logger.info('Remote video with uuid %s updated', options.videoObject.uuid);
        }
        catch (err) {
            if (options.video !== undefined && videoFieldsSave !== undefined) {
                database_utils_1.resetSequelizeInstance(options.video, videoFieldsSave);
            }
            logger_1.logger.debug('Cannot update the remote video.', { err });
            throw err;
        }
    });
}
exports.updateVideoFromAP = updateVideoFromAP;
function isActivityVideoUrlObject(url) {
    const mimeTypes = Object.keys(initializers_1.VIDEO_MIMETYPE_EXT);
    const urlMediaType = url.mediaType || url.mimeType;
    return mimeTypes.indexOf(urlMediaType) !== -1 && urlMediaType.startsWith('video/');
}
function createVideo(videoObject, channelActor, waitThumbnail = false) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Adding remote video %s.', videoObject.id);
        const videoCreated = yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const sequelizeOptions = { transaction: t };
            const videoData = yield videoActivityObjectToDBAttributes(channelActor.VideoChannel, videoObject, videoObject.to);
            const video = video_1.VideoModel.build(videoData);
            const videoCreated = yield video.save(sequelizeOptions);
            const videoFileAttributes = videoFileActivityUrlToDBAttributes(videoCreated, videoObject);
            if (videoFileAttributes.length === 0) {
                throw new Error('Cannot find valid files for video %s ' + videoObject.url);
            }
            const videoFilePromises = videoFileAttributes.map(f => video_file_1.VideoFileModel.create(f, { transaction: t }));
            yield Promise.all(videoFilePromises);
            const tags = videoObject.tag.map(t => t.name);
            const tagInstances = yield tag_1.TagModel.findOrCreateTags(tags, t);
            yield videoCreated.$set('Tags', tagInstances, sequelizeOptions);
            const videoCaptionsPromises = videoObject.subtitleLanguage.map(c => {
                return video_caption_1.VideoCaptionModel.insertOrReplaceLanguage(videoCreated.id, c.identifier, t);
            });
            yield Promise.all(videoCaptionsPromises);
            logger_1.logger.info('Remote video with uuid %s inserted.', videoObject.uuid);
            videoCreated.VideoChannel = channelActor.VideoChannel;
            return videoCreated;
        }));
        const p = generateThumbnailFromUrl(videoCreated, videoObject.icon)
            .catch(err => logger_1.logger.warn('Cannot generate thumbnail of %s.', videoObject.id, { err }));
        if (waitThumbnail === true)
            yield p;
        return videoCreated;
    });
}
function refreshVideoIfNeeded(options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!options.video.isOutdated())
            return options.video;
        const video = options.fetchedType === 'all' ? options.video : yield video_1.VideoModel.loadByUrlAndPopulateAccount(options.video.url);
        try {
            const { response, videoObject } = yield fetchRemoteVideo(video.url);
            if (response.statusCode === 404) {
                logger_1.logger.info('Cannot refresh remote video %s: video does not exist anymore. Deleting it.', video.url);
                yield video.destroy();
                return undefined;
            }
            if (videoObject === undefined) {
                logger_1.logger.warn('Cannot refresh remote video %s: invalid body.', video.url);
                return video;
            }
            const channelActor = yield getOrCreateVideoChannelFromVideoObject(videoObject);
            const account = yield account_1.AccountModel.load(channelActor.VideoChannel.accountId);
            const updateOptions = {
                video,
                videoObject,
                account,
                channel: channelActor.VideoChannel,
                updateViews: options.refreshViews
            };
            yield database_utils_1.retryTransactionWrapper(updateVideoFromAP, updateOptions);
            yield syncVideoExternalAttributes(video, videoObject, options.syncParam);
            return video;
        }
        catch (err) {
            logger_1.logger.warn('Cannot refresh video %s.', options.video.url, { err });
            return video;
        }
    });
}
function videoActivityObjectToDBAttributes(videoChannel, videoObject, to = []) {
    return __awaiter(this, void 0, void 0, function* () {
        const privacy = to.indexOf(initializers_1.ACTIVITY_PUB.PUBLIC) !== -1 ? videos_1.VideoPrivacy.PUBLIC : videos_1.VideoPrivacy.UNLISTED;
        const duration = videoObject.duration.replace(/[^\d]+/, '');
        let language;
        if (videoObject.language) {
            language = videoObject.language.identifier;
        }
        let category;
        if (videoObject.category) {
            category = parseInt(videoObject.category.identifier, 10);
        }
        let licence;
        if (videoObject.licence) {
            licence = parseInt(videoObject.licence.identifier, 10);
        }
        const description = videoObject.content || null;
        const support = videoObject.support || null;
        return {
            name: videoObject.name,
            uuid: videoObject.uuid,
            url: videoObject.id,
            category,
            licence,
            language,
            description,
            support,
            nsfw: videoObject.sensitive,
            commentsEnabled: videoObject.commentsEnabled,
            waitTranscoding: videoObject.waitTranscoding,
            state: videoObject.state,
            channelId: videoChannel.id,
            duration: parseInt(duration, 10),
            createdAt: new Date(videoObject.published),
            publishedAt: new Date(videoObject.published),
            updatedAt: new Date(videoObject.updated),
            views: videoObject.views,
            likes: 0,
            dislikes: 0,
            remote: true,
            privacy
        };
    });
}
function videoFileActivityUrlToDBAttributes(video, videoObject) {
    const fileUrls = videoObject.url.filter(u => isActivityVideoUrlObject(u));
    if (fileUrls.length === 0) {
        throw new Error('Cannot find video files for ' + video.url);
    }
    const attributes = [];
    for (const fileUrl of fileUrls) {
        const magnet = videoObject.url.find(u => {
            const mediaType = u.mediaType || u.mimeType;
            return mediaType === 'application/x-bittorrent;x-scheme-handler/magnet' && u.height === fileUrl.height;
        });
        if (!magnet)
            throw new Error('Cannot find associated magnet uri for file ' + fileUrl.href);
        const parsed = magnetUtil.decode(magnet.href);
        if (!parsed || videos_3.isVideoFileInfoHashValid(parsed.infoHash) === false) {
            throw new Error('Cannot parse magnet URI ' + magnet.href);
        }
        const mediaType = fileUrl.mediaType || fileUrl.mimeType;
        const attribute = {
            extname: initializers_1.VIDEO_MIMETYPE_EXT[mediaType],
            infoHash: parsed.infoHash,
            resolution: fileUrl.height,
            size: fileUrl.size,
            videoId: video.id,
            fps: fileUrl.fps || -1
        };
        attributes.push(attribute);
    }
    return attributes;
}
