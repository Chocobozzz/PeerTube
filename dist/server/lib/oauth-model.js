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
const oauth2_server_1 = require("oauth2-server");
const logger_1 = require("../helpers/logger");
const user_1 = require("../models/account/user");
const oauth_client_1 = require("../models/oauth/oauth-client");
const oauth_token_1 = require("../models/oauth/oauth-token");
const constants_1 = require("../initializers/constants");
const accessTokenCache = {};
const userHavingToken = {};
function deleteUserToken(userId, t) {
    clearCacheByUserId(userId);
    return oauth_token_1.OAuthTokenModel.deleteUserToken(userId, t);
}
exports.deleteUserToken = deleteUserToken;
function clearCacheByUserId(userId) {
    const token = userHavingToken[userId];
    if (token !== undefined) {
        accessTokenCache[token] = undefined;
        userHavingToken[userId] = undefined;
    }
}
exports.clearCacheByUserId = clearCacheByUserId;
function clearCacheByToken(token) {
    const tokenModel = accessTokenCache[token];
    if (tokenModel !== undefined) {
        userHavingToken[tokenModel.userId] = undefined;
        accessTokenCache[token] = undefined;
    }
}
exports.clearCacheByToken = clearCacheByToken;
function getAccessToken(bearerToken) {
    logger_1.logger.debug('Getting access token (bearerToken: ' + bearerToken + ').');
    if (accessTokenCache[bearerToken] !== undefined)
        return accessTokenCache[bearerToken];
    return oauth_token_1.OAuthTokenModel.getByTokenAndPopulateUser(bearerToken)
        .then(tokenModel => {
        if (tokenModel) {
            accessTokenCache[bearerToken] = tokenModel;
            userHavingToken[tokenModel.userId] = tokenModel.accessToken;
        }
        return tokenModel;
    });
}
exports.getAccessToken = getAccessToken;
function getClient(clientId, clientSecret) {
    logger_1.logger.debug('Getting Client (clientId: ' + clientId + ', clientSecret: ' + clientSecret + ').');
    return oauth_client_1.OAuthClientModel.getByIdAndSecret(clientId, clientSecret);
}
exports.getClient = getClient;
function getRefreshToken(refreshToken) {
    logger_1.logger.debug('Getting RefreshToken (refreshToken: ' + refreshToken + ').');
    return oauth_token_1.OAuthTokenModel.getByRefreshTokenAndPopulateClient(refreshToken);
}
exports.getRefreshToken = getRefreshToken;
function getUser(usernameOrEmail, password) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Getting User (username/email: ' + usernameOrEmail + ', password: ******).');
        const user = yield user_1.UserModel.loadByUsernameOrEmail(usernameOrEmail);
        if (!user)
            return null;
        const passwordMatch = yield user.isPasswordMatch(password);
        if (passwordMatch === false)
            return null;
        if (user.blocked)
            throw new oauth2_server_1.AccessDeniedError('User is blocked.');
        if (constants_1.CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION && user.emailVerified === false) {
            throw new oauth2_server_1.AccessDeniedError('User email is not verified.');
        }
        return user;
    });
}
exports.getUser = getUser;
function revokeToken(tokenInfo) {
    return __awaiter(this, void 0, void 0, function* () {
        const token = yield oauth_token_1.OAuthTokenModel.getByRefreshTokenAndPopulateUser(tokenInfo.refreshToken);
        if (token) {
            clearCacheByToken(token.accessToken);
            token.destroy()
                .catch(err => logger_1.logger.error('Cannot destroy token when revoking token.', { err }));
        }
        const expiredToken = token;
        expiredToken.refreshTokenExpiresAt = new Date('2015-05-28T06:59:53.000Z');
        return expiredToken;
    });
}
exports.revokeToken = revokeToken;
function saveToken(token, client, user) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.debug('Saving token ' + token.accessToken + ' for client ' + client.id + ' and user ' + user.id + '.');
        const tokenToCreate = {
            accessToken: token.accessToken,
            accessTokenExpiresAt: token.accessTokenExpiresAt,
            refreshToken: token.refreshToken,
            refreshTokenExpiresAt: token.refreshTokenExpiresAt,
            oAuthClientId: client.id,
            userId: user.id
        };
        const tokenCreated = yield oauth_token_1.OAuthTokenModel.create(tokenToCreate);
        return Object.assign(tokenCreated, { client, user });
    });
}
exports.saveToken = saveToken;
//# sourceMappingURL=oauth-model.js.map