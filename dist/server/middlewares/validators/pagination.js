"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const check_1 = require("express-validator/check");
const logger_1 = require("../../helpers/logger");
const utils_1 = require("./utils");
const paginationValidator = [
    check_1.query('start').optional().isInt({ min: 0 }).withMessage('Should have a number start'),
    check_1.query('count').optional().isInt({ min: 0 }).withMessage('Should have a number count'),
    (req, res, next) => {
        logger_1.logger.debug('Checking pagination parameters', { parameters: req.query });
        if (utils_1.areValidationErrors(req, res))
            return;
        return next();
    }
];
exports.paginationValidator = paginationValidator;
//# sourceMappingURL=pagination.js.map