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
const shared_1 = require("../../../../shared");
const logger_1 = require("../../../helpers/logger");
const video_1 = require("../../../models/video/video");
const job_queue_1 = require("../job-queue");
const activitypub_1 = require("../../activitypub");
const database_utils_1 = require("../../../helpers/database-utils");
const initializers_1 = require("../../../initializers");
const ffmpeg_utils_1 = require("../../../helpers/ffmpeg-utils");
const video_transcoding_1 = require("../../video-transcoding");
function processVideoFileImport(job) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = job.data;
        logger_1.logger.info('Processing video file import in job %d.', job.id);
        const video = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoUUID);
        if (!video) {
            logger_1.logger.info('Do not process job %d, video does not exist.', job.id);
            return undefined;
        }
        yield video_transcoding_1.importVideoFile(video, payload.filePath);
        yield onVideoFileTranscoderOrImportSuccess(video);
        return video;
    });
}
exports.processVideoFileImport = processVideoFileImport;
function processVideoFile(job) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = job.data;
        logger_1.logger.info('Processing video file in job %d.', job.id);
        const video = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoUUID);
        if (!video) {
            logger_1.logger.info('Do not process job %d, video does not exist.', job.id);
            return undefined;
        }
        if (payload.resolution) {
            yield video_transcoding_1.transcodeOriginalVideofile(video, payload.resolution, payload.isPortraitMode || false);
            yield database_utils_1.retryTransactionWrapper(onVideoFileTranscoderOrImportSuccess, video);
        }
        else {
            yield video_transcoding_1.optimizeVideofile(video);
            yield database_utils_1.retryTransactionWrapper(onVideoFileOptimizerSuccess, video, payload.isNewVideo);
        }
        return video;
    });
}
exports.processVideoFile = processVideoFile;
function onVideoFileTranscoderOrImportSuccess(video) {
    return __awaiter(this, void 0, void 0, function* () {
        if (video === undefined)
            return undefined;
        return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            let videoDatabase = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(video.uuid, t);
            if (!videoDatabase)
                return undefined;
            let isNewVideo = false;
            if (videoDatabase.state !== shared_1.VideoState.PUBLISHED) {
                isNewVideo = true;
                videoDatabase.state = shared_1.VideoState.PUBLISHED;
                videoDatabase.publishedAt = new Date();
                videoDatabase = yield videoDatabase.save({ transaction: t });
            }
            yield activitypub_1.federateVideoIfNeeded(videoDatabase, isNewVideo, t);
            return undefined;
        }));
    });
}
function onVideoFileOptimizerSuccess(video, isNewVideo) {
    return __awaiter(this, void 0, void 0, function* () {
        if (video === undefined)
            return undefined;
        const { videoFileResolution } = yield video.getOriginalFileResolution();
        return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const videoDatabase = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(video.uuid, t);
            if (!videoDatabase)
                return undefined;
            const resolutionsEnabled = ffmpeg_utils_1.computeResolutionsToTranscode(videoFileResolution);
            logger_1.logger.info('Resolutions computed for video %s and origin file height of %d.', videoDatabase.uuid, videoFileResolution, { resolutions: resolutionsEnabled });
            if (resolutionsEnabled.length !== 0) {
                const tasks = [];
                for (const resolution of resolutionsEnabled) {
                    const dataInput = {
                        videoUUID: videoDatabase.uuid,
                        resolution
                    };
                    const p = job_queue_1.JobQueue.Instance.createJob({ type: 'video-file', payload: dataInput });
                    tasks.push(p);
                }
                yield Promise.all(tasks);
                logger_1.logger.info('Transcoding jobs created for uuid %s.', videoDatabase.uuid, { resolutionsEnabled });
            }
            else {
                video.state = shared_1.VideoState.PUBLISHED;
                video = yield video.save({ transaction: t });
                logger_1.logger.info('No transcoding jobs created for video %s (no resolutions).', video.uuid);
            }
            return activitypub_1.federateVideoIfNeeded(video, isNewVideo, t);
        }));
    });
}
