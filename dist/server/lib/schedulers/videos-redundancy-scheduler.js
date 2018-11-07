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
const abstract_scheduler_1 = require("./abstract-scheduler");
const initializers_1 = require("../../initializers");
const logger_1 = require("../../helpers/logger");
const video_redundancy_1 = require("../../models/redundancy/video-redundancy");
const webtorrent_1 = require("../../helpers/webtorrent");
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const utils_1 = require("../../helpers/utils");
const send_1 = require("../activitypub/send");
const url_1 = require("../activitypub/url");
const redundancy_1 = require("../redundancy");
const activitypub_1 = require("../activitypub");
class VideosRedundancyScheduler extends abstract_scheduler_1.AbstractScheduler {
    constructor() {
        super();
        this.executing = false;
        this.schedulerIntervalMs = initializers_1.CONFIG.REDUNDANCY.VIDEOS.CHECK_INTERVAL;
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.executing)
                return;
            this.executing = true;
            for (const obj of initializers_1.CONFIG.REDUNDANCY.VIDEOS.STRATEGIES) {
                logger_1.logger.info('Running redundancy scheduler for strategy %s.', obj.strategy);
                try {
                    const videoToDuplicate = yield this.findVideoToDuplicate(obj);
                    if (!videoToDuplicate)
                        continue;
                    const videoFiles = videoToDuplicate.VideoFiles;
                    videoFiles.forEach(f => f.Video = videoToDuplicate);
                    yield this.purgeCacheIfNeeded(obj, videoFiles);
                    if (yield this.isTooHeavy(obj, videoFiles)) {
                        logger_1.logger.info('Video %s is too big for our cache, skipping.', videoToDuplicate.url);
                        continue;
                    }
                    logger_1.logger.info('Will duplicate video %s in redundancy scheduler "%s".', videoToDuplicate.url, obj.strategy);
                    yield this.createVideoRedundancy(obj, videoFiles);
                }
                catch (err) {
                    logger_1.logger.error('Cannot run videos redundancy %s.', obj.strategy, { err });
                }
            }
            yield this.extendsLocalExpiration();
            yield this.purgeRemoteExpired();
            this.executing = false;
        });
    }
    static get Instance() {
        return this.instance || (this.instance = new this());
    }
    extendsLocalExpiration() {
        return __awaiter(this, void 0, void 0, function* () {
            const expired = yield video_redundancy_1.VideoRedundancyModel.listLocalExpired();
            for (const redundancyModel of expired) {
                try {
                    yield this.extendsOrDeleteRedundancy(redundancyModel);
                }
                catch (err) {
                    logger_1.logger.error('Cannot extend expiration of %s video from our redundancy system.', this.buildEntryLogId(redundancyModel));
                }
            }
        });
    }
    extendsOrDeleteRedundancy(redundancyModel) {
        return __awaiter(this, void 0, void 0, function* () {
            const video = yield this.loadAndRefreshVideo(redundancyModel.VideoFile.Video.url);
            if (!video) {
                logger_1.logger.info('Destroying existing redundancy %s, because the associated video does not exist anymore.', redundancyModel.url);
                yield redundancyModel.destroy();
                return;
            }
            const redundancy = initializers_1.CONFIG.REDUNDANCY.VIDEOS.STRATEGIES.find(s => s.strategy === redundancyModel.strategy);
            yield this.extendsExpirationOf(redundancyModel, redundancy.minLifetime);
        });
    }
    purgeRemoteExpired() {
        return __awaiter(this, void 0, void 0, function* () {
            const expired = yield video_redundancy_1.VideoRedundancyModel.listRemoteExpired();
            for (const redundancyModel of expired) {
                try {
                    yield redundancy_1.removeVideoRedundancy(redundancyModel);
                }
                catch (err) {
                    logger_1.logger.error('Cannot remove redundancy %s from our redundancy system.', this.buildEntryLogId(redundancyModel));
                }
            }
        });
    }
    findVideoToDuplicate(cache) {
        if (cache.strategy === 'most-views') {
            return video_redundancy_1.VideoRedundancyModel.findMostViewToDuplicate(initializers_1.REDUNDANCY.VIDEOS.RANDOMIZED_FACTOR);
        }
        if (cache.strategy === 'trending') {
            return video_redundancy_1.VideoRedundancyModel.findTrendingToDuplicate(initializers_1.REDUNDANCY.VIDEOS.RANDOMIZED_FACTOR);
        }
        if (cache.strategy === 'recently-added') {
            const minViews = cache.minViews;
            return video_redundancy_1.VideoRedundancyModel.findRecentlyAddedToDuplicate(initializers_1.REDUNDANCY.VIDEOS.RANDOMIZED_FACTOR, minViews);
        }
    }
    createVideoRedundancy(redundancy, filesToDuplicate) {
        return __awaiter(this, void 0, void 0, function* () {
            const serverActor = yield utils_1.getServerActor();
            for (const file of filesToDuplicate) {
                const video = yield this.loadAndRefreshVideo(file.Video.url);
                const existingRedundancy = yield video_redundancy_1.VideoRedundancyModel.loadLocalByFileId(file.id);
                if (existingRedundancy) {
                    yield this.extendsOrDeleteRedundancy(existingRedundancy);
                    continue;
                }
                if (!video) {
                    logger_1.logger.info('Video %s we want to duplicate does not existing anymore, skipping.', file.Video.url);
                    continue;
                }
                logger_1.logger.info('Duplicating %s - %d in videos redundancy with "%s" strategy.', video.url, file.resolution, redundancy.strategy);
                const { baseUrlHttp, baseUrlWs } = video.getBaseUrls();
                const magnetUri = video.generateMagnetUri(file, baseUrlHttp, baseUrlWs);
                const tmpPath = yield webtorrent_1.downloadWebTorrentVideo({ magnetUri }, initializers_1.VIDEO_IMPORT_TIMEOUT);
                const destPath = path_1.join(initializers_1.CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename(file));
                yield fs_extra_1.rename(tmpPath, destPath);
                const createdModel = yield video_redundancy_1.VideoRedundancyModel.create({
                    expiresOn: this.buildNewExpiration(redundancy.minLifetime),
                    url: url_1.getVideoCacheFileActivityPubUrl(file),
                    fileUrl: video.getVideoFileUrl(file, initializers_1.CONFIG.WEBSERVER.URL),
                    strategy: redundancy.strategy,
                    videoFileId: file.id,
                    actorId: serverActor.id
                });
                createdModel.VideoFile = file;
                yield send_1.sendCreateCacheFile(serverActor, createdModel);
                logger_1.logger.info('Duplicated %s - %d -> %s.', video.url, file.resolution, createdModel.url);
            }
        });
    }
    extendsExpirationOf(redundancy, expiresAfterMs) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.info('Extending expiration of %s.', redundancy.url);
            const serverActor = yield utils_1.getServerActor();
            redundancy.expiresOn = this.buildNewExpiration(expiresAfterMs);
            yield redundancy.save();
            yield send_1.sendUpdateCacheFile(serverActor, redundancy);
        });
    }
    purgeCacheIfNeeded(redundancy, filesToDuplicate) {
        return __awaiter(this, void 0, void 0, function* () {
            while (this.isTooHeavy(redundancy, filesToDuplicate)) {
                const toDelete = yield video_redundancy_1.VideoRedundancyModel.loadOldestLocalThatAlreadyExpired(redundancy.strategy, redundancy.minLifetime);
                if (!toDelete)
                    return;
                yield redundancy_1.removeVideoRedundancy(toDelete);
            }
        });
    }
    isTooHeavy(redundancy, filesToDuplicate) {
        return __awaiter(this, void 0, void 0, function* () {
            const maxSize = redundancy.size - this.getTotalFileSizes(filesToDuplicate);
            const totalDuplicated = yield video_redundancy_1.VideoRedundancyModel.getTotalDuplicated(redundancy.strategy);
            return totalDuplicated > maxSize;
        });
    }
    buildNewExpiration(expiresAfterMs) {
        return new Date(Date.now() + expiresAfterMs);
    }
    buildEntryLogId(object) {
        return `${object.VideoFile.Video.url}-${object.VideoFile.resolution}`;
    }
    getTotalFileSizes(files) {
        const fileReducer = (previous, current) => previous + current.size;
        return files.reduce(fileReducer, 0);
    }
    loadAndRefreshVideo(videoUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            const getVideoOptions = {
                videoObject: videoUrl,
                syncParam: { likes: false, dislikes: false, shares: false, comments: false, thumbnail: false, refreshVideo: true },
                fetchType: 'all'
            };
            const { video } = yield activitypub_1.getOrCreateVideoAndAccountAndChannel(getVideoOptions);
            return video;
        });
    }
}
exports.VideosRedundancyScheduler = VideosRedundancyScheduler;
//# sourceMappingURL=videos-redundancy-scheduler.js.map