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
const abstract_video_static_file_cache_1 = require("./abstract-video-static-file-cache");
class VideosPreviewCache extends abstract_video_static_file_cache_1.AbstractVideoStaticFileCache {
    constructor() {
        super();
    }
    static get Instance() {
        return this.instance || (this.instance = new this());
    }
    getFilePath(videoUUID) {
        return __awaiter(this, void 0, void 0, function* () {
            const video = yield video_1.VideoModel.loadByUUIDWithFile(videoUUID);
            if (!video)
                return undefined;
            if (video.isOwned())
                return path_1.join(initializers_1.CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName());
            return this.loadFromLRU(videoUUID);
        });
    }
    loadRemoteFile(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const video = yield video_1.VideoModel.loadAndPopulateAccountAndServerAndTags(key);
            if (!video)
                return undefined;
            if (video.isOwned())
                throw new Error('Cannot load remote preview of owned video.');
            const remoteStaticPath = path_1.join(initializers_1.STATIC_PATHS.PREVIEWS, video.getPreviewName());
            const destPath = path_1.join(initializers_1.CACHE.PREVIEWS.DIRECTORY, video.getPreviewName());
            return this.saveRemoteVideoFileAndReturnPath(video, remoteStaticPath, destPath);
        });
    }
}
exports.VideosPreviewCache = VideosPreviewCache;
//# sourceMappingURL=videos-preview-cache.js.map