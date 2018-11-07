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
const video_channel_1 = require("../../models/video/video-channel");
const misc_1 = require("./misc");
const VIDEO_CHANNELS_CONSTRAINTS_FIELDS = initializers_1.CONSTRAINTS_FIELDS.VIDEO_CHANNELS;
function isVideoChannelDescriptionValid(value) {
    return value === null || validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.DESCRIPTION);
}
exports.isVideoChannelDescriptionValid = isVideoChannelDescriptionValid;
function isVideoChannelNameValid(value) {
    return misc_1.exists(value) && validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.NAME);
}
exports.isVideoChannelNameValid = isVideoChannelNameValid;
function isVideoChannelSupportValid(value) {
    return value === null || (misc_1.exists(value) && validator.isLength(value, VIDEO_CHANNELS_CONSTRAINTS_FIELDS.SUPPORT));
}
exports.isVideoChannelSupportValid = isVideoChannelSupportValid;
function isLocalVideoChannelNameExist(name, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoChannel = yield video_channel_1.VideoChannelModel.loadLocalByNameAndPopulateAccount(name);
        return processVideoChannelExist(videoChannel, res);
    });
}
exports.isLocalVideoChannelNameExist = isLocalVideoChannelNameExist;
function isVideoChannelIdExist(id, res) {
    return __awaiter(this, void 0, void 0, function* () {
        let videoChannel;
        if (validator.isInt(id)) {
            videoChannel = yield video_channel_1.VideoChannelModel.loadAndPopulateAccount(+id);
        }
        else {
            videoChannel = yield video_channel_1.VideoChannelModel.loadByUUIDAndPopulateAccount(id);
        }
        return processVideoChannelExist(videoChannel, res);
    });
}
exports.isVideoChannelIdExist = isVideoChannelIdExist;
function isVideoChannelNameWithHostExist(nameWithDomain, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const [name, host] = nameWithDomain.split('@');
        let videoChannel;
        if (!host || host === initializers_1.CONFIG.WEBSERVER.HOST)
            videoChannel = yield video_channel_1.VideoChannelModel.loadLocalByNameAndPopulateAccount(name);
        else
            videoChannel = yield video_channel_1.VideoChannelModel.loadByNameAndHostAndPopulateAccount(name, host);
        return processVideoChannelExist(videoChannel, res);
    });
}
exports.isVideoChannelNameWithHostExist = isVideoChannelNameWithHostExist;
function processVideoChannelExist(videoChannel, res) {
    if (!videoChannel) {
        res.status(404)
            .json({ error: 'Video channel not found' })
            .end();
        return false;
    }
    res.locals.videoChannel = videoChannel;
    return true;
}
//# sourceMappingURL=video-channels.js.map