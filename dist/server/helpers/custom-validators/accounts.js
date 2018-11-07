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
const validator = require("validator");
const account_1 = require("../../models/account/account");
const users_1 = require("./users");
const misc_1 = require("./misc");
const initializers_1 = require("../../initializers");
function isAccountNameValid(value) {
    return users_1.isUserUsernameValid(value);
}
exports.isAccountNameValid = isAccountNameValid;
function isAccountIdValid(value) {
    return misc_1.exists(value);
}
exports.isAccountIdValid = isAccountIdValid;
function isAccountDescriptionValid(value) {
    return users_1.isUserDescriptionValid(value);
}
exports.isAccountDescriptionValid = isAccountDescriptionValid;
function isAccountIdExist(id, res, sendNotFound = true) {
    let promise;
    if (validator.isInt('' + id)) {
        promise = account_1.AccountModel.load(+id);
    }
    else {
        promise = account_1.AccountModel.loadByUUID('' + id);
    }
    return isAccountExist(promise, res, sendNotFound);
}
exports.isAccountIdExist = isAccountIdExist;
function isLocalAccountNameExist(name, res, sendNotFound = true) {
    const promise = account_1.AccountModel.loadLocalByName(name);
    return isAccountExist(promise, res, sendNotFound);
}
exports.isLocalAccountNameExist = isLocalAccountNameExist;
function isAccountNameWithHostExist(nameWithDomain, res, sendNotFound = true) {
    const [accountName, host] = nameWithDomain.split('@');
    let promise;
    if (!host || host === initializers_1.CONFIG.WEBSERVER.HOST)
        promise = account_1.AccountModel.loadLocalByName(accountName);
    else
        promise = account_1.AccountModel.loadByNameAndHost(accountName, host);
    return isAccountExist(promise, res, sendNotFound);
}
exports.isAccountNameWithHostExist = isAccountNameWithHostExist;
function isAccountExist(p, res, sendNotFound) {
    return __awaiter(this, void 0, void 0, function* () {
        const account = yield p;
        if (!account) {
            if (sendNotFound === true) {
                res.status(404)
                    .send({ error: 'Account not found' })
                    .end();
            }
            return false;
        }
        res.locals.account = account;
        return true;
    });
}
