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
const express = require("express");
const path_1 = require("path");
const shared_1 = require("../../../../shared");
const ffmpeg_utils_1 = require("../../../helpers/ffmpeg-utils");
const image_utils_1 = require("../../../helpers/image-utils");
const logger_1 = require("../../../helpers/logger");
const audit_logger_1 = require("../../../helpers/audit-logger");
const utils_1 = require("../../../helpers/utils");
const initializers_1 = require("../../../initializers");
const activitypub_1 = require("../../../lib/activitypub");
const send_1 = require("../../../lib/activitypub/send");
const job_queue_1 = require("../../../lib/job-queue");
const redis_1 = require("../../../lib/redis");
const middlewares_1 = require("../../../middlewares");
const tag_1 = require("../../../models/video/tag");
const video_1 = require("../../../models/video/video");
const video_file_1 = require("../../../models/video/video-file");
const abuse_1 = require("./abuse");
const blacklist_1 = require("./blacklist");
const comment_1 = require("./comment");
const rate_1 = require("./rate");
const ownership_1 = require("./ownership");
const express_utils_1 = require("../../../helpers/express-utils");
const schedule_video_update_1 = require("../../../models/video/schedule-video-update");
const captions_1 = require("./captions");
const import_1 = require("./import");
const database_utils_1 = require("../../../helpers/database-utils");
const fs_extra_1 = require("fs-extra");
const watching_1 = require("./watching");
const auditLogger = audit_logger_1.auditLoggerFactory('videos');
const videosRouter = express.Router();
exports.videosRouter = videosRouter;
const reqVideoFileAdd = express_utils_1.createReqFiles(['videofile', 'thumbnailfile', 'previewfile'], Object.assign({}, initializers_1.VIDEO_MIMETYPE_EXT, initializers_1.IMAGE_MIMETYPE_EXT), {
    videofile: initializers_1.CONFIG.STORAGE.VIDEOS_DIR,
    thumbnailfile: initializers_1.CONFIG.STORAGE.THUMBNAILS_DIR,
    previewfile: initializers_1.CONFIG.STORAGE.PREVIEWS_DIR
});
const reqVideoFileUpdate = express_utils_1.createReqFiles(['thumbnailfile', 'previewfile'], initializers_1.IMAGE_MIMETYPE_EXT, {
    thumbnailfile: initializers_1.CONFIG.STORAGE.THUMBNAILS_DIR,
    previewfile: initializers_1.CONFIG.STORAGE.PREVIEWS_DIR
});
videosRouter.use('/', abuse_1.abuseVideoRouter);
videosRouter.use('/', blacklist_1.blacklistRouter);
videosRouter.use('/', rate_1.rateVideoRouter);
videosRouter.use('/', comment_1.videoCommentRouter);
videosRouter.use('/', captions_1.videoCaptionsRouter);
videosRouter.use('/', import_1.videoImportsRouter);
videosRouter.use('/', ownership_1.ownershipVideoRouter);
videosRouter.use('/', watching_1.watchingRouter);
videosRouter.get('/categories', listVideoCategories);
videosRouter.get('/licences', listVideoLicences);
videosRouter.get('/languages', listVideoLanguages);
videosRouter.get('/privacies', listVideoPrivacies);
videosRouter.get('/', middlewares_1.paginationValidator, middlewares_1.videosSortValidator, middlewares_1.setDefaultSort, middlewares_1.setDefaultPagination, middlewares_1.optionalAuthenticate, middlewares_1.commonVideosFiltersValidator, middlewares_1.asyncMiddleware(listVideos));
videosRouter.put('/:id', middlewares_1.authenticate, reqVideoFileUpdate, middlewares_1.asyncMiddleware(middlewares_1.videosUpdateValidator), middlewares_1.asyncRetryTransactionMiddleware(updateVideo));
videosRouter.post('/upload', middlewares_1.authenticate, reqVideoFileAdd, middlewares_1.asyncMiddleware(middlewares_1.videosAddValidator), middlewares_1.asyncRetryTransactionMiddleware(addVideo));
videosRouter.get('/:id/description', middlewares_1.asyncMiddleware(middlewares_1.videosGetValidator), middlewares_1.asyncMiddleware(getVideoDescription));
videosRouter.get('/:id', middlewares_1.optionalAuthenticate, middlewares_1.asyncMiddleware(middlewares_1.videosGetValidator), getVideo);
videosRouter.post('/:id/views', middlewares_1.asyncMiddleware(middlewares_1.videosGetValidator), middlewares_1.asyncMiddleware(viewVideo));
videosRouter.delete('/:id', middlewares_1.authenticate, middlewares_1.asyncMiddleware(middlewares_1.videosRemoveValidator), middlewares_1.asyncRetryTransactionMiddleware(removeVideo));
function listVideoCategories(req, res) {
    res.json(initializers_1.VIDEO_CATEGORIES);
}
function listVideoLicences(req, res) {
    res.json(initializers_1.VIDEO_LICENCES);
}
function listVideoLanguages(req, res) {
    res.json(initializers_1.VIDEO_LANGUAGES);
}
function listVideoPrivacies(req, res) {
    res.json(initializers_1.VIDEO_PRIVACIES);
}
function addVideo(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        req.setTimeout(1000 * 60 * 10, () => {
            logger_1.logger.error('Upload video has timed out.');
            return res.sendStatus(408);
        });
        const videoPhysicalFile = req.files['videofile'][0];
        const videoInfo = req.body;
        const videoData = {
            name: videoInfo.name,
            remote: false,
            category: videoInfo.category,
            licence: videoInfo.licence,
            language: videoInfo.language,
            commentsEnabled: videoInfo.commentsEnabled || false,
            waitTranscoding: videoInfo.waitTranscoding || false,
            state: initializers_1.CONFIG.TRANSCODING.ENABLED ? shared_1.VideoState.TO_TRANSCODE : shared_1.VideoState.PUBLISHED,
            nsfw: videoInfo.nsfw || false,
            description: videoInfo.description,
            support: videoInfo.support,
            privacy: videoInfo.privacy,
            duration: videoPhysicalFile['duration'],
            channelId: res.locals.videoChannel.id
        };
        const video = new video_1.VideoModel(videoData);
        video.url = activitypub_1.getVideoActivityPubUrl(video);
        const { videoFileResolution } = yield ffmpeg_utils_1.getVideoFileResolution(videoPhysicalFile.path);
        const fps = yield ffmpeg_utils_1.getVideoFileFPS(videoPhysicalFile.path);
        const videoFileData = {
            extname: path_1.extname(videoPhysicalFile.filename),
            resolution: videoFileResolution,
            size: videoPhysicalFile.size,
            fps
        };
        const videoFile = new video_file_1.VideoFileModel(videoFileData);
        const videoDir = initializers_1.CONFIG.STORAGE.VIDEOS_DIR;
        const destination = path_1.join(videoDir, video.getVideoFilename(videoFile));
        yield fs_extra_1.rename(videoPhysicalFile.path, destination);
        videoPhysicalFile.filename = video.getVideoFilename(videoFile);
        videoPhysicalFile.path = destination;
        const thumbnailField = req.files['thumbnailfile'];
        if (thumbnailField) {
            const thumbnailPhysicalFile = thumbnailField[0];
            yield image_utils_1.processImage(thumbnailPhysicalFile, path_1.join(initializers_1.CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName()), initializers_1.THUMBNAILS_SIZE);
        }
        else {
            yield video.createThumbnail(videoFile);
        }
        const previewField = req.files['previewfile'];
        if (previewField) {
            const previewPhysicalFile = previewField[0];
            yield image_utils_1.processImage(previewPhysicalFile, path_1.join(initializers_1.CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName()), initializers_1.PREVIEWS_SIZE);
        }
        else {
            yield video.createPreview(videoFile);
        }
        yield video.createTorrentAndSetInfoHash(videoFile);
        const videoCreated = yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const sequelizeOptions = { transaction: t };
            const videoCreated = yield video.save(sequelizeOptions);
            videoCreated.VideoChannel = res.locals.videoChannel;
            videoFile.videoId = video.id;
            yield videoFile.save(sequelizeOptions);
            video.VideoFiles = [videoFile];
            if (videoInfo.tags !== undefined) {
                const tagInstances = yield tag_1.TagModel.findOrCreateTags(videoInfo.tags, t);
                yield video.$set('Tags', tagInstances, sequelizeOptions);
                video.Tags = tagInstances;
            }
            if (videoInfo.scheduleUpdate) {
                yield schedule_video_update_1.ScheduleVideoUpdateModel.create({
                    videoId: video.id,
                    updateAt: videoInfo.scheduleUpdate.updateAt,
                    privacy: videoInfo.scheduleUpdate.privacy || null
                }, { transaction: t });
            }
            yield activitypub_1.federateVideoIfNeeded(video, true, t);
            auditLogger.create(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.VideoAuditView(videoCreated.toFormattedDetailsJSON()));
            logger_1.logger.info('Video with name %s and uuid %s created.', videoInfo.name, videoCreated.uuid);
            return videoCreated;
        }));
        if (video.state === shared_1.VideoState.TO_TRANSCODE) {
            const dataInput = {
                videoUUID: videoCreated.uuid,
                isNewVideo: true
            };
            yield job_queue_1.JobQueue.Instance.createJob({ type: 'video-file', payload: dataInput });
        }
        return res.json({
            video: {
                id: videoCreated.id,
                uuid: videoCreated.uuid
            }
        }).end();
    });
}
function updateVideo(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoInstance = res.locals.video;
        const videoFieldsSave = videoInstance.toJSON();
        const oldVideoAuditView = new audit_logger_1.VideoAuditView(videoInstance.toFormattedDetailsJSON());
        const videoInfoToUpdate = req.body;
        const wasPrivateVideo = videoInstance.privacy === shared_1.VideoPrivacy.PRIVATE;
        if (req.files && req.files['thumbnailfile']) {
            const thumbnailPhysicalFile = req.files['thumbnailfile'][0];
            yield image_utils_1.processImage(thumbnailPhysicalFile, path_1.join(initializers_1.CONFIG.STORAGE.THUMBNAILS_DIR, videoInstance.getThumbnailName()), initializers_1.THUMBNAILS_SIZE);
        }
        if (req.files && req.files['previewfile']) {
            const previewPhysicalFile = req.files['previewfile'][0];
            yield image_utils_1.processImage(previewPhysicalFile, path_1.join(initializers_1.CONFIG.STORAGE.PREVIEWS_DIR, videoInstance.getPreviewName()), initializers_1.PREVIEWS_SIZE);
        }
        try {
            yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
                const sequelizeOptions = {
                    transaction: t
                };
                const oldVideoChannel = videoInstance.VideoChannel;
                if (videoInfoToUpdate.name !== undefined)
                    videoInstance.set('name', videoInfoToUpdate.name);
                if (videoInfoToUpdate.category !== undefined)
                    videoInstance.set('category', videoInfoToUpdate.category);
                if (videoInfoToUpdate.licence !== undefined)
                    videoInstance.set('licence', videoInfoToUpdate.licence);
                if (videoInfoToUpdate.language !== undefined)
                    videoInstance.set('language', videoInfoToUpdate.language);
                if (videoInfoToUpdate.nsfw !== undefined)
                    videoInstance.set('nsfw', videoInfoToUpdate.nsfw);
                if (videoInfoToUpdate.waitTranscoding !== undefined)
                    videoInstance.set('waitTranscoding', videoInfoToUpdate.waitTranscoding);
                if (videoInfoToUpdate.support !== undefined)
                    videoInstance.set('support', videoInfoToUpdate.support);
                if (videoInfoToUpdate.description !== undefined)
                    videoInstance.set('description', videoInfoToUpdate.description);
                if (videoInfoToUpdate.commentsEnabled !== undefined)
                    videoInstance.set('commentsEnabled', videoInfoToUpdate.commentsEnabled);
                if (videoInfoToUpdate.privacy !== undefined) {
                    const newPrivacy = parseInt(videoInfoToUpdate.privacy.toString(), 10);
                    videoInstance.set('privacy', newPrivacy);
                    if (wasPrivateVideo === true && newPrivacy !== shared_1.VideoPrivacy.PRIVATE) {
                        videoInstance.set('publishedAt', new Date());
                    }
                }
                const videoInstanceUpdated = yield videoInstance.save(sequelizeOptions);
                if (videoInfoToUpdate.tags !== undefined) {
                    const tagInstances = yield tag_1.TagModel.findOrCreateTags(videoInfoToUpdate.tags, t);
                    yield videoInstanceUpdated.$set('Tags', tagInstances, sequelizeOptions);
                    videoInstanceUpdated.Tags = tagInstances;
                }
                if (res.locals.videoChannel && videoInstanceUpdated.channelId !== res.locals.videoChannel.id) {
                    yield videoInstanceUpdated.$set('VideoChannel', res.locals.videoChannel, { transaction: t });
                    videoInstanceUpdated.VideoChannel = res.locals.videoChannel;
                    if (wasPrivateVideo === false)
                        yield activitypub_1.changeVideoChannelShare(videoInstanceUpdated, oldVideoChannel, t);
                }
                if (videoInfoToUpdate.scheduleUpdate) {
                    yield schedule_video_update_1.ScheduleVideoUpdateModel.upsert({
                        videoId: videoInstanceUpdated.id,
                        updateAt: videoInfoToUpdate.scheduleUpdate.updateAt,
                        privacy: videoInfoToUpdate.scheduleUpdate.privacy || null
                    }, { transaction: t });
                }
                else if (videoInfoToUpdate.scheduleUpdate === null) {
                    yield schedule_video_update_1.ScheduleVideoUpdateModel.deleteByVideoId(videoInstanceUpdated.id, t);
                }
                const isNewVideo = wasPrivateVideo && videoInstanceUpdated.privacy !== shared_1.VideoPrivacy.PRIVATE;
                yield activitypub_1.federateVideoIfNeeded(videoInstanceUpdated, isNewVideo, t);
                auditLogger.update(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.VideoAuditView(videoInstanceUpdated.toFormattedDetailsJSON()), oldVideoAuditView);
                logger_1.logger.info('Video with name %s and uuid %s updated.', videoInstance.name, videoInstance.uuid);
            }));
        }
        catch (err) {
            database_utils_1.resetSequelizeInstance(videoInstance, videoFieldsSave);
            throw err;
        }
        return res.type('json').status(204).end();
    });
}
function getVideo(req, res) {
    const videoInstance = res.locals.video;
    return res.json(videoInstance.toFormattedDetailsJSON());
}
function viewVideo(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoInstance = res.locals.video;
        const ip = req.ip;
        const exists = yield redis_1.Redis.Instance.isVideoIPViewExists(ip, videoInstance.uuid);
        if (exists) {
            logger_1.logger.debug('View for ip %s and video %s already exists.', ip, videoInstance.uuid);
            return res.status(204).end();
        }
        yield Promise.all([
            redis_1.Redis.Instance.addVideoView(videoInstance.id),
            redis_1.Redis.Instance.setIPVideoView(ip, videoInstance.uuid)
        ]);
        const serverActor = yield utils_1.getServerActor();
        yield send_1.sendCreateView(serverActor, videoInstance, undefined);
        return res.status(204).end();
    });
}
function getVideoDescription(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoInstance = res.locals.video;
        let description = '';
        if (videoInstance.isOwned()) {
            description = videoInstance.description;
        }
        else {
            description = yield activitypub_1.fetchRemoteVideoDescription(videoInstance);
        }
        return res.json({ description });
    });
}
function listVideos(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const resultList = yield video_1.VideoModel.listForApi({
            start: req.query.start,
            count: req.query.count,
            sort: req.query.sort,
            includeLocalVideos: true,
            categoryOneOf: req.query.categoryOneOf,
            licenceOneOf: req.query.licenceOneOf,
            languageOneOf: req.query.languageOneOf,
            tagsOneOf: req.query.tagsOneOf,
            tagsAllOf: req.query.tagsAllOf,
            nsfw: express_utils_1.buildNSFWFilter(res, req.query.nsfw),
            filter: req.query.filter,
            withFiles: false,
            user: res.locals.oauth ? res.locals.oauth.token.User : undefined
        });
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function removeVideo(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoInstance = res.locals.video;
        yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            yield videoInstance.destroy({ transaction: t });
        }));
        auditLogger.delete(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.VideoAuditView(videoInstance.toFormattedDetailsJSON()));
        logger_1.logger.info('Video with name %s and uuid %s deleted.', videoInstance.name, videoInstance.uuid);
        return res.type('json').status(204).end();
    });
}
