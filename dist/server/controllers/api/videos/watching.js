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
const middlewares_1 = require("../../../middlewares");
const user_video_history_1 = require("../../../models/account/user-video-history");
const watchingRouter = express.Router();
exports.watchingRouter = watchingRouter;
watchingRouter.put('/:videoId/watching', middlewares_1.authenticate, middlewares_1.asyncMiddleware(middlewares_1.videoWatchingValidator), middlewares_1.asyncRetryTransactionMiddleware(userWatchVideo));
function userWatchVideo(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = res.locals.oauth.token.User;
        const body = req.body;
        const { id: videoId } = res.locals.video;
        yield user_video_history_1.UserVideoHistoryModel.upsert({
            videoId,
            userId: user.id,
            currentTime: body.currentTime
        });
        return res.type('json').status(204).end();
    });
}
