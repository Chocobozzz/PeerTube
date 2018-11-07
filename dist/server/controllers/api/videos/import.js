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
const magnetUtil = require("magnet-uri");
require("multer");
const audit_logger_1 = require("../../../helpers/audit-logger");
const middlewares_1 = require("../../../middlewares");
const initializers_1 = require("../../../initializers");
const youtube_dl_1 = require("../../../helpers/youtube-dl");
const express_utils_1 = require("../../../helpers/express-utils");
const logger_1 = require("../../../helpers/logger");
const shared_1 = require("../../../../shared");
const video_1 = require("../../../models/video/video");
const activitypub_1 = require("../../../lib/activitypub");
const tag_1 = require("../../../models/video/tag");
const video_import_1 = require("../../../models/video/video-import");
const job_queue_1 = require("../../../lib/job-queue/job-queue");
const image_utils_1 = require("../../../helpers/image-utils");
const path_1 = require("path");
const misc_1 = require("../../../helpers/custom-validators/misc");
const parseTorrent = require("parse-torrent");
const utils_1 = require("../../../helpers/utils");
const fs_extra_1 = require("fs-extra");
const auditLogger = audit_logger_1.auditLoggerFactory('video-imports');
const videoImportsRouter = express.Router();
exports.videoImportsRouter = videoImportsRouter;
const reqVideoFileImport = express_utils_1.createReqFiles(['thumbnailfile', 'previewfile', 'torrentfile'], Object.assign({}, initializers_1.TORRENT_MIMETYPE_EXT, initializers_1.IMAGE_MIMETYPE_EXT), {
    thumbnailfile: initializers_1.CONFIG.STORAGE.THUMBNAILS_DIR,
    previewfile: initializers_1.CONFIG.STORAGE.PREVIEWS_DIR,
    torrentfile: initializers_1.CONFIG.STORAGE.TORRENTS_DIR
});
videoImportsRouter.post('/imports', middlewares_1.authenticate, reqVideoFileImport, middlewares_1.asyncMiddleware(middlewares_1.videoImportAddValidator), middlewares_1.asyncRetryTransactionMiddleware(addVideoImport));
function addVideoImport(req, res) {
    if (req.body.targetUrl)
        return addYoutubeDLImport(req, res);
    const file = req.files && req.files['torrentfile'] ? req.files['torrentfile'][0] : undefined;
    if (req.body.magnetUri || file)
        return addTorrentImport(req, res, file);
}
function addTorrentImport(req, res, torrentfile) {
    return __awaiter(this, void 0, void 0, function* () {
        const body = req.body;
        const user = res.locals.oauth.token.User;
        let videoName;
        let torrentName;
        let magnetUri;
        if (torrentfile) {
            torrentName = torrentfile.originalname;
            const newTorrentPath = path_1.join(initializers_1.CONFIG.STORAGE.TORRENTS_DIR, utils_1.getSecureTorrentName(torrentName));
            yield fs_extra_1.rename(torrentfile.path, newTorrentPath);
            torrentfile.path = newTorrentPath;
            const buf = yield fs_extra_1.readFile(torrentfile.path);
            const parsedTorrent = parseTorrent(buf);
            videoName = misc_1.isArray(parsedTorrent.name) ? parsedTorrent.name[0] : parsedTorrent.name;
        }
        else {
            magnetUri = body.magnetUri;
            const parsed = magnetUtil.decode(magnetUri);
            videoName = misc_1.isArray(parsed.name) ? parsed.name[0] : parsed.name;
        }
        const video = buildVideo(res.locals.videoChannel.id, body, { name: videoName });
        yield processThumbnail(req, video);
        yield processPreview(req, video);
        const tags = body.tags || undefined;
        const videoImportAttributes = {
            magnetUri,
            torrentName,
            state: shared_1.VideoImportState.PENDING,
            userId: user.id
        };
        const videoImport = yield insertIntoDB(video, res.locals.videoChannel, tags, videoImportAttributes);
        const payload = {
            type: torrentfile ? 'torrent-file' : 'magnet-uri',
            videoImportId: videoImport.id,
            magnetUri
        };
        yield job_queue_1.JobQueue.Instance.createJob({ type: 'video-import', payload });
        auditLogger.create(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.VideoImportAuditView(videoImport.toFormattedJSON()));
        return res.json(videoImport.toFormattedJSON()).end();
    });
}
function addYoutubeDLImport(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const body = req.body;
        const targetUrl = body.targetUrl;
        const user = res.locals.oauth.token.User;
        let youtubeDLInfo;
        try {
            youtubeDLInfo = yield youtube_dl_1.getYoutubeDLInfo(targetUrl);
        }
        catch (err) {
            logger_1.logger.info('Cannot fetch information from import for URL %s.', targetUrl, { err });
            return res.status(400).json({
                error: 'Cannot fetch remote information of this URL.'
            }).end();
        }
        const video = buildVideo(res.locals.videoChannel.id, body, youtubeDLInfo);
        const downloadThumbnail = !(yield processThumbnail(req, video));
        const downloadPreview = !(yield processPreview(req, video));
        const tags = body.tags || youtubeDLInfo.tags;
        const videoImportAttributes = {
            targetUrl,
            state: shared_1.VideoImportState.PENDING,
            userId: user.id
        };
        const videoImport = yield insertIntoDB(video, res.locals.videoChannel, tags, videoImportAttributes);
        const payload = {
            type: 'youtube-dl',
            videoImportId: videoImport.id,
            thumbnailUrl: youtubeDLInfo.thumbnailUrl,
            downloadThumbnail,
            downloadPreview
        };
        yield job_queue_1.JobQueue.Instance.createJob({ type: 'video-import', payload });
        auditLogger.create(audit_logger_1.getAuditIdFromRes(res), new audit_logger_1.VideoImportAuditView(videoImport.toFormattedJSON()));
        return res.json(videoImport.toFormattedJSON()).end();
    });
}
function buildVideo(channelId, body, importData) {
    const videoData = {
        name: body.name || importData.name || 'Unknown name',
        remote: false,
        category: body.category || importData.category,
        licence: body.licence || importData.licence,
        language: body.language || undefined,
        commentsEnabled: body.commentsEnabled || true,
        waitTranscoding: body.waitTranscoding || false,
        state: shared_1.VideoState.TO_IMPORT,
        nsfw: body.nsfw || importData.nsfw || false,
        description: body.description || importData.description,
        support: body.support || null,
        privacy: body.privacy || shared_1.VideoPrivacy.PRIVATE,
        duration: 0,
        channelId: channelId
    };
    const video = new video_1.VideoModel(videoData);
    video.url = activitypub_1.getVideoActivityPubUrl(video);
    return video;
}
function processThumbnail(req, video) {
    return __awaiter(this, void 0, void 0, function* () {
        const thumbnailField = req.files ? req.files['thumbnailfile'] : undefined;
        if (thumbnailField) {
            const thumbnailPhysicalFile = thumbnailField[0];
            yield image_utils_1.processImage(thumbnailPhysicalFile, path_1.join(initializers_1.CONFIG.STORAGE.THUMBNAILS_DIR, video.getThumbnailName()), initializers_1.THUMBNAILS_SIZE);
            return true;
        }
        return false;
    });
}
function processPreview(req, video) {
    return __awaiter(this, void 0, void 0, function* () {
        const previewField = req.files ? req.files['previewfile'] : undefined;
        if (previewField) {
            const previewPhysicalFile = previewField[0];
            yield image_utils_1.processImage(previewPhysicalFile, path_1.join(initializers_1.CONFIG.STORAGE.PREVIEWS_DIR, video.getPreviewName()), initializers_1.PREVIEWS_SIZE);
            return true;
        }
        return false;
    });
}
function insertIntoDB(video, videoChannel, tags, videoImportAttributes) {
    return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
        const sequelizeOptions = { transaction: t };
        const videoCreated = yield video.save(sequelizeOptions);
        videoCreated.VideoChannel = videoChannel;
        if (tags) {
            const tagInstances = yield tag_1.TagModel.findOrCreateTags(tags, t);
            yield videoCreated.$set('Tags', tagInstances, sequelizeOptions);
            videoCreated.Tags = tagInstances;
        }
        else {
            videoCreated.Tags = [];
        }
        const videoImport = yield video_import_1.VideoImportModel.create(Object.assign({ videoId: videoCreated.id }, videoImportAttributes), sequelizeOptions);
        videoImport.Video = videoCreated;
        return videoImport;
    }));
}
//# sourceMappingURL=import.js.map