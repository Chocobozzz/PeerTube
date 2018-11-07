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
const accounts_1 = require("../../helpers/custom-validators/accounts");
const logger_1 = require("../../helpers/logger");
const utils_1 = require("./utils");
const localAccountValidator = [
    check_1.param('name').custom(accounts_1.isAccountNameValid).withMessage('Should have a valid account name'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking localAccountValidator parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield accounts_1.isLocalAccountNameExist(req.params.name, res)))
            return;
        return next();
    })
];
exports.localAccountValidator = localAccountValidator;
const accountsNameWithHostGetValidator = [
    check_1.param('accountName').exists().withMessage('Should have an account name with host'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking accountsNameWithHostGetValidator parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield accounts_1.isAccountNameWithHostExist(req.params.accountName, res)))
            return;
        return next();
    })
];
exports.accountsNameWithHostGetValidator = accountsNameWithHostGetValidator;
