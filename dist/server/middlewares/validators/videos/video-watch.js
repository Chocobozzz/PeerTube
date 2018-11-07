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
const videos_1 = require("../../../helpers/custom-validators/videos");
const utils_1 = require("../utils");
const logger_1 = require("../../../helpers/logger");
const videoWatchingValidator = [
    check_1.param('videoId').custom(misc_1.isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
    check_1.body('currentTime')
        .toInt()
        .isInt().withMessage('Should have correct current time'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking videoWatching parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield videos_1.isVideoExist(req.params.videoId, res, 'id')))
            return;
        return next();
    })
];
exports.videoWatchingValidator = videoWatchingValidator;
//# sourceMappingURL=video-watch.js.map