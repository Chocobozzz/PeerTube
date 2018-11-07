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
const utils_1 = require("../../helpers/utils");
const middlewares_1 = require("../../middlewares");
const validators_1 = require("../../middlewares/validators");
const account_1 = require("../../models/account/account");
const video_1 = require("../../models/video/video");
const express_utils_1 = require("../../helpers/express-utils");
const video_channel_1 = require("../../models/video/video-channel");
const accountsRouter = express.Router();
exports.accountsRouter = accountsRouter;
accountsRouter.get('/', middlewares_1.paginationValidator, validators_1.accountsSortValidator, middlewares_1.setDefaultSort, middlewares_1.setDefaultPagination, middlewares_1.asyncMiddleware(listAccounts));
accountsRouter.get('/:accountName', middlewares_1.asyncMiddleware(validators_1.accountsNameWithHostGetValidator), getAccount);
accountsRouter.get('/:accountName/videos', middlewares_1.asyncMiddleware(validators_1.accountsNameWithHostGetValidator), middlewares_1.paginationValidator, validators_1.videosSortValidator, middlewares_1.setDefaultSort, middlewares_1.setDefaultPagination, middlewares_1.optionalAuthenticate, middlewares_1.commonVideosFiltersValidator, middlewares_1.asyncMiddleware(listAccountVideos));
accountsRouter.get('/:accountName/video-channels', middlewares_1.asyncMiddleware(middlewares_1.listVideoAccountChannelsValidator), middlewares_1.asyncMiddleware(listVideoAccountChannels));
function getAccount(req, res, next) {
    const account = res.locals.account;
    return res.json(account.toFormattedJSON());
}
function listAccounts(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const resultList = yield account_1.AccountModel.listForApi(req.query.start, req.query.count, req.query.sort);
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function listVideoAccountChannels(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const resultList = yield video_channel_1.VideoChannelModel.listByAccount(res.locals.account.id);
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function listAccountVideos(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const account = res.locals.account;
        const actorId = express_utils_1.isUserAbleToSearchRemoteURI(res) ? null : undefined;
        const resultList = yield video_1.VideoModel.listForApi({
            actorId,
            start: req.query.start,
            count: req.query.count,
            sort: req.query.sort,
            includeLocalVideos: true,
            categoryOneOf: req.query.categoryOneOf,
            licenceOneOf: req.query.licenceOneOf,
            languageOneOf: req.query.languageOneOf,
            tagsOneOf: req.query.tagsOneOf,
            tagsAllOf: req.query.tagsAllOf,
            filter: req.query.filter,
            nsfw: express_utils_1.buildNSFWFilter(res, req.query.nsfw),
            withFiles: false,
            accountId: account.id,
            user: res.locals.oauth ? res.locals.oauth.token.User : undefined
        });
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
//# sourceMappingURL=accounts.js.map