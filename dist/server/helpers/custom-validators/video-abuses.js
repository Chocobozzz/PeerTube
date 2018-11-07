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
const misc_1 = require("./misc");
const video_abuse_1 = require("../../models/video/video-abuse");
const VIDEO_ABUSES_CONSTRAINTS_FIELDS = initializers_1.CONSTRAINTS_FIELDS.VIDEO_ABUSES;
function isVideoAbuseReasonValid(value) {
    return misc_1.exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.REASON);
}
exports.isVideoAbuseReasonValid = isVideoAbuseReasonValid;
function isVideoAbuseModerationCommentValid(value) {
    return misc_1.exists(value) && validator.isLength(value, VIDEO_ABUSES_CONSTRAINTS_FIELDS.MODERATION_COMMENT);
}
exports.isVideoAbuseModerationCommentValid = isVideoAbuseModerationCommentValid;
function isVideoAbuseStateValid(value) {
    return misc_1.exists(value) && initializers_1.VIDEO_ABUSE_STATES[value] !== undefined;
}
exports.isVideoAbuseStateValid = isVideoAbuseStateValid;
function isVideoAbuseExist(abuseId, videoId, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoAbuse = yield video_abuse_1.VideoAbuseModel.loadByIdAndVideoId(abuseId, videoId);
        if (videoAbuse === null) {
            res.status(404)
                .json({ error: 'Video abuse not found' })
                .end();
            return false;
        }
        res.locals.videoAbuse = videoAbuse;
        return true;
    });
}
exports.isVideoAbuseExist = isVideoAbuseExist;
//# sourceMappingURL=video-abuses.js.map