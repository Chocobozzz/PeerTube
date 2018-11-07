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
const lodash_1 = require("lodash");
require("multer");
const validator = require("validator");
const shared_1 = require("../../../shared");
const initializers_1 = require("../../initializers");
const misc_1 = require("./misc");
const video_channel_1 = require("../../models/video/video-channel");
const magnetUtil = require("magnet-uri");
const video_1 = require("../video");
const VIDEOS_CONSTRAINTS_FIELDS = initializers_1.CONSTRAINTS_FIELDS.VIDEOS;
function isVideoFilterValid(filter) {
    return filter === 'local' || filter === 'all-local';
}
exports.isVideoFilterValid = isVideoFilterValid;
function isVideoCategoryValid(value) {
    return value === null || initializers_1.VIDEO_CATEGORIES[value] !== undefined;
}
exports.isVideoCategoryValid = isVideoCategoryValid;
function isVideoStateValid(value) {
    return misc_1.exists(value) && initializers_1.VIDEO_STATES[value] !== undefined;
}
exports.isVideoStateValid = isVideoStateValid;
function isVideoLicenceValid(value) {
    return value === null || initializers_1.VIDEO_LICENCES[value] !== undefined;
}
exports.isVideoLicenceValid = isVideoLicenceValid;
function isVideoLanguageValid(value) {
    return value === null ||
        (typeof value === 'string' && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.LANGUAGE));
}
exports.isVideoLanguageValid = isVideoLanguageValid;
function isVideoDurationValid(value) {
    return misc_1.exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.DURATION);
}
exports.isVideoDurationValid = isVideoDurationValid;
function isVideoTruncatedDescriptionValid(value) {
    return misc_1.exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.TRUNCATED_DESCRIPTION);
}
exports.isVideoTruncatedDescriptionValid = isVideoTruncatedDescriptionValid;
function isVideoDescriptionValid(value) {
    return value === null || (misc_1.exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION));
}
exports.isVideoDescriptionValid = isVideoDescriptionValid;
function isVideoSupportValid(value) {
    return value === null || (misc_1.exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.SUPPORT));
}
exports.isVideoSupportValid = isVideoSupportValid;
function isVideoNameValid(value) {
    return misc_1.exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.NAME);
}
exports.isVideoNameValid = isVideoNameValid;
function isVideoTagValid(tag) {
    return misc_1.exists(tag) && validator.isLength(tag, VIDEOS_CONSTRAINTS_FIELDS.TAG);
}
exports.isVideoTagValid = isVideoTagValid;
function isVideoTagsValid(tags) {
    return tags === null || (misc_1.isArray(tags) &&
        validator.isInt(tags.length.toString(), VIDEOS_CONSTRAINTS_FIELDS.TAGS) &&
        tags.every(tag => isVideoTagValid(tag)));
}
exports.isVideoTagsValid = isVideoTagsValid;
function isVideoViewsValid(value) {
    return misc_1.exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.VIEWS);
}
exports.isVideoViewsValid = isVideoViewsValid;
function isVideoRatingTypeValid(value) {
    return value === 'none' || lodash_1.values(initializers_1.VIDEO_RATE_TYPES).indexOf(value) !== -1;
}
exports.isVideoRatingTypeValid = isVideoRatingTypeValid;
const videoFileTypes = Object.keys(initializers_1.VIDEO_MIMETYPE_EXT).map(m => `(${m})`);
const videoFileTypesRegex = videoFileTypes.join('|');
function isVideoFile(files) {
    return misc_1.isFileValid(files, videoFileTypesRegex, 'videofile', null);
}
exports.isVideoFile = isVideoFile;
const videoImageTypes = initializers_1.CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME
    .map(v => v.replace('.', ''))
    .join('|');
const videoImageTypesRegex = `image/(${videoImageTypes})`;
function isVideoImage(files, field) {
    return misc_1.isFileValid(files, videoImageTypesRegex, field, initializers_1.CONSTRAINTS_FIELDS.VIDEOS.IMAGE.FILE_SIZE.max, true);
}
exports.isVideoImage = isVideoImage;
function isVideoPrivacyValid(value) {
    return validator.isInt(value + '') && initializers_1.VIDEO_PRIVACIES[value] !== undefined;
}
exports.isVideoPrivacyValid = isVideoPrivacyValid;
function isScheduleVideoUpdatePrivacyValid(value) {
    return validator.isInt(value + '') &&
        (value === shared_1.VideoPrivacy.UNLISTED ||
            value === shared_1.VideoPrivacy.PUBLIC);
}
exports.isScheduleVideoUpdatePrivacyValid = isScheduleVideoUpdatePrivacyValid;
function isVideoFileInfoHashValid(value) {
    return misc_1.exists(value) && validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.INFO_HASH);
}
exports.isVideoFileInfoHashValid = isVideoFileInfoHashValid;
function isVideoFileResolutionValid(value) {
    return misc_1.exists(value) && validator.isInt(value + '');
}
exports.isVideoFileResolutionValid = isVideoFileResolutionValid;
function isVideoFPSResolutionValid(value) {
    return value === null || validator.isInt(value + '');
}
exports.isVideoFPSResolutionValid = isVideoFPSResolutionValid;
function isVideoFileSizeValid(value) {
    return misc_1.exists(value) && validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.FILE_SIZE);
}
exports.isVideoFileSizeValid = isVideoFileSizeValid;
function isVideoMagnetUriValid(value) {
    if (!misc_1.exists(value))
        return false;
    const parsed = magnetUtil.decode(value);
    return parsed && isVideoFileInfoHashValid(parsed.infoHash);
}
exports.isVideoMagnetUriValid = isVideoMagnetUriValid;
function checkUserCanManageVideo(user, video, right, res) {
    if (video.isOwned() === false) {
        res.status(403)
            .json({ error: 'Cannot manage a video of another server.' })
            .end();
        return false;
    }
    const account = video.VideoChannel.Account;
    if (user.hasRight(right) === false && account.userId !== user.id) {
        res.status(403)
            .json({ error: 'Cannot manage a video of another user.' })
            .end();
        return false;
    }
    return true;
}
exports.checkUserCanManageVideo = checkUserCanManageVideo;
function isVideoExist(id, res, fetchType = 'all') {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = res.locals.oauth ? res.locals.oauth.token.User.id : undefined;
        const video = yield video_1.fetchVideo(id, fetchType, userId);
        if (video === null) {
            res.status(404)
                .json({ error: 'Video not found' })
                .end();
            return false;
        }
        if (fetchType !== 'none')
            res.locals.video = video;
        return true;
    });
}
exports.isVideoExist = isVideoExist;
function isVideoChannelOfAccountExist(channelId, user, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (user.hasRight(shared_1.UserRight.UPDATE_ANY_VIDEO) === true) {
            const videoChannel = yield video_channel_1.VideoChannelModel.loadAndPopulateAccount(channelId);
            if (videoChannel === null) {
                res.status(400)
                    .json({ error: 'Unknown video `video channel` on this instance.' })
                    .end();
                return false;
            }
            res.locals.videoChannel = videoChannel;
            return true;
        }
        const videoChannel = yield video_channel_1.VideoChannelModel.loadByIdAndAccount(channelId, user.Account.id);
        if (videoChannel === null) {
            res.status(400)
                .json({ error: 'Unknown video `video channel` for this account.' })
                .end();
            return false;
        }
        res.locals.videoChannel = videoChannel;
        return true;
    });
}
exports.isVideoChannelOfAccountExist = isVideoChannelOfAccountExist;
//# sourceMappingURL=videos.js.map