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
const lodash_1 = require("lodash");
const initializers_1 = require("../initializers");
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const path_1 = require("path");
const core_utils_1 = require("./core-utils");
const fs_extra_1 = require("fs-extra");
const request = require("request");
const fs_1 = require("fs");
const processOptions = {
    maxBuffer: 1024 * 1024 * 10
};
function getYoutubeDLInfo(url, opts) {
    return new Promise((res, rej) => __awaiter(this, void 0, void 0, function* () {
        const options = opts || ['-j', '--flat-playlist'];
        const youtubeDL = yield safeGetYoutubeDL();
        youtubeDL.getInfo(url, options, (err, info) => {
            if (err)
                return rej(err);
            if (info.is_live === true)
                return rej(new Error('Cannot download a live streaming.'));
            const obj = buildVideoInfo(normalizeObject(info));
            if (obj.name && obj.name.length < initializers_1.CONSTRAINTS_FIELDS.VIDEOS.NAME.min)
                obj.name += ' video';
            return res(obj);
        });
    }));
}
exports.getYoutubeDLInfo = getYoutubeDLInfo;
function downloadYoutubeDLVideo(url, timeout) {
    const path = utils_1.generateVideoTmpPath(url);
    let timer;
    logger_1.logger.info('Importing youtubeDL video %s', url);
    const options = ['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best', '-o', path];
    return new Promise((res, rej) => __awaiter(this, void 0, void 0, function* () {
        const youtubeDL = yield safeGetYoutubeDL();
        youtubeDL.exec(url, options, processOptions, err => {
            clearTimeout(timer);
            if (err) {
                fs_extra_1.remove(path)
                    .catch(err => logger_1.logger.error('Cannot delete path on YoutubeDL error.', { err }));
                return rej(err);
            }
            return res(path);
        });
        timer = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            yield fs_extra_1.remove(path);
            return rej(new Error('YoutubeDL download timeout.'));
        }), timeout);
    }));
}
exports.downloadYoutubeDLVideo = downloadYoutubeDLVideo;
function updateYoutubeDLBinary() {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Updating youtubeDL binary.');
        const binDirectory = path_1.join(core_utils_1.root(), 'node_modules', 'youtube-dl', 'bin');
        const bin = path_1.join(binDirectory, 'youtube-dl');
        const detailsPath = path_1.join(binDirectory, 'details');
        const url = 'https://yt-dl.org/downloads/latest/youtube-dl';
        yield fs_extra_1.ensureDir(binDirectory);
        return new Promise(res => {
            request.get(url, { followRedirect: false }, (err, result) => {
                if (err) {
                    logger_1.logger.error('Cannot update youtube-dl.', { err });
                    return res();
                }
                if (result.statusCode !== 302) {
                    logger_1.logger.error('youtube-dl update error: did not get redirect for the latest version link. Status %d', result.statusCode);
                    return res();
                }
                const url = result.headers.location;
                const downloadFile = request.get(url);
                const newVersion = /yt-dl\.org\/downloads\/(\d{4}\.\d\d\.\d\d(\.\d)?)\/youtube-dl/.exec(url)[1];
                downloadFile.on('response', result => {
                    if (result.statusCode !== 200) {
                        logger_1.logger.error('Cannot update youtube-dl: new version response is not 200, it\'s %d.', result.statusCode);
                        return res();
                    }
                    downloadFile.pipe(fs_1.createWriteStream(bin, { mode: 493 }));
                });
                downloadFile.on('error', err => {
                    logger_1.logger.error('youtube-dl update error.', { err });
                    return res();
                });
                downloadFile.on('end', () => {
                    const details = JSON.stringify({ version: newVersion, path: bin, exec: 'youtube-dl' });
                    fs_extra_1.writeFile(detailsPath, details, { encoding: 'utf8' }, err => {
                        if (err) {
                            logger_1.logger.error('youtube-dl update error: cannot write details.', { err });
                            return res();
                        }
                        logger_1.logger.info('youtube-dl updated to version %s.', newVersion);
                        return res();
                    });
                });
            });
        });
    });
}
exports.updateYoutubeDLBinary = updateYoutubeDLBinary;
function safeGetYoutubeDL() {
    return __awaiter(this, void 0, void 0, function* () {
        let youtubeDL;
        try {
            youtubeDL = require('youtube-dl');
        }
        catch (e) {
            yield updateYoutubeDLBinary();
            youtubeDL = require('youtube-dl');
        }
        return youtubeDL;
    });
}
exports.safeGetYoutubeDL = safeGetYoutubeDL;
function normalizeObject(obj) {
    const newObj = {};
    for (const key of Object.keys(obj)) {
        if (key === 'resolution')
            continue;
        const value = obj[key];
        if (typeof value === 'string') {
            newObj[key] = value.normalize();
        }
        else {
            newObj[key] = value;
        }
    }
    return newObj;
}
function buildVideoInfo(obj) {
    return {
        name: titleTruncation(obj.title),
        description: descriptionTruncation(obj.description),
        category: getCategory(obj.categories),
        licence: getLicence(obj.license),
        nsfw: isNSFW(obj),
        tags: getTags(obj.tags),
        thumbnailUrl: obj.thumbnail || undefined
    };
}
function titleTruncation(title) {
    return lodash_1.truncate(title, {
        'length': initializers_1.CONSTRAINTS_FIELDS.VIDEOS.NAME.max,
        'separator': /,? +/,
        'omission': ' […]'
    });
}
function descriptionTruncation(description) {
    if (!description || description.length < initializers_1.CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.min)
        return undefined;
    return lodash_1.truncate(description, {
        'length': initializers_1.CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max,
        'separator': /,? +/,
        'omission': ' […]'
    });
}
function isNSFW(info) {
    return info.age_limit && info.age_limit >= 16;
}
function getTags(tags) {
    if (Array.isArray(tags) === false)
        return [];
    return tags
        .filter(t => t.length < initializers_1.CONSTRAINTS_FIELDS.VIDEOS.TAG.max && t.length > initializers_1.CONSTRAINTS_FIELDS.VIDEOS.TAG.min)
        .map(t => t.normalize())
        .slice(0, 5);
}
function getLicence(licence) {
    if (!licence)
        return undefined;
    if (licence.indexOf('Creative Commons Attribution') !== -1)
        return 1;
    return undefined;
}
function getCategory(categories) {
    if (!categories)
        return undefined;
    const categoryString = categories[0];
    if (!categoryString || typeof categoryString !== 'string')
        return undefined;
    if (categoryString === 'News & Politics')
        return 11;
    for (const key of Object.keys(initializers_1.VIDEO_CATEGORIES)) {
        const category = initializers_1.VIDEO_CATEGORIES[key];
        if (categoryString.toLowerCase() === category.toLowerCase())
            return parseInt(key, 10);
    }
    return undefined;
}
//# sourceMappingURL=youtube-dl.js.map