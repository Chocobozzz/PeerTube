"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var VideoResolution;
(function (VideoResolution) {
    VideoResolution[VideoResolution["H_240P"] = 240] = "H_240P";
    VideoResolution[VideoResolution["H_360P"] = 360] = "H_360P";
    VideoResolution[VideoResolution["H_480P"] = 480] = "H_480P";
    VideoResolution[VideoResolution["H_720P"] = 720] = "H_720P";
    VideoResolution[VideoResolution["H_1080P"] = 1080] = "H_1080P";
})(VideoResolution = exports.VideoResolution || (exports.VideoResolution = {}));
function getBaseBitrate(resolution) {
    switch (resolution) {
        case VideoResolution.H_240P:
            return 250 * 1000;
        case VideoResolution.H_360P:
            return 500 * 1000;
        case VideoResolution.H_480P:
            return 900 * 1000;
        case VideoResolution.H_720P:
            return 1750 * 1000;
        case VideoResolution.H_1080P:
        default:
            return 3300 * 1000;
    }
}
function getTargetBitrate(resolution, fps, fpsTranscodingConstants) {
    const baseBitrate = getBaseBitrate(resolution);
    const maxBitrate = baseBitrate * 1.4;
    const maxBitrateDifference = maxBitrate - baseBitrate;
    const maxFpsDifference = fpsTranscodingConstants.MAX - fpsTranscodingConstants.AVERAGE;
    return baseBitrate + (fps - fpsTranscodingConstants.AVERAGE) * (maxBitrateDifference / maxFpsDifference);
}
exports.getTargetBitrate = getTargetBitrate;
function getMaxBitrate(resolution, fps, fpsTranscodingConstants) {
    return getTargetBitrate(resolution, fps, fpsTranscodingConstants) * 2;
}
exports.getMaxBitrate = getMaxBitrate;
