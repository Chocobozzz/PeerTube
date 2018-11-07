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
const users_1 = require("../../helpers/custom-validators/users");
const logger_1 = require("../../helpers/logger");
const utils_1 = require("./utils");
const customConfigUpdateValidator = [
    check_1.body('instance.name').exists().withMessage('Should have a valid instance name'),
    check_1.body('instance.description').exists().withMessage('Should have a valid instance description'),
    check_1.body('instance.terms').exists().withMessage('Should have a valid instance terms'),
    check_1.body('instance.defaultClientRoute').exists().withMessage('Should have a valid instance default client route'),
    check_1.body('instance.defaultNSFWPolicy').custom(users_1.isUserNSFWPolicyValid).withMessage('Should have a valid NSFW policy'),
    check_1.body('instance.customizations.css').exists().withMessage('Should have a valid instance CSS customization'),
    check_1.body('instance.customizations.javascript').exists().withMessage('Should have a valid instance JavaScript customization'),
    check_1.body('cache.previews.size').isInt().withMessage('Should have a valid previews size'),
    check_1.body('signup.enabled').isBoolean().withMessage('Should have a valid signup enabled boolean'),
    check_1.body('signup.limit').isInt().withMessage('Should have a valid signup limit'),
    check_1.body('admin.email').isEmail().withMessage('Should have a valid administrator email'),
    check_1.body('user.videoQuota').custom(users_1.isUserVideoQuotaValid).withMessage('Should have a valid video quota'),
    check_1.body('transcoding.enabled').isBoolean().withMessage('Should have a valid transcoding enabled boolean'),
    check_1.body('transcoding.threads').isInt().withMessage('Should have a valid transcoding threads number'),
    check_1.body('transcoding.resolutions.240p').isBoolean().withMessage('Should have a valid transcoding 240p resolution enabled boolean'),
    check_1.body('transcoding.resolutions.360p').isBoolean().withMessage('Should have a valid transcoding 360p resolution enabled boolean'),
    check_1.body('transcoding.resolutions.480p').isBoolean().withMessage('Should have a valid transcoding 480p resolution enabled boolean'),
    check_1.body('transcoding.resolutions.720p').isBoolean().withMessage('Should have a valid transcoding 720p resolution enabled boolean'),
    check_1.body('transcoding.resolutions.1080p').isBoolean().withMessage('Should have a valid transcoding 1080p resolution enabled boolean'),
    check_1.body('import.videos.http.enabled').isBoolean().withMessage('Should have a valid import video http enabled boolean'),
    check_1.body('import.videos.torrent.enabled').isBoolean().withMessage('Should have a valid import video torrent enabled boolean'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking customConfigUpdateValidator parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        return next();
    })
];
exports.customConfigUpdateValidator = customConfigUpdateValidator;
//# sourceMappingURL=config.js.map