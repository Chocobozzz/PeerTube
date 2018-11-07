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
const constants_1 = require("../server/initializers/constants");
const ffmpeg_utils_1 = require("../server/helpers/ffmpeg-utils");
const videos_1 = require("../shared/models/videos");
const video_1 = require("../server/models/video/video");
const video_transcoding_1 = require("../server/lib/video-transcoding");
const initializers_1 = require("../server/initializers");
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
run()
    .then(() => process.exit(0))
    .catch(err => {
    console.error(err);
    process.exit(-1);
});
let currentVideoId = null;
let currentFile = null;
process.on('SIGINT', function () {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Cleaning up temp files');
        yield fs_extra_1.remove(`${currentFile}_backup`);
        yield fs_extra_1.remove(`${path_1.dirname(currentFile)}/${currentVideoId}-transcoded.mp4`);
        process.exit(0);
    });
});
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        yield initializers_1.initDatabaseModels(true);
        const localVideos = yield video_1.VideoModel.listLocal();
        for (const video of localVideos) {
            currentVideoId = video.id;
            for (const file of video.VideoFiles) {
                currentFile = path_1.join(constants_1.CONFIG.STORAGE.VIDEOS_DIR, video.getVideoFilename(file));
                const [videoBitrate, fps, resolution] = yield Promise.all([
                    ffmpeg_utils_1.getVideoFileBitrate(currentFile),
                    ffmpeg_utils_1.getVideoFileFPS(currentFile),
                    ffmpeg_utils_1.getVideoFileResolution(currentFile)
                ]);
                const maxBitrate = videos_1.getMaxBitrate(resolution.videoFileResolution, fps, constants_1.VIDEO_TRANSCODING_FPS);
                const isMaxBitrateExceeded = videoBitrate > maxBitrate;
                if (isMaxBitrateExceeded) {
                    console.log('Optimizing video file %s with bitrate %s kbps (max: %s kbps)', path_1.basename(currentFile), videoBitrate / 1000, maxBitrate / 1000);
                    const backupFile = `${currentFile}_backup`;
                    yield fs_extra_1.copy(currentFile, backupFile);
                    yield video_transcoding_1.optimizeVideofile(video, file);
                    const originalDuration = yield ffmpeg_utils_1.getDurationFromVideoFile(backupFile);
                    const newDuration = yield ffmpeg_utils_1.getDurationFromVideoFile(currentFile);
                    if (originalDuration === newDuration) {
                        console.log('Finished optimizing %s', path_1.basename(currentFile));
                        yield fs_extra_1.remove(backupFile);
                    }
                    else {
                        console.log('Failed to optimize %s, restoring original', path_1.basename(currentFile));
                        fs_extra_1.move(backupFile, currentFile, { overwrite: true });
                        yield video.createTorrentAndSetInfoHash(file);
                        yield file.save();
                    }
                }
            }
        }
        console.log('Finished optimizing videos');
    });
}
//# sourceMappingURL=optimize-old-videos.js.map