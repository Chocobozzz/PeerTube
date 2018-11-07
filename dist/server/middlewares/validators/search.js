"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const logger_1 = require("../../helpers/logger");
const check_1 = require("express-validator/check");
const misc_1 = require("../../helpers/custom-validators/misc");
const videosSearchValidator = [
    check_1.query('search').optional().not().isEmpty().withMessage('Should have a valid search'),
    check_1.query('startDate').optional().custom(misc_1.isDateValid).withMessage('Should have a valid start date'),
    check_1.query('endDate').optional().custom(misc_1.isDateValid).withMessage('Should have a valid end date'),
    check_1.query('durationMin').optional().isInt().withMessage('Should have a valid min duration'),
    check_1.query('durationMax').optional().isInt().withMessage('Should have a valid max duration'),
    (req, res, next) => {
        logger_1.logger.debug('Checking videos search query', { parameters: req.query });
        if (utils_1.areValidationErrors(req, res))
            return;
        return next();
    }
];
exports.videosSearchValidator = videosSearchValidator;
const videoChannelsSearchValidator = [
    check_1.query('search').not().isEmpty().withMessage('Should have a valid search'),
    (req, res, next) => {
        logger_1.logger.debug('Checking video channels search query', { parameters: req.query });
        if (utils_1.areValidationErrors(req, res))
            return;
        return next();
    }
];
exports.videoChannelsSearchValidator = videoChannelsSearchValidator;
//# sourceMappingURL=search.js.map