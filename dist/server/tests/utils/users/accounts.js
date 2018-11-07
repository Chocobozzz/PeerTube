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
const chai_1 = require("chai");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const index_1 = require("../index");
const requests_1 = require("../requests/requests");
function getAccountsList(url, sort = '-createdAt', statusCodeExpected = 200) {
    const path = '/api/v1/accounts';
    return requests_1.makeGetRequest({
        url,
        query: { sort },
        path,
        statusCodeExpected
    });
}
exports.getAccountsList = getAccountsList;
function getAccount(url, accountName, statusCodeExpected = 200) {
    const path = '/api/v1/accounts/' + accountName;
    return requests_1.makeGetRequest({
        url,
        path,
        statusCodeExpected
    });
}
exports.getAccount = getAccount;
function expectAccountFollows(url, nameWithDomain, followersCount, followingCount) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield getAccountsList(url);
        const account = res.body.data.find((a) => a.name + '@' + a.host === nameWithDomain);
        const message = `${nameWithDomain} on ${url}`;
        chai_1.expect(account.followersCount).to.equal(followersCount, message);
        chai_1.expect(account.followingCount).to.equal(followingCount, message);
    });
}
exports.expectAccountFollows = expectAccountFollows;
function checkActorFilesWereRemoved(actorUUID, serverNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        const testDirectory = 'test' + serverNumber;
        for (const directory of ['avatars']) {
            const directoryPath = path_1.join(index_1.root(), testDirectory, directory);
            const directoryExists = fs_extra_1.existsSync(directoryPath);
            chai_1.expect(directoryExists).to.be.true;
            const files = yield fs_extra_1.readdir(directoryPath);
            for (const file of files) {
                chai_1.expect(file).to.not.contain(actorUUID);
            }
        }
    });
}
exports.checkActorFilesWereRemoved = checkActorFilesWereRemoved;
