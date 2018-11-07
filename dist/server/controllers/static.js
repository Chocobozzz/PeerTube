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
const cors = require("cors");
const express = require("express");
const initializers_1 = require("../initializers");
const cache_1 = require("../lib/cache");
const cache_2 = require("../middlewares/cache");
const middlewares_1 = require("../middlewares");
const video_1 = require("../models/video/video");
const videos_caption_cache_1 = require("../lib/cache/videos-caption-cache");
const user_1 = require("../models/account/user");
const video_comment_1 = require("../models/video/video-comment");
const path_1 = require("path");
const core_utils_1 = require("../helpers/core-utils");
const packageJSON = require('../../../package.json');
const staticRouter = express.Router();
exports.staticRouter = staticRouter;
staticRouter.use(cors());
const torrentsPhysicalPath = initializers_1.CONFIG.STORAGE.TORRENTS_DIR;
staticRouter.use(initializers_1.STATIC_PATHS.TORRENTS, cors(), express.static(torrentsPhysicalPath, { maxAge: 0 }));
staticRouter.use(initializers_1.STATIC_DOWNLOAD_PATHS.TORRENTS + ':id-:resolution([0-9]+).torrent', middlewares_1.asyncMiddleware(middlewares_1.videosGetValidator), middlewares_1.asyncMiddleware(downloadTorrent));
const videosPhysicalPath = initializers_1.CONFIG.STORAGE.VIDEOS_DIR;
staticRouter.use(initializers_1.STATIC_PATHS.WEBSEED, cors(), express.static(videosPhysicalPath));
staticRouter.use(initializers_1.STATIC_DOWNLOAD_PATHS.VIDEOS + ':id-:resolution([0-9]+).:extension', middlewares_1.asyncMiddleware(middlewares_1.videosGetValidator), middlewares_1.asyncMiddleware(downloadVideoFile));
const thumbnailsPhysicalPath = initializers_1.CONFIG.STORAGE.THUMBNAILS_DIR;
staticRouter.use(initializers_1.STATIC_PATHS.THUMBNAILS, express.static(thumbnailsPhysicalPath, { maxAge: initializers_1.STATIC_MAX_AGE, fallthrough: false }));
const avatarsPhysicalPath = initializers_1.CONFIG.STORAGE.AVATARS_DIR;
staticRouter.use(initializers_1.STATIC_PATHS.AVATARS, express.static(avatarsPhysicalPath, { maxAge: initializers_1.STATIC_MAX_AGE, fallthrough: false }));
staticRouter.use(initializers_1.STATIC_PATHS.PREVIEWS + ':uuid.jpg', middlewares_1.asyncMiddleware(getPreview));
staticRouter.use(initializers_1.STATIC_PATHS.VIDEO_CAPTIONS + ':videoId-:captionLanguage([a-z]+).vtt', middlewares_1.asyncMiddleware(getVideoCaption));
staticRouter.get('/robots.txt', middlewares_1.asyncMiddleware(cache_2.cacheRoute(initializers_1.ROUTE_CACHE_LIFETIME.ROBOTS)), (_, res) => {
    res.type('text/plain');
    return res.send(initializers_1.CONFIG.INSTANCE.ROBOTS);
});
staticRouter.get('/security.txt', (_, res) => {
    return res.redirect(301, '/.well-known/security.txt');
});
staticRouter.get('/.well-known/security.txt', middlewares_1.asyncMiddleware(cache_2.cacheRoute(initializers_1.ROUTE_CACHE_LIFETIME.SECURITYTXT)), (_, res) => {
    res.type('text/plain');
    return res.send(initializers_1.CONFIG.INSTANCE.SECURITYTXT + initializers_1.CONFIG.INSTANCE.SECURITYTXT_CONTACT);
});
staticRouter.use('/.well-known/nodeinfo', middlewares_1.asyncMiddleware(cache_2.cacheRoute(initializers_1.ROUTE_CACHE_LIFETIME.NODEINFO)), (_, res) => {
    return res.json({
        links: [
            {
                rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
                href: initializers_1.CONFIG.WEBSERVER.URL + '/nodeinfo/2.0.json'
            }
        ]
    });
});
staticRouter.use('/nodeinfo/:version.json', middlewares_1.asyncMiddleware(cache_2.cacheRoute(initializers_1.ROUTE_CACHE_LIFETIME.NODEINFO)), middlewares_1.asyncMiddleware(generateNodeinfo));
staticRouter.use('/.well-known/dnt-policy.txt', middlewares_1.asyncMiddleware(cache_2.cacheRoute(initializers_1.ROUTE_CACHE_LIFETIME.DNT_POLICY)), (_, res) => {
    res.type('text/plain');
    return res.sendFile(path_1.join(core_utils_1.root(), 'dist/server/static/dnt-policy/dnt-policy-1.0.txt'));
});
staticRouter.use('/.well-known/dnt/', (_, res) => {
    res.json({ tracking: 'N' });
});
function getPreview(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const path = yield cache_1.VideosPreviewCache.Instance.getFilePath(req.params.uuid);
        if (!path)
            return res.sendStatus(404);
        return res.sendFile(path, { maxAge: initializers_1.STATIC_MAX_AGE });
    });
}
function getVideoCaption(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const path = yield videos_caption_cache_1.VideosCaptionCache.Instance.getFilePath({
            videoId: req.params.videoId,
            language: req.params.captionLanguage
        });
        if (!path)
            return res.sendStatus(404);
        return res.sendFile(path, { maxAge: initializers_1.STATIC_MAX_AGE });
    });
}
function generateNodeinfo(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const { totalVideos } = yield video_1.VideoModel.getStats();
        const { totalLocalVideoComments } = yield video_comment_1.VideoCommentModel.getStats();
        const { totalUsers } = yield user_1.UserModel.getStats();
        let json = {};
        if (req.params.version && (req.params.version === '2.0')) {
            json = {
                version: '2.0',
                software: {
                    name: 'peertube',
                    version: packageJSON.version
                },
                protocols: [
                    'activitypub'
                ],
                services: {
                    inbound: [],
                    outbound: [
                        'atom1.0',
                        'rss2.0'
                    ]
                },
                openRegistrations: initializers_1.CONFIG.SIGNUP.ENABLED,
                usage: {
                    users: {
                        total: totalUsers
                    },
                    localPosts: totalVideos,
                    localComments: totalLocalVideoComments
                },
                metadata: {
                    taxonomy: {
                        postsName: 'Videos'
                    },
                    nodeName: initializers_1.CONFIG.INSTANCE.NAME,
                    nodeDescription: initializers_1.CONFIG.INSTANCE.SHORT_DESCRIPTION
                }
            };
            res.contentType('application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.0#"');
        }
        else {
            json = { error: 'Nodeinfo schema version not handled' };
            res.status(404);
        }
        return res.send(json).end();
    });
}
function downloadTorrent(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const { video, videoFile } = getVideoAndFile(req, res);
        if (!videoFile)
            return res.status(404).end();
        return res.download(video.getTorrentFilePath(videoFile), `${video.name}-${videoFile.resolution}p.torrent`);
    });
}
function downloadVideoFile(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const { video, videoFile } = getVideoAndFile(req, res);
        if (!videoFile)
            return res.status(404).end();
        return res.download(video.getVideoFilePath(videoFile), `${video.name}-${videoFile.resolution}p${videoFile.extname}`);
    });
}
function getVideoAndFile(req, res) {
    const resolution = parseInt(req.params.resolution, 10);
    const video = res.locals.video;
    const videoFile = video.VideoFiles.find(f => f.resolution === resolution);
    return { video, videoFile };
}
