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
const database_utils_1 = require("../../../helpers/database-utils");
const initializers_1 = require("../../../initializers");
const account_video_rate_1 = require("../../../models/account/account-video-rate");
const utils_1 = require("../send/utils");
const videos_1 = require("../videos");
function processLikeActivity(activity, byActor) {
    return __awaiter(this, void 0, void 0, function* () {
        return database_utils_1.retryTransactionWrapper(processLikeVideo, byActor, activity);
    });
}
exports.processLikeActivity = processLikeActivity;
function processLikeVideo(byActor, activity) {
    return __awaiter(this, void 0, void 0, function* () {
        const videoUrl = activity.object;
        const byAccount = byActor.Account;
        if (!byAccount)
            throw new Error('Cannot create like with the non account actor ' + byActor.url);
        const { video } = yield videos_1.getOrCreateVideoAndAccountAndChannel({ videoObject: videoUrl });
        return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const rate = {
                type: 'like',
                videoId: video.id,
                accountId: byAccount.id
            };
            const [, created] = yield account_video_rate_1.AccountVideoRateModel.findOrCreate({
                where: rate,
                defaults: rate,
                transaction: t
            });
            if (created === true)
                yield video.increment('likes', { transaction: t });
            if (video.isOwned() && created === true) {
                const exceptions = [byActor];
                yield utils_1.forwardVideoRelatedActivity(activity, t, exceptions, video);
            }
        }));
    });
}
//# sourceMappingURL=process-like.js.map