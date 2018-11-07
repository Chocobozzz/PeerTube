"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const check_1 = require("express-validator/check");
const signature_1 = require("../../../helpers/custom-validators/activitypub/signature");
const misc_1 = require("../../../helpers/custom-validators/misc");
const logger_1 = require("../../../helpers/logger");
const utils_1 = require("../utils");
const signatureValidator = [
    check_1.body('signature.type')
        .optional()
        .custom(signature_1.isSignatureTypeValid).withMessage('Should have a valid signature type'),
    check_1.body('signature.created')
        .optional()
        .custom(misc_1.isDateValid).withMessage('Should have a valid signature created date'),
    check_1.body('signature.creator')
        .optional()
        .custom(signature_1.isSignatureCreatorValid).withMessage('Should have a valid signature creator'),
    check_1.body('signature.signatureValue')
        .optional()
        .custom(signature_1.isSignatureValueValid).withMessage('Should have a valid signature value'),
    (req, res, next) => {
        logger_1.logger.debug('Checking activitypub signature parameter', { parameters: { signature: req.body.signature } });
        if (utils_1.areValidationErrors(req, res))
            return;
        return next();
    }
];
exports.signatureValidator = signatureValidator;
//# sourceMappingURL=signature.js.map