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
const express_utils_1 = require("../../helpers/express-utils");
const utils_1 = require("../../helpers/utils");
const video_1 = require("../../models/video/video");
const middlewares_1 = require("../../middlewares");
const activitypub_1 = require("../../lib/activitypub");
const logger_1 = require("../../helpers/logger");
const video_channel_1 = require("../../models/video/video-channel");
const webfinger_1 = require("../../helpers/webfinger");
const searchRouter = express.Router();
exports.searchRouter = searchRouter;
searchRouter.get('/videos', middlewares_1.paginationValidator, middlewares_1.setDefaultPagination, middlewares_1.videosSearchSortValidator, middlewares_1.setDefaultSearchSort, middlewares_1.optionalAuthenticate, middlewares_1.commonVideosFiltersValidator, middlewares_1.videosSearchValidator, middlewares_1.asyncMiddleware(searchVideos));
searchRouter.get('/video-channels', middlewares_1.paginationValidator, middlewares_1.setDefaultPagination, middlewares_1.videoChannelsSearchSortValidator, middlewares_1.setDefaultSearchSort, middlewares_1.optionalAuthenticate, middlewares_1.videoChannelsSearchValidator, middlewares_1.asyncMiddleware(searchVideoChannels));
function searchVideoChannels(req, res) {
    const query = req.query;
    const search = query.search;
    const isURISearch = search.startsWith('http://') || search.startsWith('https://');
    const parts = search.split('@');
    if (parts.length === 3 && parts[0].length === 0)
        parts.shift();
    const isWebfingerSearch = parts.length === 2 && parts.every(p => p.indexOf(' ') === -1);
    if (isURISearch || isWebfingerSearch)
        return searchVideoChannelURI(search, isWebfingerSearch, res);
    return searchVideoChannelsDB(query, res);
}
function searchVideoChannelsDB(query, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const serverActor = yield utils_1.getServerActor();
        const options = {
            actorId: serverActor.id,
            search: query.search,
            start: query.start,
            count: query.count,
            sort: query.sort
        };
        const resultList = yield video_channel_1.VideoChannelModel.searchForApi(options);
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function searchVideoChannelURI(search, isWebfingerSearch, res) {
    return __awaiter(this, void 0, void 0, function* () {
        let videoChannel;
        let uri = search;
        if (isWebfingerSearch)
            uri = yield webfinger_1.loadActorUrlOrGetFromWebfinger(search);
        if (express_utils_1.isUserAbleToSearchRemoteURI(res)) {
            try {
                const actor = yield activitypub_1.getOrCreateActorAndServerAndModel(uri, 'all', true, true);
                videoChannel = actor.VideoChannel;
            }
            catch (err) {
                logger_1.logger.info('Cannot search remote video channel %s.', uri, { err });
            }
        }
        else {
            videoChannel = yield video_channel_1.VideoChannelModel.loadByUrlAndPopulateAccount(uri);
        }
        return res.json({
            total: videoChannel ? 1 : 0,
            data: videoChannel ? [videoChannel.toFormattedJSON()] : []
        });
    });
}
function searchVideos(req, res) {
    const query = req.query;
    const search = query.search;
    if (search && (search.startsWith('http://') || search.startsWith('https://'))) {
        return searchVideoURI(search, res);
    }
    return searchVideosDB(query, res);
}
function searchVideosDB(query, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = Object.assign(query, {
            includeLocalVideos: true,
            nsfw: express_utils_1.buildNSFWFilter(res, query.nsfw),
            filter: query.filter,
            user: res.locals.oauth ? res.locals.oauth.token.User : undefined
        });
        const resultList = yield video_1.VideoModel.searchAndPopulateAccountAndServer(options);
        return res.json(utils_1.getFormattedObjects(resultList.data, resultList.total));
    });
}
function searchVideoURI(url, res) {
    return __awaiter(this, void 0, void 0, function* () {
        let video;
        if (express_utils_1.isUserAbleToSearchRemoteURI(res)) {
            try {
                const syncParam = {
                    likes: false,
                    dislikes: false,
                    shares: false,
                    comments: false,
                    thumbnail: true,
                    refreshVideo: false
                };
                const result = yield activitypub_1.getOrCreateVideoAndAccountAndChannel({ videoObject: url, syncParam });
                video = result ? result.video : undefined;
            }
            catch (err) {
                logger_1.logger.info('Cannot search remote video %s.', url, { err });
            }
        }
        else {
            video = yield video_1.VideoModel.loadByUrlAndPopulateAccount(url);
        }
        return res.json({
            total: video ? 1 : 0,
            data: video ? [video.toFormattedJSON()] : []
        });
    });
}
//# sourceMappingURL=search.js.map