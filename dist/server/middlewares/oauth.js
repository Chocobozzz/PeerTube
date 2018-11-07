"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OAuthServer = require("express-oauth-server");
require("express-validator");
const initializers_1 = require("../initializers");
const logger_1 = require("../helpers/logger");
const oAuthServer = new OAuthServer({
    useErrorHandler: true,
    accessTokenLifetime: initializers_1.OAUTH_LIFETIME.ACCESS_TOKEN,
    refreshTokenLifetime: initializers_1.OAUTH_LIFETIME.REFRESH_TOKEN,
    model: require('../lib/oauth-model')
});
function authenticate(req, res, next) {
    oAuthServer.authenticate()(req, res, err => {
        if (err) {
            logger_1.logger.warn('Cannot authenticate.', { err });
            return res.status(err.status)
                .json({
                error: 'Token is invalid.',
                code: err.name
            })
                .end();
        }
        return next();
    });
}
exports.authenticate = authenticate;
function optionalAuthenticate(req, res, next) {
    if (req.header('authorization'))
        return authenticate(req, res, next);
    return next();
}
exports.optionalAuthenticate = optionalAuthenticate;
function token(req, res, next) {
    return oAuthServer.token()(req, res, err => {
        if (err) {
            return res.status(err.status)
                .json({
                error: err.message,
                code: err.name
            })
                .end();
        }
        return next();
    });
}
exports.token = token;
