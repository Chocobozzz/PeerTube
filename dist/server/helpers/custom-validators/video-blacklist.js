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
const validator = require("validator");
const initializers_1 = require("../../initializers");
const video_blacklist_1 = require("../../models/video/video-blacklist");
const VIDEO_BLACKLIST_CONSTRAINTS_FIELDS = initializers_1.CONSTRAINTS_FIELDS.VIDEO_BLACKLIST;
function isVideoBlacklistReasonValid(value) {
    return value === null || validator.isLength(value, VIDEO_BLACKLIST_CONSTRAINTS_FIELDS.REASON);
}
exports.isVideoBlacklistReasonValid = isVideoBlacklistReasonValid;
function isVideoBlacklistExist(videoId, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoBlacklist = yield video_blacklist_1.VideoBlacklistModel.loadByVideoId(videoId);
        if (videoBlacklist === null) {
            res.status(404)
                .json({ error: 'Blacklisted video not found' })
                .end();
            return false;
        }
        res.locals.videoBlacklist = videoBlacklist;
        return true;
    });
}
exports.isVideoBlacklistExist = isVideoBlacklistExist;
//# sourceMappingURL=video-blacklist.js.map