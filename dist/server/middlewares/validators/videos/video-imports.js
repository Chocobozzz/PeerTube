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
const check_1 = require("express-validator/check");
const misc_1 = require("../../../helpers/custom-validators/misc");
const logger_1 = require("../../../helpers/logger");
const utils_1 = require("../utils");
const videos_1 = require("./videos");
const video_imports_1 = require("../../../helpers/custom-validators/video-imports");
const express_utils_1 = require("../../../helpers/express-utils");
const videos_2 = require("../../../helpers/custom-validators/videos");
const constants_1 = require("../../../initializers/constants");
const initializers_1 = require("../../../initializers");
const videoImportAddValidator = videos_1.getCommonVideoAttributes().concat([
    check_1.body('channelId')
        .toInt()
        .custom(misc_1.isIdValid).withMessage('Should have correct video channel id'),
    check_1.body('targetUrl')
        .optional()
        .custom(video_imports_1.isVideoImportTargetUrlValid).withMessage('Should have a valid video import target URL'),
    check_1.body('magnetUri')
        .optional()
        .custom(videos_2.isVideoMagnetUriValid).withMessage('Should have a valid video magnet URI'),
    check_1.body('torrentfile')
        .custom((value, { req }) => video_imports_1.isVideoImportTorrentFile(req.files)).withMessage('This torrent file is not supported or too large. Please, make sure it is of the following type: '
        + initializers_1.CONSTRAINTS_FIELDS.VIDEO_IMPORTS.TORRENT_FILE.EXTNAME.join(', ')),
    check_1.body('name')
        .optional()
        .custom(videos_2.isVideoNameValid).withMessage('Should have a valid name'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videoImportAddValidator parameters', { parameters: req.body });
        const user = res.locals.oauth.token.User;
        const torrentFile = req.files && req.files['torrentfile'] ? req.files['torrentfile'][0] : undefined;
        if (utils_1.areValidationErrors(req, res))
            return express_utils_1.cleanUpReqFiles(req);
        if (req.body.targetUrl && constants_1.CONFIG.IMPORT.VIDEOS.HTTP.ENABLED !== true) {
            express_utils_1.cleanUpReqFiles(req);
            return res.status(409)
                .json({ error: 'HTTP import is not enabled on this instance.' })
                .end();
        }
        if (constants_1.CONFIG.IMPORT.VIDEOS.TORRENT.ENABLED !== true && (req.body.magnetUri || torrentFile)) {
            express_utils_1.cleanUpReqFiles(req);
            return res.status(409)
                .json({ error: 'Torrent/magnet URI import is not enabled on this instance.' })
                .end();
        }
        if (!(yield videos_2.isVideoChannelOfAccountExist(req.body.channelId, user, res)))
            return express_utils_1.cleanUpReqFiles(req);
        if (!req.body.targetUrl && !req.body.magnetUri && !torrentFile) {
            express_utils_1.cleanUpReqFiles(req);
            return res.status(400)
                .json({ error: 'Should have a magnetUri or a targetUrl or a torrent file.' })
                .end();
        }
        return next();
    })
]);
exports.videoImportAddValidator = videoImportAddValidator;
//# sourceMappingURL=video-imports.js.map