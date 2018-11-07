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
const ffmpeg = require("fluent-ffmpeg");
const path_1 = require("path");
const videos_1 = require("../../shared/models/videos");
const initializers_1 = require("../initializers");
const image_utils_1 = require("./image-utils");
const logger_1 = require("./logger");
const checker_before_init_1 = require("../initializers/checker-before-init");
const fs_extra_1 = require("fs-extra");
function computeResolutionsToTranscode(videoFileHeight) {
    const resolutionsEnabled = [];
    const configResolutions = initializers_1.CONFIG.TRANSCODING.RESOLUTIONS;
    const resolutions = [
        videos_1.VideoResolution.H_480P,
        videos_1.VideoResolution.H_360P,
        videos_1.VideoResolution.H_720P,
        videos_1.VideoResolution.H_240P,
        videos_1.VideoResolution.H_1080P
    ];
    for (const resolution of resolutions) {
        if (configResolutions[resolution + 'p'] === true && videoFileHeight > resolution) {
            resolutionsEnabled.push(resolution);
        }
    }
    return resolutionsEnabled;
}
exports.computeResolutionsToTranscode = computeResolutionsToTranscode;
function getVideoFileResolution(path) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoStream = yield getVideoFileStream(path);
        return {
            videoFileResolution: Math.min(videoStream.height, videoStream.width),
            isPortraitMode: videoStream.height > videoStream.width
        };
    });
}
exports.getVideoFileResolution = getVideoFileResolution;
function getVideoFileFPS(path) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoStream = yield getVideoFileStream(path);
        for (const key of ['r_frame_rate', 'avg_frame_rate']) {
            const valuesText = videoStream[key];
            if (!valuesText)
                continue;
            const [frames, seconds] = valuesText.split('/');
            if (!frames || !seconds)
                continue;
            const result = parseInt(frames, 10) / parseInt(seconds, 10);
            if (result > 0)
                return Math.round(result);
        }
        return 0;
    });
}
exports.getVideoFileFPS = getVideoFileFPS;
function getVideoFileBitrate(path) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((res, rej) => {
            ffmpeg.ffprobe(path, (err, metadata) => {
                if (err)
                    return rej(err);
                return res(metadata.format.bit_rate);
            });
        });
    });
}
exports.getVideoFileBitrate = getVideoFileBitrate;
function getDurationFromVideoFile(path) {
    return new Promise((res, rej) => {
        ffmpeg.ffprobe(path, (err, metadata) => {
            if (err)
                return rej(err);
            return res(Math.floor(metadata.format.duration));
        });
    });
}
exports.getDurationFromVideoFile = getDurationFromVideoFile;
function generateImageFromVideoFile(fromPath, folder, imageName, size) {
    return __awaiter(this, void 0, void 0, function* () {
        const pendingImageName = 'pending-' + imageName;
        const options = {
            filename: pendingImageName,
            count: 1,
            folder
        };
        const pendingImagePath = path_1.join(folder, pendingImageName);
        try {
            yield new Promise((res, rej) => {
                ffmpeg(fromPath, { niceness: initializers_1.FFMPEG_NICE.THUMBNAIL })
                    .on('error', rej)
                    .on('end', () => res(imageName))
                    .thumbnail(options);
            });
            const destination = path_1.join(folder, imageName);
            yield image_utils_1.processImage({ path: pendingImagePath }, destination, size);
        }
        catch (err) {
            logger_1.logger.error('Cannot generate image from video %s.', fromPath, { err });
            try {
                yield fs_extra_1.remove(pendingImagePath);
            }
            catch (err) {
                logger_1.logger.debug('Cannot remove pending image path after generation error.', { err });
            }
        }
    });
}
exports.generateImageFromVideoFile = generateImageFromVideoFile;
function transcode(options) {
    return new Promise((res, rej) => __awaiter(this, void 0, void 0, function* () {
        try {
            let fps = yield getVideoFileFPS(options.inputPath);
            if (options.resolution !== undefined &&
                options.resolution < initializers_1.VIDEO_TRANSCODING_FPS.KEEP_ORIGIN_FPS_RESOLUTION_MIN &&
                fps > initializers_1.VIDEO_TRANSCODING_FPS.AVERAGE) {
                fps = initializers_1.VIDEO_TRANSCODING_FPS.AVERAGE;
            }
            let command = ffmpeg(options.inputPath, { niceness: initializers_1.FFMPEG_NICE.TRANSCODING })
                .output(options.outputPath);
            command = yield presetH264(command, options.resolution, fps);
            if (initializers_1.CONFIG.TRANSCODING.THREADS > 0) {
                command = command.outputOption('-threads ' + initializers_1.CONFIG.TRANSCODING.THREADS);
            }
            if (options.resolution !== undefined) {
                const size = options.isPortraitMode === true ? `${options.resolution}x?` : `?x${options.resolution}`;
                command = command.size(size);
            }
            if (fps) {
                if (fps > initializers_1.VIDEO_TRANSCODING_FPS.MAX)
                    fps = initializers_1.VIDEO_TRANSCODING_FPS.MAX;
                else if (fps < initializers_1.VIDEO_TRANSCODING_FPS.MIN)
                    fps = initializers_1.VIDEO_TRANSCODING_FPS.MIN;
                command = command.withFPS(fps);
            }
            command
                .on('error', (err, stdout, stderr) => {
                logger_1.logger.error('Error in transcoding job.', { stdout, stderr });
                return rej(err);
            })
                .on('end', res)
                .run();
        }
        catch (err) {
            return rej(err);
        }
    }));
}
exports.transcode = transcode;
function getVideoFileStream(path) {
    return new Promise((res, rej) => {
        ffmpeg.ffprobe(path, (err, metadata) => {
            if (err)
                return rej(err);
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            if (!videoStream)
                throw new Error('Cannot find video stream of ' + path);
            return res(videoStream);
        });
    });
}
function presetH264VeryFast(command, resolution, fps) {
    return __awaiter(this, void 0, void 0, function* () {
        let localCommand = yield presetH264(command, resolution, fps);
        localCommand = localCommand.outputOption('-preset:v veryfast')
            .outputOption(['--aq-mode=2', '--aq-strength=1.3']);
        return localCommand;
    });
}
function presetStillImageWithAudio(command, resolution, fps) {
    return __awaiter(this, void 0, void 0, function* () {
        let localCommand = yield presetH264VeryFast(command, resolution, fps);
        localCommand = localCommand.outputOption('-tune stillimage');
        return localCommand;
    });
}
var audio;
(function (audio) {
    audio.get = (option) => {
        return new Promise((res, rej) => {
            function parseFfprobe(err, data) {
                if (err)
                    return rej(err);
                if ('streams' in data) {
                    const audioStream = data.streams.find(stream => stream['codec_type'] === 'audio');
                    if (audioStream) {
                        return res({
                            absolutePath: data.format.filename,
                            audioStream
                        });
                    }
                }
                return res({ absolutePath: data.format.filename });
            }
            if (typeof option === 'string') {
                return ffmpeg.ffprobe(option, parseFfprobe);
            }
            return option.ffprobe(parseFfprobe);
        });
    };
    let bitrate;
    (function (bitrate_1) {
        const baseKbitrate = 384;
        const toBits = (kbits) => { return kbits * 8000; };
        bitrate_1.aac = (bitrate) => {
            switch (true) {
                case bitrate > toBits(baseKbitrate):
                    return baseKbitrate;
                default:
                    return -1;
            }
        };
        bitrate_1.mp3 = (bitrate) => {
            switch (true) {
                case bitrate <= toBits(192):
                    return 128;
                case bitrate <= toBits(384):
                    return 256;
                default:
                    return baseKbitrate;
            }
        };
    })(bitrate = audio.bitrate || (audio.bitrate = {}));
})(audio || (audio = {}));
exports.audio = audio;
function presetH264(command, resolution, fps) {
    return __awaiter(this, void 0, void 0, function* () {
        let localCommand = command
            .format('mp4')
            .videoCodec('libx264')
            .outputOption('-level 3.1')
            .outputOption('-b_strategy 1')
            .outputOption('-bf 16')
            .outputOption('-map_metadata -1')
            .outputOption('-movflags faststart');
        const parsedAudio = yield audio.get(localCommand);
        if (!parsedAudio.audioStream) {
            localCommand = localCommand.noAudio();
        }
        else if ((yield checker_before_init_1.checkFFmpegEncoders()).get('libfdk_aac')) {
            localCommand = localCommand
                .audioCodec('libfdk_aac')
                .audioQuality(5);
        }
        else {
            const audioCodecName = parsedAudio.audioStream['codec_name'];
            let bitrate;
            if (audio.bitrate[audioCodecName]) {
                bitrate = audio.bitrate[audioCodecName](parsedAudio.audioStream['bit_rate']);
                if (bitrate === -1)
                    localCommand = localCommand.audioCodec('copy');
                else if (bitrate !== undefined)
                    localCommand = localCommand.audioBitrate(bitrate);
            }
        }
        const targetBitrate = videos_1.getTargetBitrate(resolution, fps, initializers_1.VIDEO_TRANSCODING_FPS);
        localCommand = localCommand.outputOptions([`-maxrate ${targetBitrate}`, `-bufsize ${targetBitrate * 2}`]);
        localCommand = localCommand.outputOption(`-g ${fps * 2}`);
        return localCommand;
    });
}
