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
require("express-validator");
require("multer");
const validator = require("validator");
const initializers_1 = require("../../initializers");
const misc_1 = require("./misc");
const video_import_1 = require("../../models/video/video-import");
function isVideoImportTargetUrlValid(url) {
    const isURLOptions = {
        require_host: true,
        require_tld: true,
        require_protocol: true,
        require_valid_protocol: true,
        protocols: ['http', 'https']
    };
    return misc_1.exists(url) &&
        validator.isURL('' + url, isURLOptions) &&
        validator.isLength('' + url, initializers_1.CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL);
}
exports.isVideoImportTargetUrlValid = isVideoImportTargetUrlValid;
function isVideoImportStateValid(value) {
    return misc_1.exists(value) && initializers_1.VIDEO_IMPORT_STATES[value] !== undefined;
}
exports.isVideoImportStateValid = isVideoImportStateValid;
const videoTorrentImportTypes = Object.keys(initializers_1.TORRENT_MIMETYPE_EXT).map(m => `(${m})`);
const videoTorrentImportRegex = videoTorrentImportTypes.join('|');
function isVideoImportTorrentFile(files) {
    return misc_1.isFileValid(files, videoTorrentImportRegex, 'torrentfile', initializers_1.CONSTRAINTS_FIELDS.VIDEO_IMPORTS.TORRENT_FILE.FILE_SIZE.max, true);
}
exports.isVideoImportTorrentFile = isVideoImportTorrentFile;
function isVideoImportExist(id, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoImport = yield video_import_1.VideoImportModel.loadAndPopulateVideo(id);
        if (!videoImport) {
            res.status(404)
                .json({ error: 'Video import not found' })
                .end();
            return false;
        }
        res.locals.videoImport = videoImport;
        return true;
    });
}
exports.isVideoImportExist = isVideoImportExist;
//# sourceMappingURL=video-imports.js.map