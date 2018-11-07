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
const send_1 = require("./send");
const Bluebird = require("bluebird");
const actor_1 = require("./actor");
const account_video_rate_1 = require("../../models/account/account-video-rate");
const logger_1 = require("../../helpers/logger");
const initializers_1 = require("../../initializers");
function createRates(actorUrls, video, rate) {
    return __awaiter(this, void 0, void 0, function* () {
        let rateCounts = 0;
        yield Bluebird.map(actorUrls, (actorUrl) => __awaiter(this, void 0, void 0, function* () {
            try {
                const actor = yield actor_1.getOrCreateActorAndServerAndModel(actorUrl);
                const [, created] = yield account_video_rate_1.AccountVideoRateModel
                    .findOrCreate({
                    where: {
                        videoId: video.id,
                        accountId: actor.Account.id
                    },
                    defaults: {
                        videoId: video.id,
                        accountId: actor.Account.id,
                        type: rate
                    }
                });
                if (created)
                    rateCounts += 1;
            }
            catch (err) {
                logger_1.logger.warn('Cannot add rate %s for actor %s.', rate, actorUrl, { err });
            }
        }), { concurrency: initializers_1.CRAWL_REQUEST_CONCURRENCY });
        logger_1.logger.info('Adding %d %s to video %s.', rateCounts, rate, video.uuid);
        if (rateCounts !== 0)
            yield video.increment(rate + 's', { by: rateCounts });
        return;
    });
}
exports.createRates = createRates;
function sendVideoRateChange(account, video, likes, dislikes, t) {
    return __awaiter(this, void 0, void 0, function* () {
        const actor = account.Actor;
        if (likes < 0)
            yield send_1.sendUndoLike(actor, video, t);
        if (dislikes < 0)
            yield send_1.sendUndoDislike(actor, video, t);
        if (likes > 0)
            yield send_1.sendLike(actor, video, t);
        if (dislikes > 0)
            yield send_1.sendCreateDislike(actor, video, t);
    });
}
exports.sendVideoRateChange = sendVideoRateChange;
//# sourceMappingURL=video-rates.js.map