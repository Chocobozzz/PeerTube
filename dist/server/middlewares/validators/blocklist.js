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
const logger_1 = require("../../helpers/logger");
const utils_1 = require("./utils");
const accounts_1 = require("../../helpers/custom-validators/accounts");
const account_blocklist_1 = require("../../models/account/account-blocklist");
const servers_1 = require("../../helpers/custom-validators/servers");
const server_blocklist_1 = require("../../models/server/server-blocklist");
const server_1 = require("../../models/server/server");
const initializers_1 = require("../../initializers");
const utils_2 = require("../../helpers/utils");
const blockAccountValidator = [
    check_1.body('accountName').exists().withMessage('Should have an account name with host'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking blockAccountByAccountValidator parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield accounts_1.isAccountNameWithHostExist(req.body.accountName, res)))
            return;
        const user = res.locals.oauth.token.User;
        const accountToBlock = res.locals.account;
        if (user.Account.id === accountToBlock.id) {
            res.status(409)
                .send({ error: 'You cannot block yourself.' })
                .end();
            return;
        }
        return next();
    })
];
exports.blockAccountValidator = blockAccountValidator;
const unblockAccountByAccountValidator = [
    check_1.param('accountName').exists().withMessage('Should have an account name with host'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking unblockAccountByAccountValidator parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield accounts_1.isAccountNameWithHostExist(req.params.accountName, res)))
            return;
        const user = res.locals.oauth.token.User;
        const targetAccount = res.locals.account;
        if (!(yield isUnblockAccountExists(user.Account.id, targetAccount.id, res)))
            return;
        return next();
    })
];
exports.unblockAccountByAccountValidator = unblockAccountByAccountValidator;
const unblockAccountByServerValidator = [
    check_1.param('accountName').exists().withMessage('Should have an account name with host'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking unblockAccountByServerValidator parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        if (!(yield accounts_1.isAccountNameWithHostExist(req.params.accountName, res)))
            return;
        const serverActor = yield utils_2.getServerActor();
        const targetAccount = res.locals.account;
        if (!(yield isUnblockAccountExists(serverActor.Account.id, targetAccount.id, res)))
            return;
        return next();
    })
];
exports.unblockAccountByServerValidator = unblockAccountByServerValidator;
const blockServerValidator = [
    check_1.body('host').custom(servers_1.isHostValid).withMessage('Should have a valid host'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking serverGetValidator parameters', { parameters: req.body });
        if (utils_1.areValidationErrors(req, res))
            return;
        const host = req.body.host;
        if (host === initializers_1.CONFIG.WEBSERVER.HOST) {
            return res.status(409)
                .send({ error: 'You cannot block your own server.' })
                .end();
        }
        const server = yield server_1.ServerModel.loadByHost(host);
        if (!server) {
            return res.status(404)
                .send({ error: 'Server host not found.' })
                .end();
        }
        res.locals.server = server;
        return next();
    })
];
exports.blockServerValidator = blockServerValidator;
const unblockServerByAccountValidator = [
    check_1.param('host').custom(servers_1.isHostValid).withMessage('Should have an account name with host'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking unblockServerByAccountValidator parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        const user = res.locals.oauth.token.User;
        if (!(yield isUnblockServerExists(user.Account.id, req.params.host, res)))
            return;
        return next();
    })
];
exports.unblockServerByAccountValidator = unblockServerByAccountValidator;
const unblockServerByServerValidator = [
    check_1.param('host').custom(servers_1.isHostValid).withMessage('Should have an account name with host'),
    (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Checking unblockServerByServerValidator parameters', { parameters: req.params });
        if (utils_1.areValidationErrors(req, res))
            return;
        const serverActor = yield utils_2.getServerActor();
        if (!(yield isUnblockServerExists(serverActor.Account.id, req.params.host, res)))
            return;
        return next();
    })
];
exports.unblockServerByServerValidator = unblockServerByServerValidator;
function isUnblockAccountExists(accountId, targetAccountId, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const accountBlock = yield account_blocklist_1.AccountBlocklistModel.loadByAccountAndTarget(accountId, targetAccountId);
        if (!accountBlock) {
            res.status(404)
                .send({ error: 'Account block entry not found.' })
                .end();
            return false;
        }
        res.locals.accountBlock = accountBlock;
        return true;
    });
}
function isUnblockServerExists(accountId, host, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const serverBlock = yield server_blocklist_1.ServerBlocklistModel.loadByAccountAndHost(accountId, host);
        if (!serverBlock) {
            res.status(404)
                .send({ error: 'Server block entry not found.' })
                .end();
            return false;
        }
        res.locals.serverBlock = serverBlock;
        return true;
    });
}
//# sourceMappingURL=blocklist.js.map