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
const AsyncLock = require("async-lock");
const core_utils_1 = require("../helpers/core-utils");
const redis_1 = require("../lib/redis");
const logger_1 = require("../helpers/logger");
const lock = new AsyncLock({ timeout: 5000 });
function cacheRoute(lifetimeArg) {
    return function (req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const redisKey = redis_1.Redis.Instance.generateCachedRouteKey(req);
            try {
                yield lock.acquire(redisKey, (done) => __awaiter(this, void 0, void 0, function* () {
                    const cached = yield redis_1.Redis.Instance.getCachedRoute(req);
                    if (!cached) {
                        logger_1.logger.debug('No cached results for route %s.', req.originalUrl);
                        const sendSave = res.send.bind(res);
                        res.send = (body) => {
                            if (res.statusCode >= 200 && res.statusCode < 400) {
                                const contentType = res.get('content-type');
                                const lifetime = core_utils_1.parseDuration(lifetimeArg);
                                redis_1.Redis.Instance.setCachedRoute(req, body, lifetime, contentType, res.statusCode)
                                    .then(() => done())
                                    .catch(err => {
                                    logger_1.logger.error('Cannot cache route.', { err });
                                    return done(err);
                                });
                            }
                            else {
                                done();
                            }
                            return sendSave(body);
                        };
                        return next();
                    }
                    if (cached.contentType)
                        res.set('content-type', cached.contentType);
                    if (cached.statusCode) {
                        const statusCode = parseInt(cached.statusCode, 10);
                        if (!isNaN(statusCode))
                            res.status(statusCode);
                    }
                    logger_1.logger.debug('Use cached result for %s.', req.originalUrl);
                    res.send(cached.body).end();
                    return done();
                }));
            }
            catch (err) {
                logger_1.logger.error('Cannot serve cached route.', { err });
                return next();
            }
        });
    };
}
exports.cacheRoute = cacheRoute;
