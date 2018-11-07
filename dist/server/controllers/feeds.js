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
const constants_1 = require("../initializers/constants");
const initializers_1 = require("../initializers");
const middlewares_1 = require("../middlewares");
const video_1 = require("../models/video/video");
const Feed = require("pfeed");
const cache_1 = require("../middlewares/cache");
const video_comment_1 = require("../models/video/video-comment");
const express_utils_1 = require("../helpers/express-utils");
const feedsRouter = express.Router();
exports.feedsRouter = feedsRouter;
feedsRouter.get('/feeds/video-comments.:format', middlewares_1.asyncMiddleware(cache_1.cacheRoute(constants_1.ROUTE_CACHE_LIFETIME.FEEDS)), middlewares_1.asyncMiddleware(middlewares_1.videoCommentsFeedsValidator), middlewares_1.asyncMiddleware(generateVideoCommentsFeed));
feedsRouter.get('/feeds/videos.:format', middlewares_1.videosSortValidator, middlewares_1.setDefaultSort, middlewares_1.asyncMiddleware(cache_1.cacheRoute(constants_1.ROUTE_CACHE_LIFETIME.FEEDS)), middlewares_1.commonVideosFiltersValidator, middlewares_1.asyncMiddleware(middlewares_1.videoFeedsValidator), middlewares_1.asyncMiddleware(generateVideoFeed));
function generateVideoCommentsFeed(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const start = 0;
        const video = res.locals.video;
        const videoId = video ? video.id : undefined;
        const comments = yield video_comment_1.VideoCommentModel.listForFeed(start, constants_1.FEEDS.COUNT, videoId);
        const name = video ? video.name : constants_1.CONFIG.INSTANCE.NAME;
        const description = video ? video.description : constants_1.CONFIG.INSTANCE.DESCRIPTION;
        const feed = initFeed(name, description);
        comments.forEach(comment => {
            const link = constants_1.CONFIG.WEBSERVER.URL + '/videos/watch/' + comment.Video.uuid + ';threadId=' + comment.getThreadId();
            feed.addItem({
                title: `${comment.Video.name} - ${comment.Account.getDisplayName()}`,
                id: comment.url,
                link,
                content: comment.text,
                author: [
                    {
                        name: comment.Account.getDisplayName(),
                        link: comment.Account.Actor.url
                    }
                ],
                date: comment.createdAt
            });
        });
        return sendFeed(feed, req, res);
    });
}
function generateVideoFeed(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const start = 0;
        const account = res.locals.account;
        const videoChannel = res.locals.videoChannel;
        const nsfw = express_utils_1.buildNSFWFilter(res, req.query.nsfw);
        let name;
        let description;
        if (videoChannel) {
            name = videoChannel.getDisplayName();
            description = videoChannel.description;
        }
        else if (account) {
            name = account.getDisplayName();
            description = account.description;
        }
        else {
            name = constants_1.CONFIG.INSTANCE.NAME;
            description = constants_1.CONFIG.INSTANCE.DESCRIPTION;
        }
        const feed = initFeed(name, description);
        const resultList = yield video_1.VideoModel.listForApi({
            start,
            count: constants_1.FEEDS.COUNT,
            sort: req.query.sort,
            includeLocalVideos: true,
            nsfw,
            filter: req.query.filter,
            withFiles: true,
            accountId: account ? account.id : null,
            videoChannelId: videoChannel ? videoChannel.id : null
        });
        resultList.data.forEach(video => {
            const formattedVideoFiles = video.getFormattedVideoFilesJSON();
            const torrents = formattedVideoFiles.map(videoFile => ({
                title: video.name,
                url: videoFile.torrentUrl,
                size_in_bytes: videoFile.size
            }));
            feed.addItem({
                title: video.name,
                id: video.url,
                link: constants_1.CONFIG.WEBSERVER.URL + '/videos/watch/' + video.uuid,
                description: video.getTruncatedDescription(),
                content: video.description,
                author: [
                    {
                        name: video.VideoChannel.Account.getDisplayName(),
                        link: video.VideoChannel.Account.Actor.url
                    }
                ],
                date: video.publishedAt,
                language: video.language,
                nsfw: video.nsfw,
                torrent: torrents,
                thumbnail: [
                    {
                        url: constants_1.CONFIG.WEBSERVER.URL + video.getThumbnailStaticPath(),
                        height: initializers_1.THUMBNAILS_SIZE.height,
                        width: initializers_1.THUMBNAILS_SIZE.width
                    }
                ]
            });
        });
        return sendFeed(feed, req, res);
    });
}
function initFeed(name, description) {
    const webserverUrl = constants_1.CONFIG.WEBSERVER.URL;
    return new Feed({
        title: name,
        description,
        id: webserverUrl,
        link: webserverUrl,
        image: webserverUrl + '/client/assets/images/icons/icon-96x96.png',
        favicon: webserverUrl + '/client/assets/images/favicon.png',
        copyright: `All rights reserved, unless otherwise specified in the terms specified at ${webserverUrl}/about` +
            ` and potential licenses granted by each content's rightholder.`,
        generator: `Toraifōsu`,
        feedLinks: {
            json: `${webserverUrl}/feeds/videos.json`,
            atom: `${webserverUrl}/feeds/videos.atom`,
            rss: `${webserverUrl}/feeds/videos.xml`
        },
        author: {
            name: 'Instance admin of ' + constants_1.CONFIG.INSTANCE.NAME,
            email: constants_1.CONFIG.ADMIN.EMAIL,
            link: `${webserverUrl}/about`
        }
    });
}
function sendFeed(feed, req, res) {
    const format = req.params.format;
    if (format === 'atom' || format === 'atom1') {
        res.set('Content-Type', 'application/atom+xml');
        return res.send(feed.atom1()).end();
    }
    if (format === 'json' || format === 'json1') {
        res.set('Content-Type', 'application/json');
        return res.send(feed.json1()).end();
    }
    if (format === 'rss' || format === 'rss2') {
        res.set('Content-Type', 'application/rss+xml');
        return res.send(feed.rss2()).end();
    }
    if (req.query.format === 'atom' || req.query.format === 'atom1') {
        res.set('Content-Type', 'application/atom+xml');
        return res.send(feed.atom1()).end();
    }
    res.set('Content-Type', 'application/rss+xml');
    return res.send(feed.rss2()).end();
}
//# sourceMappingURL=feeds.js.map