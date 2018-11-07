"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AsyncLRU = require("async-lru");
const fs_extra_1 = require("fs-extra");
const logger_1 = require("../../helpers/logger");
const activitypub_1 = require("../activitypub");
class AbstractVideoStaticFileCache {
    init(max, maxAge) {
        this.lru = new AsyncLRU({
            max,
            maxAge,
            load: (key, cb) => {
                this.loadRemoteFile(key)
                    .then(res => cb(null, res))
                    .catch(err => cb(err));
            }
        });
        this.lru.on('evict', (obj) => {
            fs_extra_1.remove(obj.value)
                .then(() => logger_1.logger.debug('%s evicted from %s', obj.value, this.constructor.name));
        });
    }
    loadFromLRU(key) {
        return new Promise((res, rej) => {
            this.lru.get(key, (err, value) => {
                err ? rej(err) : res(value);
            });
        });
    }
    saveRemoteVideoFileAndReturnPath(video, remoteStaticPath, destPath) {
        return new Promise((res, rej) => {
            const req = activitypub_1.fetchRemoteVideoStaticFile(video, remoteStaticPath, rej);
            const stream = fs_extra_1.createWriteStream(destPath);
            req.pipe(stream)
                .on('error', (err) => rej(err))
                .on('finish', () => res(destPath));
        });
    }
}
exports.AbstractVideoStaticFileCache = AbstractVideoStaticFileCache;
