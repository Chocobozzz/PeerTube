"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const async_1 = require("async");
const database_utils_1 = require("../helpers/database-utils");
function asyncMiddleware(fun) {
    return (req, res, next) => {
        if (Array.isArray(fun) === true) {
            return async_1.eachSeries(fun, (f, cb) => {
                Promise.resolve(f(req, res, cb))
                    .catch(err => next(err));
            }, next);
        }
        return Promise.resolve(fun(req, res, next))
            .catch(err => next(err));
    };
}
exports.asyncMiddleware = asyncMiddleware;
function asyncRetryTransactionMiddleware(fun) {
    return (req, res, next) => {
        return Promise.resolve(database_utils_1.retryTransactionWrapper(fun, req, res, next)).catch(err => next(err));
    };
}
exports.asyncRetryTransactionMiddleware = asyncRetryTransactionMiddleware;
