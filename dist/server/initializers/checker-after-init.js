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
const config = require("config");
const core_utils_1 = require("../helpers/core-utils");
const user_1 = require("../models/account/user");
const application_1 = require("../models/application/application");
const oauth_client_1 = require("../models/oauth/oauth-client");
const url_1 = require("url");
const constants_1 = require("./constants");
const logger_1 = require("../helpers/logger");
const utils_1 = require("../helpers/utils");
const misc_1 = require("../helpers/custom-validators/misc");
const lodash_1 = require("lodash");
function checkActivityPubUrls() {
    return __awaiter(this, void 0, void 0, function* () {
        const actor = yield utils_1.getServerActor();
        const parsed = url_1.parse(actor.url);
        if (constants_1.CONFIG.WEBSERVER.HOST !== parsed.host) {
            const NODE_ENV = config.util.getEnv('NODE_ENV');
            const NODE_CONFIG_DIR = config.util.getEnv('NODE_CONFIG_DIR');
            logger_1.logger.warn('It seems PeerTube was started (and created some data) with another domain name. ' +
                'This means you will not be able to federate! ' +
                'Please use %s %s npm run update-host to fix this.', NODE_CONFIG_DIR ? `NODE_CONFIG_DIR=${NODE_CONFIG_DIR}` : '', NODE_ENV ? `NODE_ENV=${NODE_ENV}` : '');
        }
    });
}
exports.checkActivityPubUrls = checkActivityPubUrls;
function checkConfig() {
    const defaultNSFWPolicy = constants_1.CONFIG.INSTANCE.DEFAULT_NSFW_POLICY;
    {
        const available = ['do_not_list', 'blur', 'display'];
        if (available.indexOf(defaultNSFWPolicy) === -1) {
            return 'NSFW policy setting should be ' + available.join(' or ') + ' instead of ' + defaultNSFWPolicy;
        }
    }
    const redundancyVideos = constants_1.CONFIG.REDUNDANCY.VIDEOS.STRATEGIES;
    if (misc_1.isArray(redundancyVideos)) {
        const available = ['most-views', 'trending', 'recently-added'];
        for (const r of redundancyVideos) {
            if (available.indexOf(r.strategy) === -1) {
                return 'Videos redundancy should have ' + available.join(' or ') + ' strategy instead of ' + r.strategy;
            }
            if (!core_utils_1.isTestInstance() && r.minLifetime < 1000 * 3600 * 10) {
                return 'Video redundancy minimum lifetime should be >= 10 hours for strategy ' + r.strategy;
            }
        }
        const filtered = lodash_1.uniq(redundancyVideos.map(r => r.strategy));
        if (filtered.length !== redundancyVideos.length) {
            return 'Redundancy video entries should have unique strategies';
        }
        const recentlyAddedStrategy = redundancyVideos.find(r => r.strategy === 'recently-added');
        if (recentlyAddedStrategy && isNaN(recentlyAddedStrategy.minViews)) {
            return 'Min views in recently added strategy is not a number';
        }
    }
    if (core_utils_1.isProdInstance()) {
        const configStorage = config.get('storage');
        for (const key of Object.keys(configStorage)) {
            if (configStorage[key].startsWith('storage/')) {
                logger_1.logger.warn('Directory of %s should not be in the production directory of PeerTube. Please check your production configuration file.', key);
            }
        }
    }
    return null;
}
exports.checkConfig = checkConfig;
function clientsExist() {
    return __awaiter(this, void 0, void 0, function* () {
        const totalClients = yield oauth_client_1.OAuthClientModel.countTotal();
        return totalClients !== 0;
    });
}
exports.clientsExist = clientsExist;
function usersExist() {
    return __awaiter(this, void 0, void 0, function* () {
        const totalUsers = yield user_1.UserModel.countTotal();
        return totalUsers !== 0;
    });
}
exports.usersExist = usersExist;
function applicationExist() {
    return __awaiter(this, void 0, void 0, function* () {
        const totalApplication = yield application_1.ApplicationModel.countTotal();
        return totalApplication !== 0;
    });
}
exports.applicationExist = applicationExist;
