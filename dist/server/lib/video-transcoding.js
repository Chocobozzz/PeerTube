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
const initializers_1 = require("../initializers");
const path_1 = require("path");
const ffmpeg_utils_1 = require("../helpers/ffmpeg-utils");
const fs_extra_1 = require("fs-extra");
const logger_1 = require("../helpers/logger");
const video_file_1 = require("../models/video/video-file");
function optimizeVideofile(video, inputVideoFileArg) {
    return __awaiter(this, void 0, void 0, function* () {
        const videosDirectory = initializers_1.CONFIG.STORAGE.VIDEOS_DIR;
        const newExtname = '.mp4';
        const inputVideoFile = inputVideoFileArg ? inputVideoFileArg : video.getOriginalFile();
        const videoInputPath = path_1.join(videosDirectory, video.getVideoFilename(inputVideoFile));
        const videoTranscodedPath = path_1.join(videosDirectory, video.id + '-transcoded' + newExtname);
        const transcodeOptions = {
            inputPath: videoInputPath,
            outputPath: videoTranscodedPath
        };
        yield ffmpeg_utils_1.transcode(transcodeOptions);
        try {
            yield fs_extra_1.remove(videoInputPath);
            inputVideoFile.set('extname', newExtname);
            const videoOutputPath = video.getVideoFilePath(inputVideoFile);
            yield fs_extra_1.rename(videoTranscodedPath, videoOutputPath);
            const stats = yield fs_extra_1.stat(videoOutputPath);
            const fps = yield ffmpeg_utils_1.getVideoFileFPS(videoOutputPath);
            inputVideoFile.set('size', stats.size);
            inputVideoFile.set('fps', fps);
            yield video.createTorrentAndSetInfoHash(inputVideoFile);
            yield inputVideoFile.save();
        }
        catch (err) {
            video.destroy().catch(err => logger_1.logger.error('Cannot destruct video after transcoding failure.', { err }));
            throw err;
        }
    });
}
exports.optimizeVideofile = optimizeVideofile;
function transcodeOriginalVideofile(video, resolution, isPortraitMode) {
    return __awaiter(this, void 0, void 0, function* () {
        const videosDirectory = initializers_1.CONFIG.STORAGE.VIDEOS_DIR;
        const extname = '.mp4';
        const videoInputPath = path_1.join(videosDirectory, video.getVideoFilename(video.getOriginalFile()));
        const newVideoFile = new video_file_1.VideoFileModel({
            resolution,
            extname,
            size: 0,
            videoId: video.id
        });
        const videoOutputPath = path_1.join(videosDirectory, video.getVideoFilename(newVideoFile));
        const transcodeOptions = {
            inputPath: videoInputPath,
            outputPath: videoOutputPath,
            resolution,
            isPortraitMode
        };
        yield ffmpeg_utils_1.transcode(transcodeOptions);
        const stats = yield fs_extra_1.stat(videoOutputPath);
        const fps = yield ffmpeg_utils_1.getVideoFileFPS(videoOutputPath);
        newVideoFile.set('size', stats.size);
        newVideoFile.set('fps', fps);
        yield video.createTorrentAndSetInfoHash(newVideoFile);
        yield newVideoFile.save();
        video.VideoFiles.push(newVideoFile);
    });
}
exports.transcodeOriginalVideofile = transcodeOriginalVideofile;
function importVideoFile(video, inputFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const { videoFileResolution } = yield ffmpeg_utils_1.getVideoFileResolution(inputFilePath);
        const { size } = yield fs_extra_1.stat(inputFilePath);
        const fps = yield ffmpeg_utils_1.getVideoFileFPS(inputFilePath);
        let updatedVideoFile = new video_file_1.VideoFileModel({
            resolution: videoFileResolution,
            extname: path_1.extname(inputFilePath),
            size,
            fps,
            videoId: video.id
        });
        const currentVideoFile = video.VideoFiles.find(videoFile => videoFile.resolution === updatedVideoFile.resolution);
        if (currentVideoFile) {
            yield video.removeFile(currentVideoFile);
            yield video.removeTorrent(currentVideoFile);
            video.VideoFiles = video.VideoFiles.filter(f => f !== currentVideoFile);
            currentVideoFile.set('extname', updatedVideoFile.extname);
            currentVideoFile.set('size', updatedVideoFile.size);
            currentVideoFile.set('fps', updatedVideoFile.fps);
            updatedVideoFile = currentVideoFile;
        }
        const outputPath = video.getVideoFilePath(updatedVideoFile);
        yield fs_extra_1.copy(inputFilePath, outputPath);
        yield video.createTorrentAndSetInfoHash(updatedVideoFile);
        yield updatedVideoFile.save();
        video.VideoFiles.push(updatedVideoFile);
    });
}
exports.importVideoFile = importVideoFile;
//# sourceMappingURL=video-transcoding.js.map