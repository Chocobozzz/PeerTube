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
const utils_1 = require("./utils");
const audience_1 = require("../audience");
const logger_1 = require("../../../helpers/logger");
function buildAnnounceWithVideoAudience(byActor, videoShare, video, t) {
    return __awaiter(this, void 0, void 0, function* () {
        const announcedObject = video.url;
        const actorsInvolvedInVideo = yield audience_1.getActorsInvolvedInVideo(video, t);
        const audience = audience_1.getAudienceFromFollowersOf(actorsInvolvedInVideo);
        const activity = buildAnnounceActivity(videoShare.url, byActor, announcedObject, audience);
        return { activity, actorsInvolvedInVideo };
    });
}
exports.buildAnnounceWithVideoAudience = buildAnnounceWithVideoAudience;
function sendVideoAnnounce(byActor, videoShare, video, t) {
    return __awaiter(this, void 0, void 0, function* () {
        const { activity, actorsInvolvedInVideo } = yield buildAnnounceWithVideoAudience(byActor, videoShare, video, t);
        logger_1.logger.info('Creating job to send announce %s.', videoShare.url);
        const followersException = [byActor];
        return utils_1.broadcastToFollowers(activity, byActor, actorsInvolvedInVideo, t, followersException);
    });
}
exports.sendVideoAnnounce = sendVideoAnnounce;
function buildAnnounceActivity(url, byActor, object, audience) {
    if (!audience)
        audience = audience_1.getAudience(byActor);
    return audience_1.audiencify({
        type: 'Announce',
        id: url,
        actor: byActor.url,
        object
    }, audience);
}
exports.buildAnnounceActivity = buildAnnounceActivity;
