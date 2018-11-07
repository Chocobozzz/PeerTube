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
const initializers_1 = require("../../initializers");
const misc_1 = require("./misc");
const video_caption_1 = require("../../models/video/video-caption");
function isVideoCaptionLanguageValid(value) {
    return misc_1.exists(value) && initializers_1.VIDEO_LANGUAGES[value] !== undefined;
}
exports.isVideoCaptionLanguageValid = isVideoCaptionLanguageValid;
const videoCaptionTypes = Object.keys(initializers_1.VIDEO_CAPTIONS_MIMETYPE_EXT)
    .concat(['application/octet-stream'])
    .map(m => `(${m})`);
const videoCaptionTypesRegex = videoCaptionTypes.join('|');
function isVideoCaptionFile(files, field) {
    return misc_1.isFileValid(files, videoCaptionTypesRegex, field, initializers_1.CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE.max);
}
exports.isVideoCaptionFile = isVideoCaptionFile;
function isVideoCaptionExist(video, language, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoCaption = yield video_caption_1.VideoCaptionModel.loadByVideoIdAndLanguage(video.id, language);
        if (!videoCaption) {
            res.status(404)
                .json({ error: 'Video caption not found' })
                .end();
            return false;
        }
        res.locals.videoCaption = videoCaption;
        return true;
    });
}
exports.isVideoCaptionExist = isVideoCaptionExist;
//# sourceMappingURL=video-captions.js.map