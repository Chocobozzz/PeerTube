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
const passwordGenerator = require("password-generator");
const shared_1 = require("../../shared");
const logger_1 = require("../helpers/logger");
const user_1 = require("../lib/user");
const user_2 = require("../models/account/user");
const application_1 = require("../models/application/application");
const oauth_client_1 = require("../models/oauth/oauth-client");
const checker_after_init_1 = require("./checker-after-init");
const constants_1 = require("./constants");
const database_1 = require("./database");
const fs_extra_1 = require("fs-extra");
function installApplication() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield database_1.sequelizeTypescript.sync();
            yield removeCacheDirectories();
            yield createDirectoriesIfNotExist();
            yield createApplicationIfNotExist();
            yield createOAuthClientIfNotExist();
            yield createOAuthAdminIfNotExist();
        }
        catch (err) {
            logger_1.logger.error('Cannot install application.', { err });
            process.exit(-1);
        }
    });
}
exports.installApplication = installApplication;
function removeCacheDirectories() {
    const cacheDirectories = Object.keys(constants_1.CACHE)
        .map(k => constants_1.CACHE[k].DIRECTORY);
    const tasks = [];
    for (const key of Object.keys(cacheDirectories)) {
        const dir = cacheDirectories[key];
        tasks.push(fs_extra_1.remove(dir));
    }
    return Promise.all(tasks);
}
function createDirectoriesIfNotExist() {
    const storage = constants_1.CONFIG.STORAGE;
    const cacheDirectories = Object.keys(constants_1.CACHE)
        .map(k => constants_1.CACHE[k].DIRECTORY);
    const tasks = [];
    for (const key of Object.keys(storage)) {
        const dir = storage[key];
        tasks.push(fs_extra_1.ensureDir(dir));
    }
    for (const key of Object.keys(cacheDirectories)) {
        const dir = cacheDirectories[key];
        tasks.push(fs_extra_1.ensureDir(dir));
    }
    return Promise.all(tasks);
}
function createOAuthClientIfNotExist() {
    return __awaiter(this, void 0, void 0, function* () {
        const exist = yield checker_after_init_1.clientsExist();
        if (exist === true)
            return undefined;
        logger_1.logger.info('Creating a default OAuth Client.');
        const id = passwordGenerator(32, false, /[a-z0-9]/);
        const secret = passwordGenerator(32, false, /[a-zA-Z0-9]/);
        const client = new oauth_client_1.OAuthClientModel({
            clientId: id,
            clientSecret: secret,
            grants: ['password', 'refresh_token'],
            redirectUris: null
        });
        const createdClient = yield client.save();
        logger_1.logger.info('Client id: ' + createdClient.clientId);
        logger_1.logger.info('Client secret: ' + createdClient.clientSecret);
        return undefined;
    });
}
function createOAuthAdminIfNotExist() {
    return __awaiter(this, void 0, void 0, function* () {
        const exist = yield checker_after_init_1.usersExist();
        if (exist === true)
            return undefined;
        logger_1.logger.info('Creating the administrator.');
        const username = 'root';
        const role = shared_1.UserRole.ADMINISTRATOR;
        const email = constants_1.CONFIG.ADMIN.EMAIL;
        let validatePassword = true;
        let password = '';
        if (process.env.NODE_ENV === 'test') {
            password = 'test';
            if (process.env.NODE_APP_INSTANCE) {
                password += process.env.NODE_APP_INSTANCE;
            }
            validatePassword = false;
        }
        else {
            password = passwordGenerator(16, true);
        }
        const userData = {
            username,
            email,
            password,
            role,
            verified: true,
            nsfwPolicy: constants_1.CONFIG.INSTANCE.DEFAULT_NSFW_POLICY,
            videoQuota: -1,
            videoQuotaDaily: -1
        };
        const user = new user_2.UserModel(userData);
        yield user_1.createUserAccountAndChannel(user, validatePassword);
        logger_1.logger.info('Username: ' + username);
        logger_1.logger.info('User password: ' + password);
    });
}
function createApplicationIfNotExist() {
    return __awaiter(this, void 0, void 0, function* () {
        const exist = yield checker_after_init_1.applicationExist();
        if (exist === true)
            return undefined;
        logger_1.logger.info('Creating application account.');
        const application = yield application_1.ApplicationModel.create({
            migrationVersion: constants_1.LAST_MIGRATION_VERSION
        });
        return user_1.createApplicationActor(application.id);
    });
}
//# sourceMappingURL=installer.js.map