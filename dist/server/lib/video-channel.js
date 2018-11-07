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
const uuidv4 = require("uuid/v4");
const video_channel_1 = require("../models/video/video-channel");
const activitypub_1 = require("./activitypub");
function createVideoChannel(videoChannelInfo, account, t) {
    return __awaiter(this, void 0, void 0, function* () {
        const uuid = uuidv4();
        const url = activitypub_1.getVideoChannelActivityPubUrl(videoChannelInfo.name);
        const actorInstance = activitypub_1.buildActorInstance('Group', url, videoChannelInfo.name, uuid);
        const actorInstanceCreated = yield actorInstance.save({ transaction: t });
        const videoChannelData = {
            name: videoChannelInfo.displayName,
            description: videoChannelInfo.description,
            support: videoChannelInfo.support,
            accountId: account.id,
            actorId: actorInstanceCreated.id
        };
        const videoChannel = video_channel_1.VideoChannelModel.build(videoChannelData);
        const options = { transaction: t };
        const videoChannelCreated = yield videoChannel.save(options);
        videoChannelCreated.Account = account;
        videoChannelCreated.Actor = actorInstanceCreated;
        return videoChannelCreated;
    });
}
exports.createVideoChannel = createVideoChannel;
