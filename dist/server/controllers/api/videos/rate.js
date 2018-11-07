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
const express = require("express");
const logger_1 = require("../../../helpers/logger");
const initializers_1 = require("../../../initializers");
const activitypub_1 = require("../../../lib/activitypub");
const middlewares_1 = require("../../../middlewares");
const account_1 = require("../../../models/account/account");
const account_video_rate_1 = require("../../../models/account/account-video-rate");
const rateVideoRouter = express.Router();
exports.rateVideoRouter = rateVideoRouter;
rateVideoRouter.put('/:id/rate', middlewares_1.authenticate, middlewares_1.asyncMiddleware(middlewares_1.videoRateValidator), middlewares_1.asyncRetryTransactionMiddleware(rateVideo));
function rateVideo(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const body = req.body;
        const rateType = body.rating;
        const videoInstance = res.locals.video;
        yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const sequelizeOptions = { transaction: t };
            const accountInstance = yield account_1.AccountModel.load(res.locals.oauth.token.User.Account.id, t);
            const previousRate = yield account_video_rate_1.AccountVideoRateModel.load(accountInstance.id, videoInstance.id, t);
            let likesToIncrement = 0;
            let dislikesToIncrement = 0;
            if (rateType === initializers_1.VIDEO_RATE_TYPES.LIKE)
                likesToIncrement++;
            else if (rateType === initializers_1.VIDEO_RATE_TYPES.DISLIKE)
                dislikesToIncrement++;
            if (previousRate) {
                if (previousRate.type === initializers_1.VIDEO_RATE_TYPES.LIKE)
                    likesToIncrement--;
                else if (previousRate.type === initializers_1.VIDEO_RATE_TYPES.DISLIKE)
                    dislikesToIncrement--;
                if (rateType === 'none') {
                    yield previousRate.destroy(sequelizeOptions);
                }
                else {
                    previousRate.type = rateType;
                    yield previousRate.save(sequelizeOptions);
                }
            }
            else if (rateType !== 'none') {
                const query = {
                    accountId: accountInstance.id,
                    videoId: videoInstance.id,
                    type: rateType
                };
                yield account_video_rate_1.AccountVideoRateModel.create(query, sequelizeOptions);
            }
            const incrementQuery = {
                likes: likesToIncrement,
                dislikes: dislikesToIncrement
            };
            yield videoInstance.increment(incrementQuery, sequelizeOptions);
            yield activitypub_1.sendVideoRateChange(accountInstance, videoInstance, likesToIncrement, dislikesToIncrement, t);
            logger_1.logger.info('Account video rate for video %s of account %s updated.', videoInstance.name, accountInstance.name);
        }));
        return res.type('json').status(204).end();
    });
}
