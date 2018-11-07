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
const prompt = require("prompt");
const path_1 = require("path");
const constants_1 = require("../server/initializers/constants");
const video_1 = require("../server/models/video/video");
const initializers_1 = require("../server/initializers");
const fs_extra_1 = require("fs-extra");
const video_redundancy_1 = require("../server/models/redundancy/video-redundancy");
const utils_1 = require("../server/helpers/utils");
run()
    .then(() => process.exit(0))
    .catch(err => {
    console.error(err);
    process.exit(-1);
});
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        yield initializers_1.initDatabaseModels(true);
        const storageOnlyOwnedToPrune = [
            constants_1.CONFIG.STORAGE.VIDEOS_DIR,
            constants_1.CONFIG.STORAGE.TORRENTS_DIR
        ];
        const storageForAllToPrune = [
            constants_1.CONFIG.STORAGE.PREVIEWS_DIR,
            constants_1.CONFIG.STORAGE.THUMBNAILS_DIR
        ];
        let toDelete = [];
        for (const directory of storageOnlyOwnedToPrune) {
            toDelete = toDelete.concat(yield pruneDirectory(directory, true));
        }
        for (const directory of storageForAllToPrune) {
            toDelete = toDelete.concat(yield pruneDirectory(directory, false));
        }
        if (toDelete.length === 0) {
            console.log('No files to delete.');
            return;
        }
        console.log('Will delete %d files:\n\n%s\n\n', toDelete.length, toDelete.join('\n'));
        const res = yield askConfirmation();
        if (res === true) {
            console.log('Processing delete...\n');
            for (const path of toDelete) {
                yield fs_extra_1.remove(path);
            }
            console.log('Done!');
        }
        else {
            console.log('Exiting without deleting files.');
        }
    });
}
function pruneDirectory(directory, onlyOwned = false) {
    return __awaiter(this, void 0, void 0, function* () {
        const files = yield fs_extra_1.readdir(directory);
        const toDelete = [];
        for (const file of files) {
            const uuid = utils_1.getUUIDFromFilename(file);
            let video;
            let localRedundancy;
            if (uuid) {
                video = yield video_1.VideoModel.loadByUUIDWithFile(uuid);
                localRedundancy = yield video_redundancy_1.VideoRedundancyModel.isLocalByVideoUUIDExists(uuid);
            }
            if (!uuid ||
                !video ||
                (onlyOwned === true && (video.isOwned() === false && localRedundancy === false))) {
                toDelete.push(path_1.join(directory, file));
            }
        }
        return toDelete;
    });
}
function askConfirmation() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((res, rej) => {
            prompt.start();
            const schema = {
                properties: {
                    confirm: {
                        type: 'string',
                        description: 'These following unused files can be deleted, but please check your backups first (bugs happen).' +
                            ' Can we delete these files?',
                        default: 'n',
                        required: true
                    }
                }
            };
            prompt.get(schema, function (err, result) {
                if (err)
                    return rej(err);
                return res(result.confirm && result.confirm.match(/y/) !== null);
            });
        });
    });
}
