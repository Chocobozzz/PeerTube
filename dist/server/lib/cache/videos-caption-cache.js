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
const path_1 = require("path");
const initializers_1 = require("../../initializers");
const video_1 = require("../../models/video/video");
const video_caption_1 = require("../../models/video/video-caption");
const abstract_video_static_file_cache_1 = require("./abstract-video-static-file-cache");
class VideosCaptionCache extends abstract_video_static_file_cache_1.AbstractVideoStaticFileCache {
    constructor() {
        super();
    }
    static get Instance() {
        return this.instance || (this.instance = new this());
    }
    getFilePath(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const videoCaption = yield video_caption_1.VideoCaptionModel.loadByVideoIdAndLanguage(params.videoId, params.language);
            if (!videoCaption)
                return undefined;
            if (videoCaption.isOwned())
                return path_1.join(initializers_1.CONFIG.STORAGE.CAPTIONS_DIR, videoCaption.getCaptionName());
            const key = params.videoId + VideosCaptionCache.KEY_DELIMITER + params.language;
            return this.loadFromLRU(key);
        });
    }
    loadRemoteFile(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const [videoId, language] = key.split(VideosCaptionCache.KEY_DELIMITER);
            const videoCaption = yield video_caption_1.VideoCaptionModel.loadByVideoIdAndLanguage(videoId, language);
            if (!videoCaption)
                return undefined;
            if (videoCaption.isOwned())
                throw new Error('Cannot load remote caption of owned video.');
            const video = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(videoId);
            if (!video)
                return undefined;
            const remoteStaticPath = videoCaption.getCaptionStaticPath();
            const destPath = path_1.join(initializers_1.CACHE.VIDEO_CAPTIONS.DIRECTORY, videoCaption.getCaptionName());
            return this.saveRemoteVideoFileAndReturnPath(video, remoteStaticPath, destPath);
        });
    }
}
VideosCaptionCache.KEY_DELIMITER = '%';
exports.VideosCaptionCache = VideosCaptionCache;
