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
const redis_1 = require("redis");
const logger_1 = require("../helpers/logger");
const utils_1 = require("../helpers/utils");
const initializers_1 = require("../initializers");
class Redis {
    constructor() {
        this.initialized = false;
    }
    init() {
        if (this.initialized === true)
            return;
        this.initialized = true;
        this.client = redis_1.createClient(Redis.getRedisClient());
        this.client.on('error', err => {
            logger_1.logger.error('Error in Redis client.', { err });
            process.exit(-1);
        });
        if (initializers_1.CONFIG.REDIS.AUTH) {
            this.client.auth(initializers_1.CONFIG.REDIS.AUTH);
        }
        this.prefix = 'redis-' + initializers_1.CONFIG.WEBSERVER.HOST + '-';
    }
    static getRedisClient() {
        return Object.assign({}, (initializers_1.CONFIG.REDIS.AUTH && initializers_1.CONFIG.REDIS.AUTH != null) ? { password: initializers_1.CONFIG.REDIS.AUTH } : {}, (initializers_1.CONFIG.REDIS.DB) ? { db: initializers_1.CONFIG.REDIS.DB } : {}, (initializers_1.CONFIG.REDIS.HOSTNAME && initializers_1.CONFIG.REDIS.PORT) ?
            { host: initializers_1.CONFIG.REDIS.HOSTNAME, port: initializers_1.CONFIG.REDIS.PORT } :
            { path: initializers_1.CONFIG.REDIS.SOCKET });
    }
    setResetPasswordVerificationString(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const generatedString = yield utils_1.generateRandomString(32);
            yield this.setValue(this.generateResetPasswordKey(userId), generatedString, initializers_1.USER_PASSWORD_RESET_LIFETIME);
            return generatedString;
        });
    }
    getResetPasswordLink(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getValue(this.generateResetPasswordKey(userId));
        });
    }
    setVerifyEmailVerificationString(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const generatedString = yield utils_1.generateRandomString(32);
            yield this.setValue(this.generateVerifyEmailKey(userId), generatedString, initializers_1.USER_EMAIL_VERIFY_LIFETIME);
            return generatedString;
        });
    }
    getVerifyEmailLink(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getValue(this.generateVerifyEmailKey(userId));
        });
    }
    setIPVideoView(ip, videoUUID) {
        return this.setValue(this.generateViewKey(ip, videoUUID), '1', initializers_1.VIDEO_VIEW_LIFETIME);
    }
    isVideoIPViewExists(ip, videoUUID) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.exists(this.generateViewKey(ip, videoUUID));
        });
    }
    getCachedRoute(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const cached = yield this.getObject(this.generateCachedRouteKey(req));
            return cached;
        });
    }
    setCachedRoute(req, body, lifetime, contentType, statusCode) {
        const cached = Object.assign({}, {
            body: body.toString()
        }, (contentType) ? { contentType } : null, (statusCode) ? { statusCode: statusCode.toString() } : null);
        return this.setObject(this.generateCachedRouteKey(req), cached, lifetime);
    }
    addVideoView(videoId) {
        const keyIncr = this.generateVideoViewKey(videoId);
        const keySet = this.generateVideosViewKey();
        return Promise.all([
            this.addToSet(keySet, videoId.toString()),
            this.increment(keyIncr)
        ]);
    }
    getVideoViews(videoId, hour) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = this.generateVideoViewKey(videoId, hour);
            const valueString = yield this.getValue(key);
            return parseInt(valueString, 10);
        });
    }
    getVideosIdViewed(hour) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = this.generateVideosViewKey(hour);
            const stringIds = yield this.getSet(key);
            return stringIds.map(s => parseInt(s, 10));
        });
    }
    deleteVideoViews(videoId, hour) {
        const keySet = this.generateVideosViewKey(hour);
        const keyIncr = this.generateVideoViewKey(videoId, hour);
        return Promise.all([
            this.deleteFromSet(keySet, videoId.toString()),
            this.deleteKey(keyIncr)
        ]);
    }
    generateCachedRouteKey(req) {
        return req.method + '-' + req.originalUrl;
    }
    generateVideosViewKey(hour) {
        if (!hour)
            hour = new Date().getHours();
        return `videos-view-h${hour}`;
    }
    generateVideoViewKey(videoId, hour) {
        if (!hour)
            hour = new Date().getHours();
        return `video-view-${videoId}-h${hour}`;
    }
    generateResetPasswordKey(userId) {
        return 'reset-password-' + userId;
    }
    generateVerifyEmailKey(userId) {
        return 'verify-email-' + userId;
    }
    generateViewKey(ip, videoUUID) {
        return videoUUID + '-' + ip;
    }
    getValue(key) {
        return new Promise((res, rej) => {
            this.client.get(this.prefix + key, (err, value) => {
                if (err)
                    return rej(err);
                return res(value);
            });
        });
    }
    getSet(key) {
        return new Promise((res, rej) => {
            this.client.smembers(this.prefix + key, (err, value) => {
                if (err)
                    return rej(err);
                return res(value);
            });
        });
    }
    addToSet(key, value) {
        return new Promise((res, rej) => {
            this.client.sadd(this.prefix + key, value, err => err ? rej(err) : res());
        });
    }
    deleteFromSet(key, value) {
        return new Promise((res, rej) => {
            this.client.srem(this.prefix + key, value, err => err ? rej(err) : res());
        });
    }
    deleteKey(key) {
        return new Promise((res, rej) => {
            this.client.del(this.prefix + key, err => err ? rej(err) : res());
        });
    }
    deleteFieldInHash(key, field) {
        return new Promise((res, rej) => {
            this.client.hdel(this.prefix + key, field, err => err ? rej(err) : res());
        });
    }
    setValue(key, value, expirationMilliseconds) {
        return new Promise((res, rej) => {
            this.client.set(this.prefix + key, value, 'PX', expirationMilliseconds, (err, ok) => {
                if (err)
                    return rej(err);
                if (ok !== 'OK')
                    return rej(new Error('Redis set result is not OK.'));
                return res();
            });
        });
    }
    setObject(key, obj, expirationMilliseconds) {
        return new Promise((res, rej) => {
            this.client.hmset(this.prefix + key, obj, (err, ok) => {
                if (err)
                    return rej(err);
                if (!ok)
                    return rej(new Error('Redis mset result is not OK.'));
                this.client.pexpire(this.prefix + key, expirationMilliseconds, (err, ok) => {
                    if (err)
                        return rej(err);
                    if (!ok)
                        return rej(new Error('Redis expiration result is not OK.'));
                    return res();
                });
            });
        });
    }
    getObject(key) {
        return new Promise((res, rej) => {
            this.client.hgetall(this.prefix + key, (err, value) => {
                if (err)
                    return rej(err);
                return res(value);
            });
        });
    }
    setValueInHash(key, field, value) {
        return new Promise((res, rej) => {
            this.client.hset(this.prefix + key, field, value, (err) => {
                if (err)
                    return rej(err);
                return res();
            });
        });
    }
    increment(key) {
        return new Promise((res, rej) => {
            this.client.incr(this.prefix + key, (err, value) => {
                if (err)
                    return rej(err);
                return res(value);
            });
        });
    }
    exists(key) {
        return new Promise((res, rej) => {
            this.client.exists(this.prefix + key, (err, existsNumber) => {
                if (err)
                    return rej(err);
                return res(existsNumber === 1);
            });
        });
    }
    static get Instance() {
        return this.instance || (this.instance = new this());
    }
}
exports.Redis = Redis;
