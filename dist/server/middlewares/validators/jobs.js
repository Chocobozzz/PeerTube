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
const jobs_1 = require("../../helpers/custom-validators/jobs");
const logger_1 = require("../../helpers/logger");
const utils_1 = require("./utils");
const listJobsValidator = [
    check_1.param('state').custom(jobs_1.isValidJobState).not().isEmpty().withMessage('Should have a valid job state'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking listJobsValidator parameters.', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        return next();
    })
];
exports.listJobsValidator = listJobsValidator;
