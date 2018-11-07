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
const url_1 = require("../url");
const utils_1 = require("./utils");
const audience_1 = require("../audience");
const logger_1 = require("../../../helpers/logger");
function sendLike(byActor, video, t) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Creating job to like %s.', video.url);
        const activityBuilder = (audience) => {
            const url = url_1.getVideoLikeActivityPubUrl(byActor, video);
            return buildLikeActivity(url, byActor, video, audience);
        };
        return utils_1.sendVideoRelatedActivity(activityBuilder, { byActor, video, transaction: t });
    });
}
exports.sendLike = sendLike;
function buildLikeActivity(url, byActor, video, audience) {
    if (!audience)
        audience = audience_1.getAudience(byActor);
    return audience_1.audiencify({
        type: 'Like',
        id: url,
        actor: byActor.url,
        object: video.url
    }, audience);
}
exports.buildLikeActivity = buildLikeActivity;
//# sourceMappingURL=send-like.js.map