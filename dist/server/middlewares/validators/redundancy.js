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
require("express-validator");
const check_1 = require("express-validator/check");
const misc_1 = require("../../helpers/custom-validators/misc");
const videos_1 = require("../../helpers/custom-validators/videos");
const logger_1 = require("../../helpers/logger");
const utils_1 = require("./utils");
const video_redundancy_1 = require("../../models/redundancy/video-redundancy");
const servers_1 = require("../../helpers/custom-validators/servers");
const server_1 = require("../../models/server/server");
const videoRedundancyGetValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid video id'),
    check_1.param('resolution')
        .customSanitizer(misc_1.toIntOrNull)
        .custom(misc_1.exists).withMessage('Should have a valid resolution'),
    check_1.param('fps')
        .optional()
        .customSanitizer(misc_1.toIntOrNull)
        .custom(misc_1.exists).withMessage('Should have a valid fps'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videoRedundancyGetValidator parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res)))
            return;
        const video = res.locals.video;
        const videoFile = video.VideoFiles.find(f => {
            return f.resolution === req.params.resolution && (!req.params.fps || f.fps === req.params.fps);
        });
        if (!videoFile)
            return res.status(404).json({ error: 'Video file not found.' });
        res.locals.videoFile = videoFile;
        const videoRedundancy = yield video_redundancy_1.VideoRedundancyModel.loadLocalByFileId(videoFile.id);
        if (!videoRedundancy)
            return res.status(404).json({ error: 'Video redundancy not found.' });
        res.locals.videoRedundancy = videoRedundancy;
        return next();
    })
];
exports.videoRedundancyGetValidator = videoRedundancyGetValidator;
const updateServerRedundancyValidator = [
    check_1.param('host').custom(servers_1.isHostValid).withMessage('Should have a valid host'),
    check_1.body('redundancyAllowed')
        .toBoolean()
        .custom(misc_1.isBooleanValid).withMessage('Should have a valid redundancyAllowed attribute'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking updateServerRedundancy parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        const server = yield server_1.ServerModel.loadByHost(req.params.host);
        if (!server) {
            return res
                .status(404)
                .json({
                error: `Server ${req.params.host} not found.`
            })
                .end();
        }
        res.locals.server = server;
        return next();
    })
];
exports.updateServerRedundancyValidator = updateServerRedundancyValidator;
