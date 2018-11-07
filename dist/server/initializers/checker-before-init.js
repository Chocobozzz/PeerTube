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
const config = require("config");
const core_utils_1 = require("../helpers/core-utils");
const misc_1 = require("../helpers/custom-validators/misc");
function checkMissedConfig() {
    const required = ['listen.port', 'listen.hostname',
        'webserver.https', 'webserver.hostname', 'webserver.port',
        'trust_proxy',
        'database.hostname', 'database.port', 'database.suffix', 'database.username', 'database.password', 'database.pool.max',
        'smtp.hostname', 'smtp.port', 'smtp.username', 'smtp.password', 'smtp.tls', 'smtp.from_address',
        'storage.avatars', 'storage.videos', 'storage.logs', 'storage.previews', 'storage.thumbnails', 'storage.torrents', 'storage.cache',
        'log.level',
        'user.video_quota', 'user.video_quota_daily',
        'cache.previews.size', 'admin.email',
        'signup.enabled', 'signup.limit', 'signup.requires_email_verification',
        'signup.filters.cidr.whitelist', 'signup.filters.cidr.blacklist',
        'redundancy.videos.strategies', 'redundancy.videos.check_interval',
        'transcoding.enabled', 'transcoding.threads',
        'import.videos.http.enabled', 'import.videos.torrent.enabled',
        'trending.videos.interval_days',
        'instance.name', 'instance.short_description', 'instance.description', 'instance.terms', 'instance.default_client_route',
        'instance.default_nsfw_policy', 'instance.robots', 'instance.securitytxt',
        'services.twitter.username', 'services.twitter.whitelisted'
    ];
    const requiredAlternatives = [
        [
            ['redis.hostname', 'redis.port'],
            ['redis.socket']
        ]
    ];
    const miss = [];
    for (const key of required) {
        if (!config.has(key)) {
            miss.push(key);
        }
    }
    const redundancyVideos = config.get('redundancy.videos.strategies');
    if (misc_1.isArray(redundancyVideos)) {
        for (const r of redundancyVideos) {
            if (!r.size)
                miss.push('redundancy.videos.strategies.size');
            if (!r.min_lifetime)
                miss.push('redundancy.videos.strategies.min_lifetime');
        }
    }
    const missingAlternatives = requiredAlternatives.filter(set => !set.find(alternative => !alternative.find(key => !config.has(key))));
    missingAlternatives
        .forEach(set => set[0].forEach(key => miss.push(key)));
    return miss;
}
exports.checkMissedConfig = checkMissedConfig;
function checkFFmpeg(CONFIG) {
    return __awaiter(this, void 0, void 0, function* () {
        const Ffmpeg = require('fluent-ffmpeg');
        const getAvailableCodecsPromise = core_utils_1.promisify0(Ffmpeg.getAvailableCodecs);
        const codecs = yield getAvailableCodecsPromise();
        const canEncode = ['libx264'];
        if (CONFIG.TRANSCODING.ENABLED === false)
            return undefined;
        for (const codec of canEncode) {
            if (codecs[codec] === undefined) {
                throw new Error('Unknown codec ' + codec + ' in FFmpeg.');
            }
            if (codecs[codec].canEncode !== true) {
                throw new Error('Unavailable encode codec ' + codec + ' in FFmpeg');
            }
        }
        return checkFFmpegEncoders();
    });
}
exports.checkFFmpeg = checkFFmpeg;
let supportedOptionalEncoders;
function checkFFmpegEncoders() {
    return __awaiter(this, void 0, void 0, function* () {
        if (supportedOptionalEncoders !== undefined) {
            return supportedOptionalEncoders;
        }
        const Ffmpeg = require('fluent-ffmpeg');
        const getAvailableEncodersPromise = core_utils_1.promisify0(Ffmpeg.getAvailableEncoders);
        const encoders = yield getAvailableEncodersPromise();
        const optionalEncoders = ['libfdk_aac'];
        supportedOptionalEncoders = new Map();
        for (const encoder of optionalEncoders) {
            supportedOptionalEncoders.set(encoder, encoders[encoder] !== undefined);
        }
        return supportedOptionalEncoders;
    });
}
exports.checkFFmpegEncoders = checkFFmpegEncoders;
//# sourceMappingURL=checker-before-init.js.map