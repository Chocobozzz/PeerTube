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
const logger_1 = require("../../../helpers/logger");
const youtube_dl_1 = require("../../../helpers/youtube-dl");
const video_import_1 = require("../../../models/video/video-import");
const videos_1 = require("../../../../shared/models/videos");
const ffmpeg_utils_1 = require("../../../helpers/ffmpeg-utils");
const path_1 = require("path");
const video_file_1 = require("../../../models/video/video-file");
const initializers_1 = require("../../../initializers");
const requests_1 = require("../../../helpers/requests");
const shared_1 = require("../../../../shared");
const index_1 = require("../index");
const activitypub_1 = require("../../activitypub");
const video_1 = require("../../../models/video/video");
const webtorrent_1 = require("../../../helpers/webtorrent");
const utils_1 = require("../../../helpers/utils");
const fs_extra_1 = require("fs-extra");
function processVideoImport(job) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = job.data;
        if (payload.type === 'youtube-dl')
            return processYoutubeDLImport(job, payload);
        if (payload.type === 'magnet-uri' || payload.type === 'torrent-file')
            return processTorrentImport(job, payload);
    });
}
exports.processVideoImport = processVideoImport;
function processTorrentImport(job, payload) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Processing torrent video import in job %d.', job.id);
        const videoImport = yield getVideoImportOrDie(payload.videoImportId);
        const options = {
            videoImportId: payload.videoImportId,
            downloadThumbnail: false,
            downloadPreview: false,
            generateThumbnail: true,
            generatePreview: true
        };
        const target = {
            torrentName: videoImport.torrentName ? utils_1.getSecureTorrentName(videoImport.torrentName) : undefined,
            magnetUri: videoImport.magnetUri
        };
        return processFile(() => webtorrent_1.downloadWebTorrentVideo(target, initializers_1.VIDEO_IMPORT_TIMEOUT), videoImport, options);
    });
}
function processYoutubeDLImport(job, payload) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Processing youtubeDL video import in job %d.', job.id);
        const videoImport = yield getVideoImportOrDie(payload.videoImportId);
        const options = {
            videoImportId: videoImport.id,
            downloadThumbnail: payload.downloadThumbnail,
            downloadPreview: payload.downloadPreview,
            thumbnailUrl: payload.thumbnailUrl,
            generateThumbnail: false,
            generatePreview: false
        };
        return processFile(() => youtube_dl_1.downloadYoutubeDLVideo(videoImport.targetUrl, initializers_1.VIDEO_IMPORT_TIMEOUT), videoImport, options);
    });
}
function getVideoImportOrDie(videoImportId) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoImport = yield video_import_1.VideoImportModel.loadAndPopulateVideo(videoImportId);
        if (!videoImport || !videoImport.Video) {
            throw new Error('Cannot import video %s: the video import or video linked to this import does not exist anymore.');
        }
        return videoImport;
    });
}
function processFile(downloader, videoImport, options) {
    return __awaiter(this, void 0, void 0, function* () {
        let tempVideoPath;
        let videoDestFile;
        let videoFile;
        try {
            tempVideoPath = yield downloader();
            const stats = yield fs_extra_1.stat(tempVideoPath);
            const isAble = yield videoImport.User.isAbleToUploadVideo({ size: stats.size });
            if (isAble === false) {
                throw new Error('The user video quota is exceeded with this video to import.');
            }
            const { videoFileResolution } = yield ffmpeg_utils_1.getVideoFileResolution(tempVideoPath);
            const fps = yield ffmpeg_utils_1.getVideoFileFPS(tempVideoPath);
            const duration = yield ffmpeg_utils_1.getDurationFromVideoFile(tempVideoPath);
            const videoFileData = {
                extname: path_1.extname(tempVideoPath),
                resolution: videoFileResolution,
                size: stats.size,
                fps,
                videoId: videoImport.videoId
            };
            videoFile = new video_file_1.VideoFileModel(videoFileData);
            videoImport.Video.VideoFiles = [videoFile];
            videoDestFile = path_1.join(initializers_1.CONFIG.STORAGE.VIDEOS_DIR, videoImport.Video.getVideoFilename(videoFile));
            yield fs_extra_1.rename(tempVideoPath, videoDestFile);
            tempVideoPath = null;
            if (options.downloadThumbnail) {
                if (options.thumbnailUrl) {
                    const destThumbnailPath = path_1.join(initializers_1.CONFIG.STORAGE.THUMBNAILS_DIR, videoImport.Video.getThumbnailName());
                    yield requests_1.doRequestAndSaveToFile({ method: 'GET', uri: options.thumbnailUrl }, destThumbnailPath);
                }
                else {
                    yield videoImport.Video.createThumbnail(videoFile);
                }
            }
            else if (options.generateThumbnail) {
                yield videoImport.Video.createThumbnail(videoFile);
            }
            if (options.downloadPreview) {
                if (options.thumbnailUrl) {
                    const destPreviewPath = path_1.join(initializers_1.CONFIG.STORAGE.PREVIEWS_DIR, videoImport.Video.getPreviewName());
                    yield requests_1.doRequestAndSaveToFile({ method: 'GET', uri: options.thumbnailUrl }, destPreviewPath);
                }
                else {
                    yield videoImport.Video.createPreview(videoFile);
                }
            }
            else if (options.generatePreview) {
                yield videoImport.Video.createPreview(videoFile);
            }
            yield videoImport.Video.createTorrentAndSetInfoHash(videoFile);
            const videoImportUpdated = yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
                const video = yield video_1.VideoModel.load(videoImport.videoId, t);
                if (!video)
                    throw new Error('Video linked to import ' + videoImport.videoId + ' does not exist anymore.');
                videoImport.Video = video;
                const videoFileCreated = yield videoFile.save({ transaction: t });
                video.VideoFiles = [videoFileCreated];
                video.duration = duration;
                video.state = initializers_1.CONFIG.TRANSCODING.ENABLED ? shared_1.VideoState.TO_TRANSCODE : shared_1.VideoState.PUBLISHED;
                const videoUpdated = yield video.save({ transaction: t });
                const videoForFederation = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(video.uuid, t);
                yield activitypub_1.federateVideoIfNeeded(videoForFederation, true, t);
                videoImport.state = videos_1.VideoImportState.SUCCESS;
                const videoImportUpdated = yield videoImport.save({ transaction: t });
                logger_1.logger.info('Video %s imported.', video.uuid);
                videoImportUpdated.Video = videoUpdated;
                return videoImportUpdated;
            }));
            if (videoImportUpdated.Video.state === shared_1.VideoState.TO_TRANSCODE) {
                const dataInput = {
                    videoUUID: videoImportUpdated.Video.uuid,
                    isNewVideo: true
                };
                yield index_1.JobQueue.Instance.createJob({ type: 'video-file', payload: dataInput });
            }
        }
        catch (err) {
            try {
                if (tempVideoPath)
                    yield fs_extra_1.remove(tempVideoPath);
            }
            catch (errUnlink) {
                logger_1.logger.warn('Cannot cleanup files after a video import error.', { err: errUnlink });
            }
            videoImport.error = err.message;
            videoImport.state = videos_1.VideoImportState.FAILED;
            yield videoImport.save();
            throw err;
        }
    });
}
