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
const application_1 = require("../models/application/application");
const core_utils_1 = require("./core-utils");
const logger_1 = require("./logger");
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const memoizee = require("memoizee");
function deleteFileAsync(path) {
    fs_extra_1.remove(path)
        .catch(err => logger_1.logger.error('Cannot delete the file %s asynchronously.', path, { err }));
}
exports.deleteFileAsync = deleteFileAsync;
function generateRandomString(size) {
    return __awaiter(this, void 0, void 0, function* () {
        const raw = yield core_utils_1.pseudoRandomBytesPromise(size);
        return raw.toString('hex');
    });
}
exports.generateRandomString = generateRandomString;
function getFormattedObjects(objects, objectsTotal, formattedArg) {
    const formattedObjects = [];
    objects.forEach(object => {
        formattedObjects.push(object.toFormattedJSON(formattedArg));
    });
    return {
        total: objectsTotal,
        data: formattedObjects
    };
}
exports.getFormattedObjects = getFormattedObjects;
const getServerActor = memoizee(function () {
    return __awaiter(this, void 0, void 0, function* () {
        const application = yield application_1.ApplicationModel.load();
        if (!application)
            throw Error('Could not load Application from database.');
        const actor = application.Account.Actor;
        actor.Account = application.Account;
        return actor;
    });
});
exports.getServerActor = getServerActor;
function generateVideoTmpPath(target) {
    const id = typeof target === 'string' ? target : target.infoHash;
    const hash = core_utils_1.sha256(id);
    return path_1.join(initializers_1.CONFIG.STORAGE.VIDEOS_DIR, hash + '-import.mp4');
}
exports.generateVideoTmpPath = generateVideoTmpPath;
function getSecureTorrentName(originalName) {
    return core_utils_1.sha256(originalName) + '.torrent';
}
exports.getSecureTorrentName = getSecureTorrentName;
function getVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const tag = yield core_utils_1.execPromise2('[ ! -d .git ] || git name-rev --name-only --tags --no-undefined HEAD 2>/dev/null || true', { stdio: [0, 1, 2] });
            if (tag)
                return tag.replace(/^v/, '');
        }
        catch (err) {
            logger_1.logger.debug('Cannot get version from git tags.', { err });
        }
        try {
            const version = yield core_utils_1.execPromise('[ ! -d .git ] || git rev-parse --short HEAD');
            if (version)
                return version.toString().trim();
        }
        catch (err) {
            logger_1.logger.debug('Cannot get version from git HEAD.', { err });
        }
        return require('../../../package.json').version;
    });
}
exports.getVersion = getVersion;
function getUUIDFromFilename(filename) {
    const regex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
    const result = filename.match(regex);
    if (!result || Array.isArray(result) === false)
        return null;
    return result[0];
}
exports.getUUIDFromFilename = getUUIDFromFilename;
