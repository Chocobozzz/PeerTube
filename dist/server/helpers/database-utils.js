"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const retry = require("async/retry");
const logger_1 = require("./logger");
function retryTransactionWrapper(functionToRetry, ...args) {
    return transactionRetryer(callback => {
        functionToRetry.apply(null, args)
            .then((result) => callback(null, result))
            .catch(err => callback(err));
    })
        .catch(err => {
        logger_1.logger.error(`Cannot execute ${functionToRetry.name} with many retries.`, { err });
        throw err;
    });
}
exports.retryTransactionWrapper = retryTransactionWrapper;
function transactionRetryer(func) {
    return new Promise((res, rej) => {
        retry({
            times: 5,
            errorFilter: err => {
                const willRetry = (err.name === 'SequelizeDatabaseError');
                logger_1.logger.debug('Maybe retrying the transaction function.', { willRetry, err });
                return willRetry;
            }
        }, func, (err, data) => err ? rej(err) : res(data));
    });
}
exports.transactionRetryer = transactionRetryer;
function updateInstanceWithAnother(instanceToUpdate, baseInstance) {
    const obj = baseInstance.toJSON();
    for (const key of Object.keys(obj)) {
        instanceToUpdate.set(key, obj[key]);
    }
}
exports.updateInstanceWithAnother = updateInstanceWithAnother;
function resetSequelizeInstance(instance, savedFields) {
    Object.keys(savedFields).forEach(key => {
        const value = savedFields[key];
        instance.set(key, value);
    });
}
exports.resetSequelizeInstance = resetSequelizeInstance;
